import { describe, expect, it } from "vitest";

import { makeEntry } from "../lib/actions";
import { parseState } from "../state/store";
import { PLAYERS, TORTUGA } from "./fixtures";

const setup = makeEntry(
  { type: "setup", players: PLAYERS, bases: [TORTUGA, TORTUGA, TORTUGA, TORTUGA], target: 15, first: 0 },
  "device-abc123",
  1_000,
);

describe("parseState", () => {
  it("reads history saved before shared wins and Madness, with a single winner", () => {
    const state = parseState(
      JSON.stringify({
        version: 1,
        settings: { device: "device-abc123", owned: ["core", "no-such-set"], names: ["Alex"], keepAwake: true },
        game: { kind: "local", entries: [setup] },
        history: [
          { id: "old-game", endedAt: 2, winner: "Alex", players: [{ name: "Alex", factions: [], vp: 15 }], bases: [] },
          { id: "broken", endedAt: 2, players: [], bases: [] },
          "junk",
        ],
      }),
    );
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ id: "old-game", winners: ["Alex"], madness: false, first: 0 });
    expect(state.settings).toEqual({ device: "device-abc123", owned: ["core"], names: ["Alex"], keepAwake: true });
    expect(state.game).toEqual({ kind: "local", entries: [setup] });
  });

  it("starts afresh from anything that isn't a saved tracker", () => {
    const state = parseState(JSON.stringify({ version: 2 }));
    expect(state.game).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.settings.device.length).toBeGreaterThanOrEqual(8);
    expect(state.settings.owned.length).toBeGreaterThan(30);
  });

  it("keeps a shared game's room and drops a bad room code", () => {
    const room = { code: "bcdfg", confirmed: [setup], pending: [], cursor: 1 };
    expect(parseState(JSON.stringify({ version: 1, game: { kind: "shared", room } })).game).toEqual({
      kind: "shared",
      room: { ...room, code: "BCDFG" },
    });
    const bad = { ...room, code: "nope" };
    expect(parseState(JSON.stringify({ version: 1, game: { kind: "shared", room: bad } })).game).toBeNull();
  });
});
