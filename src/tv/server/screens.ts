import { Redis } from "@upstash/redis";

/**
 * TV screens. A TV opens /tv and gets a short code of its own; a phone at the
 * table types that code to put its game on the TV. The screen remembers only
 * which game to show, so the TV never has to type anything with a gamepad.
 *
 * Kept in the same Upstash Redis as the shared Smash Up rooms.
 */

/** A screen nobody has looked at for a day is forgotten; the TV just asks for a new code. */
export const SCREEN_TTL_SEC = 24 * 60 * 60;

export type TvGame = "smash-up";
export const TV_GAMES: readonly TvGame[] = ["smash-up"];

/** What a screen is showing; `room` is null until a phone links a game. */
export interface ScreenLink {
  game: TvGame | null;
  room: string | null;
}

export interface ScreenStore {
  /** False when the code is already in use. */
  create(code: string): Promise<boolean>;
  /** Null when there is no such screen, or it has expired. Reading keeps it alive. */
  read(code: string): Promise<ScreenLink | null>;
  /** False when there is no such screen. */
  link(code: string, link: ScreenLink): Promise<boolean>;
}

const EMPTY: ScreenLink = { game: null, room: null };
const keyOf = (code: string) => `tv:screen:${code}`;

function parseLink(text: unknown): ScreenLink | null {
  if (typeof text !== "string") return null;
  try {
    const value = JSON.parse(text) as Partial<ScreenLink>;
    const game = TV_GAMES.includes(value.game as TvGame) ? (value.game as TvGame) : null;
    const room = typeof value.room === "string" ? value.room : null;
    return game && room ? { game, room } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function redisScreenStore(redis: Redis): ScreenStore {
  return {
    async create(code) {
      const set = await redis.set(keyOf(code), JSON.stringify(EMPTY), { nx: true, ex: SCREEN_TTL_SEC });
      return set === "OK";
    },
    async read(code) {
      // One command: the read and the new expiry together.
      return parseLink(await redis.getex(keyOf(code), { ex: SCREEN_TTL_SEC }));
    },
    async link(code, link) {
      const set = await redis.set(keyOf(code), JSON.stringify(link), { xx: true, ex: SCREEN_TTL_SEC });
      return set === "OK";
    },
  };
}

/** The same behaviour in memory, for tests and for the dev server. */
export function memoryScreenStore(now: () => number = Date.now): ScreenStore {
  const screens = new Map<string, { link: ScreenLink; expires: number }>();
  const live = (code: string) => {
    const screen = screens.get(code);
    if (screen && screen.expires <= now()) screens.delete(code);
    return screens.get(code);
  };
  const expiry = () => now() + SCREEN_TTL_SEC * 1000;

  return {
    async create(code) {
      if (live(code)) return false;
      screens.set(code, { link: EMPTY, expires: expiry() });
      return true;
    },
    async read(code) {
      const screen = live(code);
      if (!screen) return null;
      screen.expires = expiry();
      return screen.link;
    },
    async link(code, link) {
      const screen = live(code);
      if (!screen) return false;
      screens.set(code, { link, expires: expiry() });
      return true;
    },
  };
}

const shared = globalThis as typeof globalThis & { tvMemoryScreens?: ScreenStore };

/** Upstash when it is configured, as for the Smash Up rooms; memory in development; otherwise off. */
export function screenStoreFromEnv(env: Record<string, string | undefined> = process.env): ScreenStore | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) return redisScreenStore(new Redis({ url, token, automaticDeserialization: false }));
  if (env.SMASHUP_ROOMS === "memory" || env.NODE_ENV === "development") {
    shared.tvMemoryScreens ??= memoryScreenStore();
    return shared.tvMemoryScreens;
  }
  return null;
}
