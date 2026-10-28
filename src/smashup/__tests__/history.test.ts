import { describe, expect, it } from "vitest";

import { replay } from "../lib/game";
import { MAX_HISTORY, historyEntry, statsFrom, withGame, type HistoryEntry } from "../lib/history";
import type { GameState } from "../types";
import { script, slotKey } from "./fixtures";

function wonGame(): GameState {
  const game = script();
  game.add({ type: "power", base: slotKey(1), player: "p1", delta: 12 });
  game.add({ type: "score", base: slotKey(1), awards: [{ player: "p1", vp: 2 }] });
  game.add({ type: "vp", player: "p2", delta: 15 });
  game.add({ type: "endTurn" });
  const state = replay(game.entries);
  if (!state) throw new Error("no game");
  return state;
}

const entry = (id: string, players: HistoryEntry["players"] = [], winners = ["Alex"]): HistoryEntry => ({
  id,
  startedAt: 1,
  endedAt: 2,
  turns: 1,
  target: 15,
  shared: false,
  madness: false,
  first: 0,
  players,
  winners,
  bases: [],
});

describe("historyEntry", () => {
  it("is null while the game is still going", () => {
    const state = replay(script().entries);
    expect(state && historyEntry(state, false)).toBeNull();
  });

  it("records a won game with names rather than ids", () => {
    expect(historyEntry(wonGame(), true)).toEqual({
      id: "setup-entry",
      startedAt: 1_000,
      endedAt: 1_004,
      turns: 1,
      target: 15,
      shared: true,
      madness: false,
      first: 0,
      players: [
        { name: "Alex", factions: ["pirates", "ninjas"], vp: 2 },
        { name: "Sam", factions: ["zombies", "robots"], vp: 15 },
        { name: "Kim", factions: [], vp: 0 },
      ],
      winners: ["Sam"],
      bases: [{ name: "Jungle Oasis", awards: [{ player: "Alex", vp: 2 }] }],
    });
  });

  it("keeps final VP and Madness in a game played with it", () => {
    const game = script();
    const setup = game.entries[0].action;
    if (setup.type === "setup") setup.madness = true;
    game.add({ type: "vp", player: "p1", delta: 16 });
    game.add({ type: "madness", player: "p1", delta: 4 });
    game.add({ type: "endTurn" });
    const state = replay(game.entries);
    const saved = state && historyEntry(state, false);
    expect(saved).toMatchObject({ madness: true, winners: ["Alex"] });
    expect(saved?.players[0]).toEqual({ name: "Alex", factions: ["pirates", "ninjas"], vp: 14, madness: 4 });
  });
});

describe("statsFrom", () => {
  const alex = (vp: number, factions = ["pirates", "ninjas"]) => ({ name: "Alex", factions, vp });
  const sam = (vp: number, factions = ["zombies", "robots"]) => ({ name: "Sam", factions, vp });

  it("counts games, wins and average VP per player, matching names without case", () => {
    const history = [
      entry("g3", [alex(12), { ...sam(16), name: "sam " }], ["sam "]),
      entry("g2", [alex(15), sam(9)], ["Alex"]),
      entry("g1", [alex(17), sam(11)], ["Alex"]),
    ];
    expect(statsFrom(history).players).toEqual([
      { name: "Alex", games: 3, wins: 2, averageVp: 14.7 },
      // The newest spelling is the one shown.
      { name: "sam ", games: 3, wins: 1, averageVp: 12 },
    ]);
  });

  it("counts games and wins per faction, and a shared win for everyone in it", () => {
    const history = [
      entry("g2", [alex(14, ["pirates", "wizards"]), sam(14)], ["Alex", "Sam"]),
      entry("g1", [alex(15), sam(9)], ["Alex"]),
    ];
    expect(statsFrom(history).factions).toEqual([
      { faction: "pirates", games: 2, wins: 2 },
      { faction: "zombies", games: 2, wins: 1 },
      { faction: "robots", games: 2, wins: 1 },
      { faction: "wizards", games: 1, wins: 1 },
      { faction: "ninjas", games: 1, wins: 1 },
    ]);
    expect(statsFrom([]).players).toEqual([]);
  });
});

describe("withGame", () => {
  it("puts a new game first and replaces one that changed", () => {
    const history = [entry("a"), entry("b")];
    expect(withGame(history, "c", entry("c")).map((item) => item.id)).toEqual(["c", "a", "b"]);
    const changed = { ...entry("b"), winners: ["Sam"] };
    expect(withGame(history, "b", changed)).toEqual([changed, entry("a")]);
  });

  it("hands back the same list when nothing changed, so saving can be skipped", () => {
    const history = [entry("a"), entry("b")];
    expect(withGame(history, "b", entry("b"))).toBe(history);
    expect(withGame(history, "z", null)).toBe(history);
  });

  it("removes a game whose ending was undone", () => {
    expect(withGame([entry("a"), entry("b")], "a", null)).toEqual([entry("b")]);
  });

  it("keeps at most the newest games", () => {
    const history = Array.from({ length: MAX_HISTORY }, (_, i) => entry(`g${i}`));
    const next = withGame(history, "new", entry("new"));
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0].id).toBe("new");
    expect(next.at(-1)?.id).toBe(`g${MAX_HISTORY - 2}`);
  });
});
