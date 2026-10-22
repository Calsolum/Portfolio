import { describe, expect, it } from "vitest";

import { findBase, lastUndoable, replay } from "../lib/game";
import type { GameState } from "../types";
import { CUSTOM, JUNGLE_OASIS, SETUP_ID, TORTUGA, script, slotKey } from "./fixtures";

const play = (entries: Parameters<typeof replay>[0]): GameState => {
  const state = replay(entries);
  if (!state) throw new Error("no game");
  return state;
};

const countsAt = (state: GameState, slot: number, player: string) => state.slots[slot]?.counts[player];
const statusOf = (state: GameState, id: string) => state.log.find((line) => line.id === id)?.status;
const textOf = (state: GameState, id: string) => state.log.find((line) => line.id === id)?.text;

describe("setup", () => {
  it("deals the starting bases with empty counts and starts with the first player", () => {
    const state = play(script().entries);
    expect(state.id).toBe(SETUP_ID);
    expect(state.slots.map((base) => base?.key)).toEqual([0, 1, 2, 3].map(slotKey));
    expect(countsAt(state, 0, "p2")).toEqual({ power: 0, temp: 0, minions: 0 });
    expect(state.vp).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(state.turn).toEqual({ player: 0, number: 1 });
    expect(state.seen).toEqual(["tortuga", "jungle-oasis", "ninja-dojo", "the-homeworld"]);
    expect(state.result).toBeNull();
    expect(state.log.map((line) => line.text)).toEqual(["New game: Alex, Sam, Kim"]);
  });

  it("needs a setup first", () => {
    expect(replay([])).toBeNull();
    const { entries } = script();
    expect(replay(entries.slice(1))).toBeNull();
    expect(replay([{ ...entries[0], action: { type: "endTurn" } }])).toBeNull();
  });

  it("ignores a second setup and an entry seen twice", () => {
    const game = script();
    const id = game.add({ type: "power", base: slotKey(0), player: "p1", delta: 2 });
    game.entries.push({ ...game.entries[0], id: "another-setup" });
    game.entries.push({ ...game.entries[1] });
    const state = play(game.entries);
    expect(countsAt(state, 0, "p1")?.power).toBe(2);
    expect(state.log.map((line) => line.id)).toEqual([SETUP_ID, id]);
  });
});

describe("counters", () => {
  it("adds power, power this turn and minions, and never takes power or minions below 0", () => {
    const game = script();
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 3 });
    game.add({ type: "minions", base: slotKey(0), player: "p1", delta: 1 });
    game.add({ type: "temp", base: slotKey(0), player: "p1", delta: -2 });
    const clamped = game.add({ type: "power", base: slotKey(0), player: "p2", delta: -1 });
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: -5 });
    const state = play(game.entries);
    expect(countsAt(state, 0, "p1")).toEqual({ power: 0, temp: -2, minions: 1 });
    expect(statusOf(state, clamped)).toBe("skipped");
  });

  it("writes the log in plain words", () => {
    const game = script();
    const power = game.add({ type: "power", base: slotKey(0), player: "p1", delta: 2 });
    const temp = game.add({ type: "temp", base: slotKey(0), player: "p2", delta: -3 });
    const minion = game.add({ type: "minions", base: slotKey(1), player: "p2", delta: 1 });
    const minions = game.add({ type: "minions", base: slotKey(1), player: "p3", delta: 2 });
    const breakpoint = game.add({ type: "breakpoint", base: slotKey(0), delta: -2 });
    const vp = game.add({ type: "vp", player: "p3", delta: -1 });
    const state = play(game.entries);
    expect([power, temp, minion, minions, breakpoint, vp].map((id) => textOf(state, id))).toEqual([
      "Alex +2 power on Tortuga",
      "Sam −3 power this turn on Tortuga",
      "Sam +1 minion on Jungle Oasis",
      "Kim +2 minions on Jungle Oasis",
      "Tortuga breakpoint −2",
      "Kim −1 VP",
    ]);
  });

  it("changes a breakpoint but never below 0", () => {
    const game = script();
    game.add({ type: "breakpoint", base: slotKey(0), delta: 2 });
    let state = play(game.entries);
    expect(state.slots[0]?.breakpointDelta).toBe(2);
    game.add({ type: "breakpoint", base: slotKey(0), delta: -50 });
    state = play(game.entries);
    expect(state.slots[0]?.breakpointDelta).toBe(-TORTUGA.breakpoint);
  });

  it("skips a change to a player who isn't in the game", () => {
    const game = script();
    const id = game.add({ type: "power", base: slotKey(0), player: "p6", delta: 2 });
    const vp = game.add({ type: "vp", player: "p6", delta: 2 });
    const state = play(game.entries);
    expect(statusOf(state, id)).toBe("skipped");
    expect(statusOf(state, vp)).toBe("skipped");
    expect(textOf(state, id)).toBe("Someone +2 power on Tortuga");
  });
});

describe("scoring and new bases", () => {
  it("adds the awards, records the power and empties the slot", () => {
    const game = script();
    game.add({ type: "power", base: slotKey(1), player: "p1", delta: 9 });
    game.add({ type: "temp", base: slotKey(1), player: "p1", delta: 1 });
    game.add({ type: "power", base: slotKey(1), player: "p2", delta: 2 });
    const score = game.add({
      type: "score",
      base: slotKey(1),
      awards: [
        { player: "p1", vp: 2 },
        { player: "p2", vp: 0 },
      ],
    });
    const state = play(game.entries);
    expect(state.vp).toEqual({ p1: 2, p2: 0, p3: 0 });
    expect(state.slots[1]).toBeNull();
    expect(state.scored).toEqual([
      {
        entry: score,
        base: JUNGLE_OASIS,
        turn: 1,
        power: { p1: 10, p2: 2, p3: 0 },
        awards: [
          { player: "p1", vp: 2 },
          { player: "p2", vp: 0 },
        ],
      },
    ]);
    expect(textOf(state, score)).toBe("Jungle Oasis scored: Alex 2");
  });

  it("skips taps on a base that has already scored", () => {
    const game = script();
    game.add({ type: "score", base: slotKey(0), awards: [] });
    const late = game.add({ type: "power", base: slotKey(0), player: "p1", delta: 1 }, "device-b");
    const state = play(game.entries);
    expect(statusOf(state, late)).toBe("skipped");
    expect(textOf(state, late)).toBe("Alex +1 power on a base no longer in play");
    expect(state.log.find((line) => line.type === "score")?.text).toBe("Tortuga scored with no points paid");
  });

  it("places the next base only in an empty slot", () => {
    const game = script();
    game.add({ type: "score", base: slotKey(2), awards: [] });
    const place = game.add({ type: "place", slot: 2, base: CUSTOM });
    const second = game.add({ type: "place", slot: 2, base: TORTUGA }, "device-b");
    const outside = game.add({ type: "place", slot: 7, base: TORTUGA });
    const state = play(game.entries);
    expect(state.slots[2]?.key).toBe(`${place}:2`);
    expect(state.slots[2]?.base).toEqual(CUSTOM);
    expect(state.slots[2]?.counts.p3).toEqual({ power: 0, temp: 0, minions: 0 });
    expect(statusOf(state, second)).toBe("skipped");
    expect(statusOf(state, outside)).toBe("skipped");
    expect(textOf(state, place)).toBe("Next base: House base");
    // A custom base has no card id, so it adds nothing to the bases seen.
    expect(state.seen).toHaveLength(4);
  });

  it("swaps a base for another and keeps its minions", () => {
    const game = script();
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 4 });
    game.add({ type: "breakpoint", base: slotKey(0), delta: 3 });
    const swap = game.add({ type: "swap", base: slotKey(0), to: JUNGLE_OASIS });
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 1 });
    const state = play(game.entries);
    const base = findBase(state, slotKey(0));
    expect(base?.base).toEqual(JUNGLE_OASIS);
    expect(base?.breakpointDelta).toBe(0);
    expect(base?.counts.p1.power).toBe(5);
    expect(state.seen.at(-1)).toBe("jungle-oasis");
    expect(textOf(state, swap)).toBe("Tortuga swapped for Jungle Oasis");
  });
});

describe("turns and the end of the game", () => {
  it("clears power this turn and passes to the next player", () => {
    const game = script();
    game.add({ type: "temp", base: slotKey(0), player: "p1", delta: 2 });
    game.add({ type: "power", base: slotKey(0), player: "p1", delta: 3 });
    const end = game.add({ type: "endTurn" });
    let state = play(game.entries);
    expect(countsAt(state, 0, "p1")).toEqual({ power: 3, temp: 0, minions: 0 });
    expect(state.turn).toEqual({ player: 1, number: 2 });
    expect(textOf(state, end)).toBe("Alex ended turn 1");

    game.add({ type: "endTurn" });
    game.add({ type: "endTurn" });
    state = play(game.entries);
    expect(state.turn).toEqual({ player: 0, number: 4 });
  });

  it("names the winner at the end of the turn in which someone reaches the target", () => {
    const game = script();
    game.add({ type: "vp", player: "p2", delta: 15 });
    expect(play(game.entries).result).toBeNull();
    game.add({ type: "endTurn" });
    expect(play(game.entries).result).toEqual({ kind: "won", winner: "p2", at: 1_002 });
  });

  it("plays on while the lead is shared, then names the winner", () => {
    const game = script();
    game.add({ type: "vp", player: "p1", delta: 15 });
    game.add({ type: "vp", player: "p3", delta: 15 });
    game.add({ type: "endTurn" });
    expect(play(game.entries).result).toEqual({ kind: "tied", leaders: ["p1", "p3"] });
    game.add({ type: "vp", player: "p3", delta: 1 });
    game.add({ type: "endTurn" });
    expect(play(game.entries).result).toMatchObject({ kind: "won", winner: "p3" });
  });

  it("keeps a win once it is declared", () => {
    const game = script(undefined, undefined, 10);
    game.add({ type: "vp", player: "p1", delta: 10 });
    game.add({ type: "endTurn" });
    game.add({ type: "vp", player: "p2", delta: 20 });
    game.add({ type: "endTurn" });
    expect(play(game.entries).result).toMatchObject({ kind: "won", winner: "p1" });
  });
});

describe("undo", () => {
  it("takes back a scoring: the base returns with its counts and the VP go", () => {
    const game = script();
    game.add({ type: "power", base: slotKey(1), player: "p1", delta: 12 });
    const score = game.add({ type: "score", base: slotKey(1), awards: [{ player: "p1", vp: 2 }] });
    game.add({ type: "undo", target: score });
    const state = play(game.entries);
    expect(state.slots[1]?.counts.p1.power).toBe(12);
    expect(state.vp.p1).toBe(0);
    expect(state.scored).toEqual([]);
    expect(statusOf(state, score)).toBe("undone");
    // The undo itself has no line; it marks the line it took back.
    expect(state.log.some((line) => line.type === "undo")).toBe(false);
  });

  it("lets taps that missed a scored base count again once that scoring is undone", () => {
    const game = script();
    const score = game.add({ type: "score", base: slotKey(0), awards: [] });
    const tap = game.add({ type: "power", base: slotKey(0), player: "p2", delta: 1 }, "device-b");
    expect(statusOf(play(game.entries), tap)).toBe("skipped");
    game.add({ type: "undo", target: score });
    const state = play(game.entries);
    expect(statusOf(state, tap)).toBe("done");
    expect(countsAt(state, 0, "p2")?.power).toBe(1);
  });

  it("can't take back the setup or another undo", () => {
    const game = script();
    const power = game.add({ type: "power", base: slotKey(0), player: "p1", delta: 2 });
    const undo = game.add({ type: "undo", target: power });
    game.add({ type: "undo", target: undo });
    game.add({ type: "undo", target: SETUP_ID });
    game.add({ type: "undo", target: "no-such-entry" });
    const state = play(game.entries);
    expect(countsAt(state, 0, "p1")?.power).toBe(0);
    expect(state.log.map((line) => line.status)).toEqual(["done", "undone"]);
  });

  it("finds the newest change to take back, from one device or from anyone", () => {
    const game = script();
    const mine = game.add({ type: "power", base: slotKey(0), player: "p1", delta: 2 }, "device-a");
    const theirs = game.add({ type: "power", base: slotKey(0), player: "p2", delta: 2 }, "device-b");
    const skipped = game.add({ type: "power", base: slotKey(0), player: "p3", delta: -1 }, "device-b");
    let state = play(game.entries);
    expect(statusOf(state, skipped)).toBe("skipped");
    expect(lastUndoable(state)).toBe(theirs);
    expect(lastUndoable(state, "device-a")).toBe(mine);

    game.add({ type: "undo", target: theirs }, "device-b");
    game.add({ type: "undo", target: mine }, "device-a");
    state = play(game.entries);
    expect(lastUndoable(state)).toBeUndefined();
  });
});
