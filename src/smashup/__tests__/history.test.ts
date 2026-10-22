import { describe, expect, it } from "vitest";

import { replay } from "../lib/game";
import { MAX_HISTORY, historyEntry, withGame, type HistoryEntry } from "../lib/history";
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

const entry = (id: string): HistoryEntry => ({
  id,
  startedAt: 1,
  endedAt: 2,
  turns: 1,
  target: 15,
  shared: false,
  players: [],
  winner: "Alex",
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
      players: [
        { name: "Alex", factions: ["pirates", "ninjas"], vp: 2 },
        { name: "Sam", factions: ["zombies", "robots"], vp: 15 },
        { name: "Kim", factions: [], vp: 0 },
      ],
      winner: "Sam",
      bases: [{ name: "Jungle Oasis", awards: [{ player: "Alex", vp: 2 }] }],
    });
  });
});

describe("withGame", () => {
  it("puts a new game first and replaces one that changed", () => {
    const history = [entry("a"), entry("b")];
    expect(withGame(history, "c", entry("c")).map((item) => item.id)).toEqual(["c", "a", "b"]);
    const changed = { ...entry("b"), winner: "Sam" };
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
