// Alice is Missing - LAN game assistant.
// One Node process, built-ins only: serves the pages, holds the game state,
// pushes it to every device over Server-Sent Events.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const MEDIA_DIR = path.join(ROOT, "media");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const PORT = Number(arg("port") ?? process.env.PORT ?? 8080);
// Debug time scale: --speed=60 plays the 90 minutes in 90 seconds.
const SPEED = Number(arg("speed") ?? process.env.ALICE_SPEED ?? 1) || 1;
// Optional PIN for facilitator actions. Unset means anyone on the LAN can run the game.
const PIN = process.env.ALICE_PIN ?? "";

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "game.config.json"), "utf8"));
const DURATION_MS = config.durationMinutes * 60_000;
const INTERVALS = [...config.clueIntervals].sort((a, b) => b - a);

// ---------------------------------------------------------------- state

function freshState() {
  return {
    phase: "setup", // setup | running | paused | ended
    seatCount: config.minSeats + 1,
    silentFalls: false,
    seats: Array.from({ length: config.maxSeats }, (_, i) => ({
      id: i + 1,
      name: "",
      character: "",
      token: null,
    })),
    clues: Object.fromEntries(INTERVALS.map((m) => [m, null])), // interval -> seat id
    fired: [], // intervals whose time has come
    revealed: [], // intervals marked done
    secret: { suspect: "", location: "", suspectPool: "", locationPool: "", notes: "" },
    checklist: [],
    clock: { startedAt: null, pausedAt: null, pausedTotal: 0 },
    tableAudioReady: false,
  };
}

function loadState() {
  try {
    return { ...freshState(), ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
  } catch {
    return freshState();
  }
}

let state = loadState();
let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
  }, 200);
}

// ---------------------------------------------------------------- clock

function elapsedMs(now = Date.now()) {
  const c = state.clock;
  if (c.startedAt == null) return 0;
  const end = c.pausedAt ?? now;
  return Math.min(DURATION_MS, Math.max(0, (end - c.startedAt - c.pausedTotal) * SPEED));
}

function tick() {
  if (state.phase !== "running") return;
  const remainingMin = (DURATION_MS - elapsedMs()) / 60_000;
  let changed = false;
  for (const m of INTERVALS) {
    if (remainingMin <= m && !state.fired.includes(m)) {
      state.fired.push(m);
      changed = true;
    }
  }
  if (remainingMin <= 0) {
    state.phase = "ended";
    state.clock.pausedAt = Date.now();
    changed = true;
  }
  if (changed) commit();
}

// ---------------------------------------------------------------- views

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return "localhost";
}

const joinBase = () => process.env.PUBLIC_URL?.replace(/\/$/, "") ?? `http://${lanAddress()}:${PORT}`;

function soundtrack() {
  try {
    const f = fs.readdirSync(MEDIA_DIR).find((n) => /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i.test(n));
    return f ? `/media/${encodeURIComponent(f)}` : null;
  } catch {
    return null;
  }
}

function view(client) {
  const seats = state.seats.slice(0, state.seatCount).map((s) => ({
    id: s.id,
    name: s.name,
    character: s.character,
    claimed: Boolean(s.token),
    online: [...clients].some((c) => c.seat === s.id),
  }));
  const v = {
    serverNow: Date.now(),
    phase: state.phase,
    seatCount: state.seatCount,
    silentFalls: state.silentFalls,
    seats,
    clues: state.clues,
    fired: state.fired,
    revealed: state.revealed,
    clock: { ...state.clock, durationMs: DURATION_MS, speed: SPEED, elapsedMs: elapsedMs() },
    tableAudioReady: state.tableAudioReady,
    soundtrack: soundtrack(),
    joinBase: joinBase(),
    pinRequired: Boolean(PIN),
    config: {
      intervals: INTERVALS,
      cardsPerInterval: config.cardsPerInterval,
      audioOffsetSeconds: config.audioOffsetSeconds,
      minSeats: config.minSeats,
      maxSeats: config.maxSeats,
      expansions: config.expansions,
      checklist: config.setupChecklist,
    },
    checklist: state.checklist,
  };
  if (client.role === "facilitator" && client.authed) v.secret = state.secret;
  if (client.seat) v.mySeat = client.seat;
  return v;
}

// ---------------------------------------------------------------- SSE

const clients = new Set();

function send(client) {
  client.res.write(`event: state\ndata: ${JSON.stringify(view(client))}\n\n`);
}

function commit() {
  save();
  for (const c of clients) send(c);
}

setInterval(tick, 250);
setInterval(() => {
  for (const c of clients) c.res.write(": ping\n\n");
}, 15_000);

// ---------------------------------------------------------------- actions

const seatByToken = (token) => (token ? state.seats.find((s) => s.token === token) : undefined);
const clampText = (v, n = 60) => String(v ?? "").slice(0, n).trim();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const facilitatorOnly = new Set([
  "setup", "secret", "release", "start", "pause", "resume", "adjust", "resetClock", "newGame", "check",
]);

function act(body) {
  const { type } = body;
  if (facilitatorOnly.has(type) && PIN && body.pin !== PIN) throw new HttpError(403, "Wrong facilitator PIN");

  switch (type) {
    case "claim": {
      const seat = state.seats.find((s) => s.id === Number(body.seat));
      if (!seat || seat.id > state.seatCount) throw new HttpError(404, "No such seat");
      const mine = seatByToken(body.token);
      if (mine?.id === seat.id) return { seat: seat.id, token: seat.token };
      if (seat.token) throw new HttpError(409, "That seat is taken - ask the facilitator to release it");
      if (mine) mine.token = null; // switching seats
      seat.token = crypto.randomBytes(16).toString("hex");
      commit();
      return { seat: seat.id, token: seat.token };
    }
    case "leave": {
      const mine = seatByToken(body.token);
      if (mine) mine.token = null;
      for (const c of clients) if (c.seat === mine?.id) c.seat = null;
      break;
    }
    case "release": {
      const seat = state.seats.find((s) => s.id === Number(body.seat));
      if (seat) seat.token = null;
      for (const c of clients) if (c.seat === seat?.id) c.seat = null;
      break;
    }
    case "setup": {
      if (state.phase !== "setup") throw new HttpError(409, "Setup is locked while the clock is running");
      const n = Number(body.seatCount);
      if (n >= config.minSeats && n <= config.maxSeats) state.seatCount = n;
      state.silentFalls = Boolean(body.silentFalls);
      for (const s of body.seats ?? []) {
        const seat = state.seats.find((x) => x.id === Number(s.id));
        if (!seat) continue;
        seat.name = clampText(s.name, 40);
        seat.character = clampText(s.character, 40);
      }
      for (const m of INTERVALS) {
        const id = Number(body.clues?.[m]);
        state.clues[m] = id >= 1 && id <= state.seatCount ? id : null;
      }
      break;
    }
    case "secret": {
      for (const k of Object.keys(state.secret)) {
        if (k in body) state.secret[k] = clampText(body[k], k.endsWith("Pool") || k === "notes" ? 2000 : 60);
      }
      break;
    }
    case "check": {
      const i = Number(body.index);
      state.checklist = body.done
        ? [...new Set([...state.checklist, i])]
        : state.checklist.filter((x) => x !== i);
      break;
    }
    case "tableAudio":
      state.tableAudioReady = Boolean(body.ready);
      break;
    case "start":
      if (state.phase !== "setup") throw new HttpError(409, "Already started");
      state.clock = { startedAt: Date.now(), pausedAt: null, pausedTotal: 0 };
      state.fired = [];
      state.revealed = [];
      state.phase = "running";
      break;
    case "pause":
      if (state.phase !== "running") break;
      state.clock.pausedAt = Date.now();
      state.phase = "paused";
      break;
    case "resume":
      if (state.phase !== "paused") break;
      state.clock.pausedTotal += Date.now() - state.clock.pausedAt;
      state.clock.pausedAt = null;
      state.phase = "running";
      break;
    case "adjust": {
      // Positive seconds move the game forward (less time left).
      if (state.clock.startedAt == null) break;
      const ms = (Number(body.seconds) || 0) * 1000;
      const wantElapsed = Math.min(DURATION_MS - 1000, Math.max(0, elapsedMs() + ms));
      const now = state.clock.pausedAt ?? Date.now();
      state.clock.startedAt = now - state.clock.pausedTotal - wantElapsed / SPEED;
      if (state.phase === "ended") {
        state.phase = "paused";
        state.clock.pausedAt = now;
      }
      break;
    }
    case "reveal": {
      const m = Number(body.interval);
      const mine = seatByToken(body.token);
      const allowed = (mine && state.clues[m] === mine.id) || !PIN || body.pin === PIN;
      if (!allowed) throw new HttpError(403, "Not your clue");
      if (body.undo) state.revealed = state.revealed.filter((x) => x !== m);
      else if (!state.revealed.includes(m)) state.revealed.push(m);
      break;
    }
    case "resetClock":
      state.phase = "setup";
      state.clock = { startedAt: null, pausedAt: null, pausedTotal: 0 };
      state.fired = [];
      state.revealed = [];
      break;
    case "newGame":
      state = freshState();
      for (const c of clients) c.seat = null;
      break;
    case "whoami": {
      const mine = seatByToken(body.token);
      return { seat: mine?.id ?? null };
    }
    case "auth":
      if (PIN && body.pin !== PIN) throw new HttpError(403, "Wrong facilitator PIN");
      return { ok: true };
    default:
      throw new HttpError(400, `Unknown action ${type}`);
  }
  commit();
  return { ok: true };
}

// ---------------------------------------------------------------- HTTP

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

const PAGES = {
  "/": "index.html",
  "/join": "index.html",
  "/table": "table.html",
  "/facilitator": "facilitator.html",
  "/player": "player.html",
  "/qr": "qr.html",
};

function serveFile(req, res, file) {
  let stat;
  try {
    stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error();
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  // Range support: browsers need it to seek the soundtrack (Safari refuses audio without it).
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) {
      res.writeHead(416, { "content-range": `bytes */${stat.size}` }).end();
      return;
    }
    res.writeHead(206, {
      "content-type": type,
      "content-length": end - start + 1,
      "content-range": `bytes ${start}-${end}/${stat.size}`,
      "accept-ranges": "bytes",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file, { start, end }).on("error", () => res.destroy()).pipe(res);
    return;
  }
  res.writeHead(200, {
    "content-type": type,
    "content-length": stat.size,
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

// Resolve a request path inside a directory, refusing anything that escapes it.
function inside(dir, urlPath) {
  try {
    const file = path.join(dir, decodeURIComponent(urlPath));
    return file.startsWith(dir + path.sep) ? file : null;
  } catch {
    return null; // malformed escape
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 64_000) reject(new HttpError(413, "Too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new HttpError(400, "Bad JSON"));
      }
    });
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p === "/api/events") {
    const role = url.searchParams.get("role") ?? "player";
    const client = {
      res,
      role,
      seat: role === "player" ? seatByToken(url.searchParams.get("token"))?.id ?? null : null,
      authed: !PIN || url.searchParams.get("pin") === PIN,
    };
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    clients.add(client);
    req.on("close", () => {
      clients.delete(client);
      commitPresence();
    });
    commitPresence();
    return;
  }

  if (p === "/api/action" && req.method === "POST") {
    try {
      const result = act(await readBody(req));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }

  if (PAGES[p]) return serveFile(req, res, path.join(PUBLIC_DIR, PAGES[p]));
  if (p.startsWith("/media/")) {
    const file = inside(MEDIA_DIR, p.slice("/media/".length));
    return file ? serveFile(req, res, file) : res.writeHead(404).end();
  }
  const file = inside(PUBLIC_DIR, p.slice(1));
  return file ? serveFile(req, res, file) : res.writeHead(404).end();
}

// One bad request must never take the game down mid-session.
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end();
  });
});

// Seat presence changes don't touch saved state, so push without saving.
function commitPresence() {
  for (const c of clients) send(c);
}

server.listen(PORT, () => {
  console.log(`Alice is Missing assistant on ${joinBase()}`);
  console.log(`  table view:  ${joinBase()}/table`);
  console.log(`  facilitator: ${joinBase()}/facilitator${PIN ? " (PIN set)" : ""}`);
  if (SPEED !== 1) console.log(`  debug speed: x${SPEED}`);
  if (!soundtrack()) console.log(`  no soundtrack yet - drop an audio file in ${MEDIA_DIR}`);
});
