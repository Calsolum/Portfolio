// In-game messenger: messages, NPC senders, and who may see which thread.
//
// Thread keys:
//   group              everyone
//   dm:<a>-<b>         two seats, lower id first
//   npc:<npcId>:<seat> an NPC and one player (NPC posts to everyone go in `group`)
//
// While the game runs a thread is visible only to its participants; the facilitator
// sees the group and every NPC thread but never player-to-player DMs. Once the game
// has ended, everything is readable so the table can share the transcript.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_TEXT = 1000;
const MAX_MESSAGES = 10_000;

export class ChatError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createChat({ file, seatCount, gameMs, ended }) {
  const fresh = () => ({ epoch: crypto.randomBytes(4).toString("hex"), nextId: 1, nextNpc: 1, npcs: [], messages: [] });
  let data;
  try {
    data = { ...fresh(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    data = fresh();
  }

  let saveTimer = null;
  function write() {
    saveTimer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(data));
    fs.renameSync(file + ".tmp", file);
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 200);
  }

  const validSeat = (n) => Number.isInteger(n) && n >= 1 && n <= seatCount();
  const npcById = (id) => data.npcs.find((n) => n.id === id);

  // Parse a thread key into its participants, or null if it isn't a real thread.
  function parse(thread) {
    if (thread === "group") return { kind: "group" };
    let m = /^dm:(\d+)-(\d+)$/.exec(thread ?? "");
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return a < b && validSeat(a) && validSeat(b) ? { kind: "dm", seats: [a, b] } : null;
    }
    m = /^npc:(\d+):(\d+)$/.exec(thread ?? "");
    if (m) {
      const seat = Number(m[2]);
      return validSeat(seat) ? { kind: "npc", npc: Number(m[1]), seat } : null;
    }
    return null;
  }

  // viewer: { seat: number|null, facilitator: boolean }
  function canSee(viewer, thread) {
    if (ended()) return true;
    const t = parse(thread);
    if (!t) return false;
    if (t.kind === "group") return Boolean(viewer.seat || viewer.facilitator);
    if (t.kind === "dm") return t.seats.includes(viewer.seat);
    return viewer.seat === t.seat || viewer.facilitator;
  }

  // Who a message would come from, or an error if this viewer can't post there.
  function sender(viewer, thread, npcId) {
    const t = parse(thread);
    if (!t) throw new ChatError(400, "No such conversation");
    if (npcId != null) {
      const npc = npcById(Number(npcId));
      if (!viewer.facilitator) throw new ChatError(403, "Only the facilitator can text as an NPC");
      if (!npc) throw new ChatError(404, "No such NPC");
      if (t.kind === "dm" || (t.kind === "npc" && t.npc !== npc.id)) throw new ChatError(403, "That NPC isn't in this conversation");
      return { npc: npc.id, name: npc.name };
    }
    if (!viewer.seat) throw new ChatError(403, "Take a seat first");
    const inThread = t.kind === "group" || (t.kind === "dm" ? t.seats.includes(viewer.seat) : t.seat === viewer.seat);
    if (!inThread) throw new ChatError(403, "You're not in this conversation");
    if (t.kind === "npc" && !npcById(t.npc) && !data.messages.some((x) => x.thread === thread)) {
      throw new ChatError(404, "No such NPC");
    }
    return { seat: viewer.seat };
  }

  return {
    parse,
    canSee,
    sender,
    get epoch() {
      return data.epoch;
    },
    npcs: () => data.npcs,

    visibleTo(viewer) {
      return data.messages.filter((m) => canSee(viewer, m.thread));
    },

    send(viewer, thread, text, npcId) {
      const from = sender(viewer, thread, npcId);
      const body = String(text ?? "").trim().slice(0, MAX_TEXT);
      if (!body) throw new ChatError(400, "Empty message");
      const msg = { id: data.nextId++, thread, from, text: body, at: Date.now(), gameMs: gameMs() };
      data.messages.push(msg);
      if (data.messages.length > MAX_MESSAGES) data.messages.splice(0, data.messages.length - MAX_MESSAGES);
      save();
      return msg;
    },

    addNpc(name) {
      const clean = String(name ?? "").trim().slice(0, 40);
      if (!clean) throw new ChatError(400, "Give the NPC a name");
      const npc = { id: data.nextNpc++, name: clean };
      data.npcs.push(npc);
      save();
      return npc;
    },

    // Past messages keep the NPC's name, so removing one doesn't rewrite history.
    removeNpc(id) {
      data.npcs = data.npcs.filter((n) => n.id !== Number(id));
      save();
    },

    clear() {
      data = fresh();
      save();
    },

    // Write any pending save now (on shutdown).
    flush() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        write();
      }
    },
  };
}
