import { describe, expect, it } from "vitest";

import { createLimiter } from "../../lib/limits";
import { makeEntry } from "../lib/actions";
import { parseRoomCode } from "../lib/ids";
import { handleRoomRequest, handleRoomsRequest, type HandlerDeps } from "../server/handler";
import { PAGE_SIZE, ROOM_TTL_SEC, memoryRoomStore, type RoomStore } from "../server/rooms";
import type { Action, Entry } from "../types";
import { PLAYERS, TORTUGA } from "./fixtures";

const SETUP: Action = { type: "setup", players: PLAYERS, bases: [TORTUGA, TORTUGA, TORTUGA, TORTUGA], target: 15, first: 0 };
const tap = (delta = 1): Entry => makeEntry({ type: "vp", player: "p1", delta }, "device-abc123");

const generous = () => ({
  create: createLimiter({ max: 1000, windowMs: 60_000 }),
  read: createLimiter({ max: 1000, windowMs: 60_000 }),
  append: createLimiter({ max: 1000, windowMs: 60_000 }),
});

function setup(store: RoomStore | null = memoryRoomStore(), limiters = generous()) {
  const deps: HandlerDeps = { store, limiters };
  const url = (path = "") => `https://tariqsingh.ca/api/smash-up/rooms${path}`;
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handleRoomsRequest(new Request(url(), { method: "POST", body: JSON.stringify(body), headers }), deps);
  const read = (code: string, since = 0) => handleRoomRequest(new Request(url(`/${code}?since=${since}`)), code, deps);
  const append = (code: string, body: unknown) =>
    handleRoomRequest(new Request(url(`/${code}`), { method: "POST", body: JSON.stringify(body) }), code, deps);
  const create = async (entries: Entry[]) => {
    const res = await post({ entries });
    return { res, body: (await res.json()) as { code: string; cursor: number } };
  };
  return { deps, url, post, read, append, create };
}

describe("status", () => {
  it("says whether sharing is switched on", async () => {
    const on = await handleRoomsRequest(new Request("https://x.test/api/smash-up/rooms?status=1"), {
      store: memoryRoomStore(),
    });
    expect(await on.json()).toEqual({ sync: true });
    expect(on.headers.get("Cache-Control")).toContain("s-maxage=60");
    const off = await handleRoomsRequest(new Request("https://x.test/api/smash-up/rooms?status=1"), { store: null });
    expect(await off.json()).toEqual({ sync: false });
  });

  it("refuses requests from other sites", async () => {
    const api = setup();
    const res = await api.post({ entries: [makeEntry(SETUP, "device-abc123")] }, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
  });
});

describe("creating a room", () => {
  it("stores the game so far and hands back a code", async () => {
    const api = setup();
    const entries = [makeEntry(SETUP, "device-abc123"), tap()];
    const { res, body } = await api.create(entries);
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(parseRoomCode(body.code)).toBe(body.code);
    expect(body.cursor).toBe(2);

    const page = await api.read(body.code);
    expect(await page.json()).toEqual({ entries, cursor: 2, total: 2 });
  });

  it("needs a setup first, and only one", async () => {
    const api = setup();
    const setupEntry = makeEntry(SETUP, "device-abc123");
    for (const entries of [[], [tap()], [setupEntry, makeEntry(SETUP, "device-abc123")], [setupEntry, setupEntry]]) {
      expect((await api.post({ entries })).status).toBe(400);
    }
    expect((await api.post({ entries: [setupEntry, { id: "bad" }] })).status).toBe(400);
    expect((await api.post("not json")).status).toBe(400);
  });

  it("refuses too many entries", async () => {
    const api = setup();
    const entries = [makeEntry(SETUP, "device-abc123"), ...Array.from({ length: 2000 }, () => tap())];
    expect((await api.post({ entries })).status).toBe(400);
  });

  it("is switched off without a store", async () => {
    const api = setup(null);
    const res = await api.post({ entries: [makeEntry(SETUP, "device-abc123")] });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("slows down a visitor creating rooms in a loop", async () => {
    const limiters = { ...generous(), create: createLimiter({ max: 1, windowMs: 60_000 }) };
    const api = setup(memoryRoomStore(), limiters);
    expect((await api.create([makeEntry(SETUP, "device-abc123")])).res.status).toBe(201);
    const res = await api.post({ entries: [makeEntry(SETUP, "device-abc123")] });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).not.toBeNull();
  });
});

describe("reading and adding", () => {
  it("adds an entry and returns everything the sender hasn't seen", async () => {
    const api = setup();
    const first = makeEntry(SETUP, "device-abc123");
    const { body } = await api.create([first]);
    const mine = tap(2);
    const res = await api.append(body.code, { entry: mine, since: 1 });
    expect(await res.json()).toEqual({ entries: [mine], cursor: 2, total: 2 });

    const theirs = tap(3);
    const caughtUp = await api.append(body.code, { entry: theirs, since: 0 });
    expect(await caughtUp.json()).toEqual({ entries: [first, mine, theirs], cursor: 3, total: 3 });
  });

  it("keeps only known fields of what it stores", async () => {
    const api = setup();
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    const entry = tap();
    await api.append(body.code, { entry: { ...entry, extra: "x", action: { ...entry.action, more: 1 } }, since: 1 });
    expect((await (await api.read(body.code, 1)).json()).entries).toEqual([entry]);
  });

  it("reads a code typed in lower case", async () => {
    const api = setup();
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    expect((await api.read(body.code.toLowerCase())).status).toBe(200);
  });

  it("refuses a second setup, a bad entry or a bad position", async () => {
    const api = setup();
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    expect((await api.append(body.code, { entry: makeEntry(SETUP, "device-abc123"), since: 1 })).status).toBe(400);
    expect((await api.append(body.code, { entry: { id: "x" }, since: 1 })).status).toBe(400);
    expect((await api.append(body.code, { entry: tap(), since: -1 })).status).toBe(400);
    expect((await api.read(body.code, 1.5)).status).toBe(400);
  });

  it("answers 404 for a room that doesn't exist or has expired", async () => {
    let now = 1_000_000;
    const api = setup(memoryRoomStore(() => now));
    expect((await api.read("BCDFG")).status).toBe(404);
    expect((await api.read("not-a-code")).status).toBe(404);
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    now += ROOM_TTL_SEC * 1000 - 1;
    expect((await api.append(body.code, { entry: tap(), since: 1 })).status).toBe(200);
    // Each change pushes the expiry back.
    now += ROOM_TTL_SEC * 1000 - 1;
    expect((await api.read(body.code)).status).toBe(200);
    now += 2;
    const gone = await api.read(body.code);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toMatchObject({ error: "gone" });
  });

  it("answers 409 when a room is full", async () => {
    const store = memoryRoomStore();
    const api = setup({ ...store, append: async () => ({ ok: false, reason: "full" }) });
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    expect((await api.append(body.code, { entry: tap(), since: 1 })).status).toBe(409);
  });

  it("answers 503 when the store fails", async () => {
    const store = memoryRoomStore();
    const api = setup({
      ...store,
      read: async () => {
        throw new Error("down");
      },
    });
    const { body } = await api.create([makeEntry(SETUP, "device-abc123")]);
    const original = console.error;
    console.error = () => {};
    try {
      expect((await api.read(body.code)).status).toBe(503);
    } finally {
      console.error = original;
    }
  });

  it("returns a long game in pages", async () => {
    const store = memoryRoomStore();
    const api = setup(store);
    const entries = [makeEntry(SETUP, "device-abc123"), ...Array.from({ length: 700 }, () => tap())];
    const { body } = await api.create(entries);
    const first = (await (await api.read(body.code)).json()) as { entries: Entry[]; cursor: number; total: number };
    expect(first.entries).toHaveLength(PAGE_SIZE);
    expect(first.cursor).toBe(PAGE_SIZE);
    expect(first.total).toBe(701);
    const second = (await (await api.read(body.code, first.cursor)).json()) as { entries: Entry[]; cursor: number };
    expect(second.entries).toHaveLength(201);
    expect(second.cursor).toBe(701);
    expect(second.entries[200]).toEqual(entries[700]);
  });
});

describe("memoryRoomStore", () => {
  it("won't reuse a code that is in use", async () => {
    const store = memoryRoomStore();
    expect(await store.create("BCDFG", ["a"])).toBe(true);
    expect(await store.create("BCDFG", ["b"])).toBe(false);
    expect(await store.read("BCDFG", 0)).toEqual({ total: 1, items: ["a"] });
    expect(await store.append("HJKLM", "x", 0)).toEqual({ ok: false, reason: "gone" });
  });
});
