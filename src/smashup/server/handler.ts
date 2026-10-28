import { createLimiter, type Limiter } from "../../lib/limits";
import { isRecord, parseEntry } from "../lib/actions";
import { newRoomCode, parseRoomCode } from "../lib/ids";
import type { Entry } from "../types";
import { MAX_ROOM_ENTRIES, roomStoreFromEnv, type RoomStore } from "./rooms";

/**
 * The HTTP side of the shared-game API, kept apart from the route files so it
 * can be tested; the routes are one-line wrappers.
 *
 *   GET  /api/smash-up/rooms?status=1        whether sharing is switched on
 *   POST /api/smash-up/rooms                 a new room holding a game so far
 *   GET  /api/smash-up/rooms/CODE?since=N    entries from position N on
 *   POST /api/smash-up/rooms/CODE            one new entry, plus what the sender hasn't seen
 */

/** A shared game can start part-way through; a long game is a few hundred entries. */
export const MAX_INITIAL_ENTRIES = 2000;
/** A setup with six players and eight bases is under 2 KB. */
export const MAX_ENTRY_BYTES = 4000;
const MAX_CREATE_BODY = 1_000_000;
const MAX_APPEND_BODY = 8000;

/** Per instance, and generous, because phones on the same Wi-Fi share one address. */
const defaultLimiters = {
  create: createLimiter({ max: 10, windowMs: 60 * 60_000 }),
  read: createLimiter({ max: 900, windowMs: 60_000 }),
  append: createLimiter({ max: 300, windowMs: 60_000 }),
};

export interface HandlerDeps {
  /** Null when sharing is switched off. */
  store?: RoomStore | null;
  limiters?: { create: Limiter; read: Limiter; append: Limiter };
}

let envStore: RoomStore | null | undefined;
const defaultStore = () => (envStore === undefined ? (envStore = roomStoreFromEnv()) : envStore);

const NO_STORE = { "Cache-Control": "no-store" };

function problem(status: number, error: string, message: string, headers: HeadersInit = {}): Response {
  return Response.json({ error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Vercel sets x-real-ip and x-forwarded-for itself, so a visitor cannot choose their own. */
function visitorKey(request: Request): string {
  return (
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

/** Browsers say where a request came from; another site driving this API is refused. */
function fromElsewhere(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

function limited(limiter: Limiter, key: string): Response | null {
  const outcome = limiter.take(key);
  return outcome.ok
    ? null
    : problem(429, "rate_limited", "Too many changes at once. Wait a moment and it will catch up.", {
        "Retry-After": String(outcome.retryAfterSec),
      });
}

/** The JSON body, or null if it is missing, too big or not JSON. */
async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Entries were checked and re-serialised on the way in, so they are sent back as stored. */
function pageResponse(items: readonly string[], since: number, total: number): Response {
  return new Response(`{"entries":[${items.join(",")}],"cursor":${since + items.length},"total":${total}}`, {
    headers: { "Content-Type": "application/json", ...NO_STORE },
  });
}

/** A checked entry as stored: re-serialised from the parsed copy, so only known fields are kept. */
function serialise(entry: Entry): string | null {
  const json = JSON.stringify(entry);
  return json.length <= MAX_ENTRY_BYTES ? json : null;
}

function unavailable(err: unknown): Response {
  console.error("[smash-up] room store failed", err);
  return problem(503, "unavailable", "Sharing isn't working right now. Your taps are kept and will be sent again.");
}

export async function handleRoomsRequest(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const limiters = deps.limiters ?? defaultLimiters;
  if (fromElsewhere(request)) return problem(403, "forbidden", "This endpoint is only for the Smash Up tracker.");

  if (request.method === "GET") {
    if (!new URL(request.url).searchParams.has("status")) return problem(400, "bad_request", "Nothing to show here.");
    // The page asks once, so it can leave the Share button out when sharing is off.
    return Response.json(
      { sync: store !== null },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }

  if (!store) return problem(503, "not_configured", "Sharing games isn't switched on for this site.");
  const tooMany = limited(limiters.create, visitorKey(request));
  if (tooMany) return tooMany;

  const body = await readJson(request, MAX_CREATE_BODY);
  const raw = isRecord(body) ? body.entries : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_INITIAL_ENTRIES) {
    return problem(400, "bad_request", "That game couldn't be shared.");
  }
  const items: string[] = [];
  const ids = new Set<string>();
  for (const [i, value] of raw.entries()) {
    const entry = parseEntry(value);
    // A room starts with its setup and holds one setup only.
    const json =
      entry && (i === 0) === (entry.action.type === "setup") && !ids.has(entry.id) ? serialise(entry) : null;
    if (!entry || !json) return problem(400, "bad_request", "That game couldn't be shared.");
    ids.add(entry.id);
    items.push(json);
  }

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      if (await store.create(code, items)) {
        return Response.json({ code, cursor: items.length }, { status: 201, headers: NO_STORE });
      }
    }
    return unavailable(new Error("no free room code after 5 tries"));
  } catch (err) {
    return unavailable(err);
  }
}

export async function handleRoomRequest(request: Request, rawCode: string, deps: HandlerDeps = {}): Promise<Response> {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const limiters = deps.limiters ?? defaultLimiters;
  if (fromElsewhere(request)) return problem(403, "forbidden", "This endpoint is only for the Smash Up tracker.");
  if (!store) return problem(503, "not_configured", "Sharing games isn't switched on for this site.");

  const code = parseRoomCode(rawCode);
  if (!code) return problem(404, "gone", "There is no shared game with that code.");
  const visitor = `${visitorKey(request)} ${code}`;

  if (request.method === "GET") {
    const tooMany = limited(limiters.read, visitor);
    if (tooMany) return tooMany;
    const since = Number(new URL(request.url).searchParams.get("since") ?? 0);
    if (!Number.isInteger(since) || since < 0 || since > MAX_ROOM_ENTRIES) {
      return problem(400, "bad_request", "That position isn't in the game.");
    }
    try {
      const page = await store.read(code, since);
      if (!page) return problem(404, "gone", "This shared game has ended or expired.");
      return pageResponse(page.items, since, page.total);
    } catch (err) {
      return unavailable(err);
    }
  }

  const tooMany = limited(limiters.append, visitor);
  if (tooMany) return tooMany;
  const body = await readJson(request, MAX_APPEND_BODY);
  const entry = isRecord(body) ? parseEntry(body.entry) : null;
  const since = isRecord(body) ? body.since : null;
  const json = entry && entry.action.type !== "setup" ? serialise(entry) : null;
  if (!json || typeof since !== "number" || !Number.isInteger(since) || since < 0 || since > MAX_ROOM_ENTRIES) {
    return problem(400, "bad_request", "That change couldn't be read.");
  }

  try {
    const result = await store.append(code, json, since);
    if (result.ok) return pageResponse(result.items, since, result.total);
    return result.reason === "full"
      ? problem(409, "full", "This shared game has run out of room. Carry on here on this device.")
      : problem(404, "gone", "This shared game has ended or expired.");
  } catch (err) {
    return unavailable(err);
  }
}
