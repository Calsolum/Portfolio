import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLimiter } from "../../lib/limits";
import { makeEntry } from "../lib/actions";
import { replay } from "../lib/game";
import { handleRoomRequest, handleRoomsRequest, type HandlerDeps } from "../server/handler";
import { ROOM_TTL_SEC, memoryRoomStore } from "../server/rooms";
import { ACTIVE_MS, FAST_POLL_MS, RoomSync, SLOW_POLL_MS, httpTransport, type Transport } from "../sync/client";
import type { Action, Entry } from "../types";
import { PLAYERS, TORTUGA } from "./fixtures";

const SETUP: Action = { type: "setup", players: PLAYERS, bases: [TORTUGA, TORTUGA, TORTUGA, TORTUGA], target: 15, first: 0 };

/** The real handlers and an in-memory store behind fetch, with a switch to cut the network. */
function server() {
  const deps: HandlerDeps = {
    store: memoryRoomStore(() => Date.now()),
    limiters: {
      create: createLimiter({ max: 1000, windowMs: 60_000 }),
      read: createLimiter({ max: 10_000, windowMs: 60_000 }),
      append: createLimiter({ max: 10_000, windowMs: 60_000 }),
    },
  };
  const net = { online: true, reads: 0, appends: 0, refuse: new Set<string>() };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!net.online) throw new TypeError("Failed to fetch");
    const url = new URL(String(input), "https://tariqsingh.ca");
    // Node's Request has no HTTP cache to configure.
    const rest: RequestInit = { ...init };
    delete rest.cache;
    const request = new Request(url, rest);
    const room = url.pathname.match(/^\/api\/smash-up\/rooms\/([^/]+)$/);
    if (!room) return handleRoomsRequest(request, deps);
    if (request.method === "GET") net.reads += 1;
    else {
      net.appends += 1;
      const body = (await request.clone().json()) as { entry: Entry };
      if (net.refuse.has(body.entry.id)) return Response.json({ error: "bad_request" }, { status: 400 });
    }
    return handleRoomRequest(request, decodeURIComponent(room[1]), deps);
  }) as typeof fetch;
  return { net, transport: httpTransport(fetchImpl) as Transport };
}

/** A game shared from one phone: the room and that phone's sync. */
async function sharedGame(transport: Transport, extra: Entry[] = []) {
  const setup = makeEntry(SETUP, "phone-aaaa");
  const entries = [setup, ...extra];
  const { code, cursor } = await transport.create(entries);
  const a = new RoomSync(code, transport, { confirmed: entries, pending: [], cursor });
  return { code, setup, a };
}

/** Lets every pending request and timer up to `ms` from now run. */
const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T19:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomSync", () => {
  it("brings two phones into step, with everyone's taps in the same order", async () => {
    const { transport } = server();
    const { code, setup, a } = await sharedGame(transport);
    const b = new RoomSync(code, transport);
    a.start();
    b.start();
    await settle();
    expect(b.getSnapshot().confirmed).toEqual([setup]);

    const key = `${setup.id}:0`;
    const fromA = makeEntry({ type: "power", base: key, player: "p1", delta: 2 }, "phone-aaaa");
    const fromB = makeEntry({ type: "power", base: key, player: "p2", delta: 3 }, "phone-bbbb");
    a.add(fromA);
    b.add(fromB);
    // Each phone shows its own tap straight away.
    expect(a.getSnapshot().entries.at(-1)).toEqual(fromA);
    expect(b.getSnapshot().entries.at(-1)).toEqual(fromB);

    await settle(FAST_POLL_MS * 2);
    const orderA = a.getSnapshot().confirmed.map((entry) => entry.id);
    expect(orderA).toHaveLength(3);
    expect(b.getSnapshot().confirmed.map((entry) => entry.id)).toEqual(orderA);
    expect(a.getSnapshot().pending).toEqual([]);
    expect(b.getSnapshot().pending).toEqual([]);

    const board = replay(b.getSnapshot().entries);
    expect(board?.slots[0]?.counts.p1.power).toBe(2);
    expect(board?.slots[0]?.counts.p2.power).toBe(3);
    a.stop();
    b.stop();
  });

  it("never sends a tap twice", async () => {
    const { net, transport } = server();
    const { a } = await sharedGame(transport);
    a.start();
    for (let i = 0; i < 5; i++) a.add(makeEntry({ type: "vp", player: "p1", delta: 1 }, "phone-aaaa"));
    await settle(FAST_POLL_MS * 4);
    expect(net.appends).toBe(5);
    expect(a.getSnapshot().confirmed).toHaveLength(6);
    a.stop();
  });

  it("keeps taps made offline and sends them once the server answers again", async () => {
    const { net, transport } = server();
    const { a } = await sharedGame(transport);
    a.start();
    await settle();
    net.online = false;
    const offline = makeEntry({ type: "vp", player: "p2", delta: 1 }, "phone-aaaa");
    a.add(offline);
    await settle();
    expect(a.getSnapshot().status).toBe("offline");
    expect(a.getSnapshot().pending).toEqual([offline]);
    // Still shown on the board while it waits.
    expect(a.getSnapshot().entries.at(-1)).toEqual(offline);

    net.online = true;
    await settle(20_000);
    expect(a.getSnapshot().status).toBe("live");
    expect(a.getSnapshot().pending).toEqual([]);
    expect(a.getSnapshot().confirmed.at(-1)?.id).toBe(offline.id);
    a.stop();
  });

  it("drops a tap the server refuses so it can't hold up the rest", async () => {
    const { net, transport } = server();
    const { a } = await sharedGame(transport);
    a.start();
    const refused = makeEntry({ type: "vp", player: "p1", delta: 1 }, "phone-aaaa");
    const next = makeEntry({ type: "vp", player: "p1", delta: 2 }, "phone-aaaa");
    net.refuse.add(refused.id);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    a.add(refused);
    a.add(next);
    await settle(FAST_POLL_MS);
    expect(a.getSnapshot().confirmed.map((entry) => entry.id)).not.toContain(refused.id);
    expect(a.getSnapshot().confirmed.at(-1)?.id).toBe(next.id);
    expect(a.getSnapshot().pending).toEqual([]);
    warn.mockRestore();
    a.stop();
  });

  it("reads a long game in pages when joining", async () => {
    const { transport } = server();
    const taps = Array.from({ length: 1200 }, () => makeEntry({ type: "vp", player: "p1", delta: 1 }, "phone-aaaa"));
    const { code } = await sharedGame(transport, taps);
    const b = new RoomSync(code, transport);
    b.start();
    await settle();
    expect(b.getSnapshot().confirmed).toHaveLength(1201);
    expect(b.getSnapshot().cursor).toBe(1201);
    expect(replay(b.getSnapshot().entries)?.vp.p1).toBe(1200);
    b.stop();
  });

  it("polls quickly after a change, slowly when quiet, and not at all while hidden", async () => {
    const { net, transport } = server();
    const { a } = await sharedGame(transport);
    a.start();
    await settle();
    net.reads = 0;
    await settle(FAST_POLL_MS * 4);
    expect(net.reads).toBe(4);

    await settle(ACTIVE_MS);
    net.reads = 0;
    await settle(SLOW_POLL_MS * 3);
    expect(net.reads).toBe(3);

    a.setVisible(false);
    net.reads = 0;
    await settle(60_000);
    expect(net.reads).toBe(0);
    a.setVisible(true);
    await settle();
    expect(net.reads).toBe(1);
    a.stop();
  });

  it("stops when the room has expired, and keeps what it had", async () => {
    const { transport } = server();
    const { a, setup } = await sharedGame(transport);
    a.start();
    await settle();
    vi.setSystemTime(Date.now() + ROOM_TTL_SEC * 1000 + 1);
    await settle(SLOW_POLL_MS);
    expect(a.getSnapshot().status).toBe("gone");
    a.add(makeEntry({ type: "endTurn" }, "phone-aaaa"));
    expect(a.getSnapshot().entries).toEqual([setup]);
    a.stop();
  });

  it("starts over when the room holds less than this phone has read", async () => {
    const { transport } = server();
    const { code, setup } = await sharedGame(transport);
    const stale = new RoomSync(code, transport, { confirmed: [setup], pending: [], cursor: 40 });
    stale.start();
    await settle();
    expect(stale.getSnapshot().cursor).toBe(1);
    expect(stale.getSnapshot().confirmed).toEqual([setup]);
    stale.stop();
  });

  it("tells subscribers about changes with a new snapshot each time", async () => {
    const { transport } = server();
    const { a } = await sharedGame(transport);
    const seen: unknown[] = [];
    const unsubscribe = a.subscribe(() => seen.push(a.getSnapshot()));
    const before = a.getSnapshot();
    a.start();
    a.add(makeEntry({ type: "vp", player: "p1", delta: 1 }, "phone-aaaa"));
    expect(a.getSnapshot()).not.toBe(before);
    await settle(FAST_POLL_MS);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    unsubscribe();
    a.stop();
  });
});
