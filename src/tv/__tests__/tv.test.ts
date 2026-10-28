import { describe, expect, it } from "vitest";

import { createLimiter } from "../../lib/limits";
import { PLAYERS, TORTUGA, script, slotKey } from "../../smashup/__tests__/fixtures";
import { replay } from "../../smashup/lib/game";
import { memoryRoomStore, type RoomStore } from "../../smashup/server/rooms";
import type { Entry } from "../../smashup/types";
import { escapeHtml } from "../lib/html";
import { TV_PAGE } from "../page";
import { handleScreenRequest, handleScreensRequest, type TvDeps } from "../server/handler";
import { SCREEN_TTL_SEC, memoryScreenStore } from "../server/screens";
import { renderSmashUp } from "../smashup/render";

const generous = () => ({
  create: createLimiter({ max: 1000, windowMs: 60_000 }),
  poll: createLimiter({ max: 1000, windowMs: 60_000 }),
  link: createLimiter({ max: 1000, windowMs: 60_000 }),
});

type Body = { status: string; code?: string; room?: string | null; total?: number; html?: string; message?: string };

function setup(rooms: RoomStore = memoryRoomStore()) {
  const deps: TvDeps = { screens: memoryScreenStore(), rooms, limiters: generous() };
  const base = "https://tariqsingh.ca/api/tv/screens";
  const call = async (res: Promise<Response>) => {
    const r = await res;
    return { status: r.status, body: (await r.json()) as Body };
  };
  const newScreen = async () => {
    const { body } = await call(handleScreensRequest(new Request(base, { method: "POST" }), deps));
    return body.code!;
  };
  const poll = (code: string, query = "") => call(handleScreenRequest(new Request(`${base}/${code}${query}`), code, deps));
  const link = (code: string, body: unknown) =>
    call(
      handleScreenRequest(new Request(`${base}/${code}`, { method: "POST", body: JSON.stringify(body) }), code, deps),
    );
  return { deps, rooms, newScreen, poll, link };
}

async function roomWith(rooms: RoomStore, entries: Entry[], code = "BCDFG") {
  await rooms.create(
    code,
    entries.map((entry) => JSON.stringify(entry)),
  );
  return code;
}

describe("TV screens", () => {
  it("waits for a phone, then shows the linked game", async () => {
    const { rooms, newScreen, poll, link } = setup();
    const game = script();
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 3 });
    const room = await roomWith(rooms, game.entries);

    const tv = await newScreen();
    expect(tv).toMatch(/^[2-9B-Z]{5}$/);
    expect((await poll(tv)).body.status).toBe("waiting");

    expect((await link(tv, { game: "smash-up", room })).body).toMatchObject({ status: "linked", room });
    const shown = await poll(tv);
    expect(shown.body).toMatchObject({ status: "live", room, total: 2 });
    expect(shown.body.html).toContain("Tortuga");
    expect(shown.body.html).toContain("Alex");
  });

  it("answers 'same' while nothing has changed, and redraws once something has", async () => {
    const { rooms, newScreen, poll, link } = setup();
    const room = await roomWith(rooms, script().entries);
    const tv = await newScreen();
    await link(tv, { game: "smash-up", room });

    expect((await poll(tv, `?room=${room}&total=1`)).body.status).toBe("same");
    await rooms.append(
      room,
      JSON.stringify({ id: "entry-9999", by: "device-a", at: 5000, action: { type: "vp", player: "p2", delta: 2 } }),
      1,
    );
    expect((await poll(tv, `?room=${room}&total=1`)).body).toMatchObject({ status: "live", total: 2 });
  });

  it("redraws in full when the TV was showing a different game", async () => {
    const { rooms, newScreen, poll, link } = setup();
    const room = await roomWith(rooms, script().entries);
    const tv = await newScreen();
    await link(tv, { game: "smash-up", room });
    expect((await poll(tv, "?room=ZZZZZ&total=1")).body.status).toBe("live");
  });

  it("refuses a TV code that doesn't exist and a room that doesn't", async () => {
    const { rooms, newScreen, link, poll } = setup();
    const room = await roomWith(rooms, script().entries);
    expect((await link("XXXXX", { game: "smash-up", room })).status).toBe(404);
    expect((await poll("XXXXX")).body.status).toBe("gone");
    expect((await poll("not a code")).status).toBe(404);

    const tv = await newScreen();
    expect((await link(tv, { game: "smash-up", room: "QQQQQ" })).body).toMatchObject({ error: "room_gone" });
    expect((await link(tv, { game: "chess", room })).status).toBe(400);
  });

  it("goes back to its code when the game is taken off it or has expired", async () => {
    let now = 1_000_000;
    const rooms = memoryRoomStore(() => now);
    const { newScreen, poll, link } = setup(rooms);
    const room = await roomWith(rooms, script().entries);
    const tv = await newScreen();
    await link(tv, { game: "smash-up", room });

    await link(tv, { room: null });
    expect((await poll(tv)).body.status).toBe("waiting");

    await link(tv, { game: "smash-up", room });
    now += 3 * 24 * 60 * 60 * 1000;
    expect((await poll(tv)).body).toMatchObject({ status: "ended", room });
  });

  it("forgets a screen a day after it was last looked at", async () => {
    let now = 0;
    const screens = memoryScreenStore(() => now);
    await screens.create("BCDFG");
    now += (SCREEN_TTL_SEC - 10) * 1000;
    expect(await screens.read("BCDFG")).not.toBeNull();
    now += (SCREEN_TTL_SEC - 10) * 1000;
    expect(await screens.read("BCDFG")).not.toBeNull();
    now += (SCREEN_TTL_SEC + 1) * 1000;
    expect(await screens.read("BCDFG")).toBeNull();
  });

  it("refuses requests from other sites and says when it is switched off", async () => {
    const off = await handleScreensRequest(new Request("https://x.test/api/tv/screens", { method: "POST" }), {
      screens: null,
    });
    expect(off.status).toBe(503);
    const elsewhere = await handleScreensRequest(
      new Request("https://x.test/api/tv/screens", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      { screens: memoryScreenStore(), limiters: generous() },
    );
    expect(elsewhere.status).toBe(403);
  });
});

describe("the Smash Up board on TV", () => {
  it("shows the scores, whose turn it is, the bases and the latest changes", () => {
    const game = script();
    game.add({ type: "minion", base: slotKey(0), player: "p2", delta: 1, power: 4 });
    game.add({ type: "vp", player: "p1", delta: 5 });
    const html = renderSmashUp(replay(game.entries)!, "BCDFG");
    expect(html).toContain("Turn 1 · Alex to play · first to 15");
    expect(html).toContain('class="player active"');
    expect(html).toContain("Pirates + Ninjas");
    expect(html).toMatch(/class="vp">5</);
    expect(html).toContain("Jungle Oasis");
    expect(html).toContain("Alex +5 VP");
    expect(html).toContain("Game BCDFG");
  });

  it("flags a base that has reached its breakpoint", () => {
    const game = script([TORTUGA]);
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 21 });
    expect(renderSmashUp(replay(game.entries)!, "BCDFG")).toContain("SCORE IT");
  });

  it("escapes names typed at the table", () => {
    const players = [{ ...PLAYERS[0], name: '<img src=x onerror="alert(1)">' }, PLAYERS[1]];
    const html = renderSmashUp(replay(script(undefined, players).entries)!, "BCDFG");
    expect(html).not.toContain("<img");
    expect(html).toContain(escapeHtml(players[0].name));
  });

  it("names the winner", () => {
    const game = script([TORTUGA]);
    game.add({ type: "vp", player: "p2", delta: 16 });
    game.add({ type: "endTurn" });
    expect(renderSmashUp(replay(game.entries)!, "BCDFG")).toContain("Sam wins!");
  });
});

describe("the TV page", () => {
  it("keeps to JavaScript an old browser can run", () => {
    const code = TV_PAGE.slice(TV_PAGE.indexOf("<script>"), TV_PAGE.indexOf("</script>"));
    expect(code).not.toMatch(/=>|\blet\b|\bconst\b|`|\bfetch\(|\basync\b|\?\.|\?\?/);
  });
});
