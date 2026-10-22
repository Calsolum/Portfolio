import { Redis } from "@upstash/redis";

/**
 * Where shared games live. A room is one list of entries (as JSON) under its
 * code. Phones read it from where they left off and add to the end, so two
 * people tapping at once both land, in the order the server saw them.
 *
 * Upstash Redis in production, connected through the Vercel Marketplace. Each
 * read and each append is a single Lua script, so it is one command against the
 * free tier and nothing can slip in between its steps.
 */

/** A room is forgotten two days after its last change. */
export const ROOM_TTL_SEC = 48 * 60 * 60;
/** A long game is a few hundred entries; this stops a runaway client filling a room. */
export const MAX_ROOM_ENTRIES = 5000;
/** Entries returned per read; a phone joining a long game reads a few pages. */
export const PAGE_SIZE = 500;

export interface RoomPage {
  /** How many entries the room holds. */
  total: number;
  /** Entries from the requested position on, at most PAGE_SIZE. */
  items: string[];
}

export type AppendResult = ({ ok: true } & RoomPage) | { ok: false; reason: "gone" | "full" };

export interface RoomStore {
  /** False when the code is already in use. */
  create(code: string, items: readonly string[]): Promise<boolean>;
  /** Null when there is no such room, or it has expired. */
  read(code: string, since: number): Promise<RoomPage | null>;
  /** Adds one entry and returns everything from `since` on, so the sender catches up in the same request. */
  append(code: string, item: string, since: number): Promise<AppendResult>;
}

const keyOf = (code: string) => `smash-up:room:${code}`;

// KEYS[1] room; ARGV[1] ttl, ARGV[2...] entries. Pushed in batches to stay inside Lua's argument limit.
const CREATE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
for i = 2, #ARGV, 500 do
  redis.call('RPUSH', KEYS[1], unpack(ARGV, i, math.min(i + 499, #ARGV)))
end
redis.call('EXPIRE', KEYS[1], ARGV[1])
return 1
`;

// KEYS[1] room; ARGV[1] since, ARGV[2] page size. Returns {-1} for no room, else {total, entries...}.
const READ = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1} end
local since = tonumber(ARGV[1])
local items = redis.call('LRANGE', KEYS[1], since, since + tonumber(ARGV[2]) - 1)
table.insert(items, 1, redis.call('LLEN', KEYS[1]))
return items
`;

// KEYS[1] room; ARGV[1] entry, ARGV[2] since, ARGV[3] page size, ARGV[4] ttl, ARGV[5] cap.
// Returns {-1} for no room, {-2} when full, else {total, entries from since...}.
const APPEND = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1} end
if redis.call('LLEN', KEYS[1]) >= tonumber(ARGV[5]) then return {-2} end
local total = redis.call('RPUSH', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[4])
local since = tonumber(ARGV[2])
local items = redis.call('LRANGE', KEYS[1], since, since + tonumber(ARGV[3]) - 1)
table.insert(items, 1, total)
return items
`;

/** The script's {total, entries...} reply as a page; null for the "no room" marker. */
function toPage(reply: unknown): RoomPage | null {
  if (!Array.isArray(reply) || typeof reply[0] !== "number" || reply[0] < 0) return null;
  return { total: reply[0], items: reply.slice(1).filter((item): item is string => typeof item === "string") };
}

export function redisRoomStore(redis: Redis): RoomStore {
  return {
    async create(code, items) {
      const created = await redis.eval<string[], number>(CREATE, [keyOf(code)], [String(ROOM_TTL_SEC), ...items]);
      return created === 1;
    },
    async read(code, since) {
      return toPage(await redis.eval<string[], unknown>(READ, [keyOf(code)], [String(since), String(PAGE_SIZE)]));
    },
    async append(code, item, since) {
      const reply = await redis.eval<string[], unknown>(APPEND, [keyOf(code)], [
        item,
        String(since),
        String(PAGE_SIZE),
        String(ROOM_TTL_SEC),
        String(MAX_ROOM_ENTRIES),
      ]);
      if (Array.isArray(reply) && reply[0] === -2) return { ok: false, reason: "full" };
      const page = toPage(reply);
      return page ? { ok: true, ...page } : { ok: false, reason: "gone" };
    },
  };
}

/** The same behaviour in memory, for tests and for trying sync locally without a database. */
export function memoryRoomStore(now: () => number = Date.now): RoomStore {
  const rooms = new Map<string, { items: string[]; expires: number }>();
  const live = (code: string) => {
    const room = rooms.get(code);
    if (room && room.expires <= now()) rooms.delete(code);
    return rooms.get(code);
  };
  const page = (items: string[], since: number): RoomPage => ({
    total: items.length,
    items: items.slice(since, since + PAGE_SIZE),
  });

  return {
    async create(code, items) {
      if (live(code)) return false;
      rooms.set(code, { items: [...items], expires: now() + ROOM_TTL_SEC * 1000 });
      return true;
    },
    async read(code, since) {
      const room = live(code);
      return room ? page(room.items, since) : null;
    },
    async append(code, item, since) {
      const room = live(code);
      if (!room) return { ok: false, reason: "gone" };
      if (room.items.length >= MAX_ROOM_ENTRIES) return { ok: false, reason: "full" };
      room.items.push(item);
      room.expires = now() + ROOM_TTL_SEC * 1000;
      return { ok: true, ...page(room.items, since) };
    },
  };
}

// Kept on globalThis so the dev server's module reloads don't empty it.
const shared = globalThis as typeof globalThis & { smashUpMemoryRooms?: RoomStore };

/**
 * Upstash when its environment variables are set (the Vercel integration names
 * them KV_REST_API_*, Upstash's own docs UPSTASH_REDIS_REST_*). Otherwise rooms
 * kept in memory when asked for or in development, and no sync at all in a
 * production build without a database.
 */
export function roomStoreFromEnv(env: Record<string, string | undefined> = process.env): RoomStore | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) return redisRoomStore(new Redis({ url, token, automaticDeserialization: false }));
  if (env.SMASHUP_ROOMS === "memory" || env.NODE_ENV === "development") {
    shared.smashUpMemoryRooms ??= memoryRoomStore();
    return shared.smashUpMemoryRooms;
  }
  return null;
}
