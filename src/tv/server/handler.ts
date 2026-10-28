import { createLimiter, type Limiter } from "../../lib/limits";
import { isRecord, parseEntries } from "../../smashup/lib/actions";
import { replay } from "../../smashup/lib/game";
import { newRoomCode, parseRoomCode } from "../../smashup/lib/ids";
import { MAX_ROOM_ENTRIES, roomStoreFromEnv, type RoomStore } from "../../smashup/server/rooms";
import { renderSmashUp } from "../smashup/render";
import { TV_GAMES, screenStoreFromEnv, type ScreenStore, type TvGame } from "./screens";

/**
 * The HTTP side of the TV display, kept apart from the route files so it can be
 * tested; the routes are one-line wrappers.
 *
 *   POST /api/tv/screens                     a new screen code for a TV
 *   GET  /api/tv/screens/CODE?room=R&total=N what the TV should show; "same" when nothing has changed
 *   POST /api/tv/screens/CODE                {game, room} from a phone: show that game (room null to clear)
 *
 * Screen codes look like room codes (five letters and digits, nothing that
 * reads as a word) but are kept apart from them.
 */

export interface TvDeps {
  /** Null when the database is switched off. */
  screens?: ScreenStore | null;
  rooms?: RoomStore | null;
  limiters?: { create: Limiter; poll: Limiter; link: Limiter };
}

/** A TV polls every couple of seconds for hours, so polling is allowed generously. */
const defaultLimiters = {
  create: createLimiter({ max: 30, windowMs: 60 * 60_000 }),
  poll: createLimiter({ max: 120, windowMs: 60_000 }),
  link: createLimiter({ max: 30, windowMs: 60_000 }),
};

let envScreens: ScreenStore | null | undefined;
let envRooms: RoomStore | null | undefined;
const defaultScreens = () => (envScreens === undefined ? (envScreens = screenStoreFromEnv()) : envScreens);
const defaultRooms = () => (envRooms === undefined ? (envRooms = roomStoreFromEnv()) : envRooms);

const MAX_LINK_BODY = 500;

const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

const problem = (status: number, error: string, message: string, headers: HeadersInit = {}) =>
  json({ status: "error", error, message }, status, headers);

function visitorKey(request: Request): string {
  return (
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

function fromElsewhere(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

function limited(limiter: Limiter, key: string): Response | null {
  const outcome = limiter.take(key);
  return outcome.ok
    ? null
    : problem(429, "rate_limited", "Too many requests. Wait a moment.", { "Retry-After": String(outcome.retryAfterSec) });
}

function unavailable(err: unknown): Response {
  console.error("[tv] store failed", err);
  return problem(503, "unavailable", "The TV display isn't working right now. It will try again.");
}

/** Every entry in a room, page by page; null when the room has gone. */
async function readAll(rooms: RoomStore, code: string): Promise<{ items: string[]; total: number } | null> {
  const items: string[] = [];
  let total = Infinity;
  while (items.length < total) {
    const page = await rooms.read(code, items.length);
    if (!page) return null;
    total = page.total;
    if (page.items.length === 0) break;
    items.push(...page.items);
  }
  return { items, total: items.length };
}

/** The board as the TV draws it, from the room's entries. */
function render(game: TvGame, room: string, items: readonly string[]): string | null {
  switch (game) {
    case "smash-up": {
      const state = replay(parseEntries(items.map((item) => JSON.parse(item) as unknown)));
      return state ? renderSmashUp(state, room) : null;
    }
  }
}

export async function handleScreensRequest(request: Request, deps: TvDeps = {}): Promise<Response> {
  const screens = deps.screens === undefined ? defaultScreens() : deps.screens;
  const limiters = deps.limiters ?? defaultLimiters;
  if (fromElsewhere(request)) return problem(403, "forbidden", "This endpoint is only for the TV display.");
  if (!screens) return problem(503, "not_configured", "The TV display isn't switched on for this site.");
  const tooMany = limited(limiters.create, visitorKey(request));
  if (tooMany) return tooMany;

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      if (await screens.create(code)) return json({ status: "created", code }, 201);
    }
    return unavailable(new Error("no free screen code after 5 tries"));
  } catch (err) {
    return unavailable(err);
  }
}

export async function handleScreenRequest(request: Request, rawCode: string, deps: TvDeps = {}): Promise<Response> {
  const screens = deps.screens === undefined ? defaultScreens() : deps.screens;
  const rooms = deps.rooms === undefined ? defaultRooms() : deps.rooms;
  const limiters = deps.limiters ?? defaultLimiters;
  if (fromElsewhere(request)) return problem(403, "forbidden", "This endpoint is only for the TV display.");
  if (!screens || !rooms) return problem(503, "not_configured", "The TV display isn't switched on for this site.");

  const code = parseRoomCode(rawCode);
  if (!code) return json({ status: "gone", message: "There is no TV with that code." }, 404);
  const visitor = `${visitorKey(request)} ${code}`;

  if (request.method === "GET") {
    const tooMany = limited(limiters.poll, visitor);
    if (tooMany) return tooMany;
    const params = new URL(request.url).searchParams;
    const shown = parseRoomCode(params.get("room"));
    const total = Number(params.get("total"));

    try {
      const link = await screens.read(code);
      if (!link) return json({ status: "gone", message: "This TV code has expired." }, 404);
      if (!link.game || !link.room) return json({ status: "waiting", code });

      // The TV says what it already has, so a quiet table costs one short read.
      if (shown === link.room && Number.isInteger(total) && total > 0 && total <= MAX_ROOM_ENTRIES) {
        const page = await rooms.read(link.room, total);
        if (!page) return json({ status: "ended", code, room: link.room });
        if (page.total === total) return json({ status: "same" });
      }
      const all = await readAll(rooms, link.room);
      if (!all) return json({ status: "ended", code, room: link.room });
      const html = render(link.game, link.room, all.items);
      if (html === null) return json({ status: "ended", code, room: link.room });
      return json({ status: "live", code, game: link.game, room: link.room, total: all.total, html });
    } catch (err) {
      return unavailable(err);
    }
  }

  const tooMany = limited(limiters.link, visitor);
  if (tooMany) return tooMany;
  const text = await request.text().catch(() => "");
  let body: unknown = null;
  try {
    body = text.length <= MAX_LINK_BODY ? (JSON.parse(text) as unknown) : null;
  } catch {
    // Not JSON: refused below.
  }
  const game = isRecord(body) && TV_GAMES.includes(body.game as TvGame) ? (body.game as TvGame) : null;
  const room = isRecord(body) && body.room !== null ? parseRoomCode(body.room) : null;
  const clearing = isRecord(body) && body.room === null;
  if (!clearing && (!game || !room)) return problem(400, "bad_request", "That game couldn't be put on the TV.");

  try {
    if (room) {
      // Past the end of any room: no entries come back, only whether it exists.
      const exists = await rooms.read(room, MAX_ROOM_ENTRIES);
      if (!exists) return problem(404, "room_gone", "That shared game has ended or expired.");
    }
    const linked = await screens.link(code, clearing ? { game: null, room: null } : { game, room });
    if (!linked) return problem(404, "gone", "There is no TV showing that code. Check the code on the TV.");
    return json({ status: "linked", code, room: clearing ? null : room });
  } catch (err) {
    return unavailable(err);
  }
}
