import { describe, expect, it } from "vitest";

import { cleanName, makeEntry, parseAction, parseEntries, parseEntry } from "../lib/actions";
import { ID_PATTERN, ROOM_ALPHABET, newId, newRoomCode, parseRoomCode } from "../lib/ids";
import type { Action, Entry } from "../types";
import { CUSTOM, PLAYERS, RHODES_PLAZA_MALL, TORTUGA, slotKey } from "./fixtures";

const ACTIONS: Action[] = [
  { type: "setup", players: PLAYERS, bases: [TORTUGA, CUSTOM, RHODES_PLAZA_MALL], target: 15, first: 2 },
  { type: "power", base: slotKey(0), player: "p1", delta: 3 },
  { type: "temp", base: slotKey(0), player: "p2", delta: -2 },
  { type: "minions", base: slotKey(1), player: "p3", delta: 1 },
  { type: "breakpoint", base: slotKey(2), delta: -4 },
  { type: "vp", player: "p1", delta: -1 },
  { type: "score", base: slotKey(0), awards: [{ player: "p1", vp: 4 }] },
  { type: "place", slot: 0, base: TORTUGA },
  { type: "swap", base: slotKey(1), to: CUSTOM },
  { type: "endTurn" },
  { type: "undo", target: "entry-0001" },
];

/** As it arrives off the network: plain JSON. */
const wire = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

const entryWith = (action: unknown, extra: Record<string, unknown> = {}) => ({
  id: "abcdefgh1234",
  by: "device-abc123",
  at: 1_760_000_000_000,
  action,
  ...extra,
});

describe("parseEntry", () => {
  it("accepts a well-formed entry of every kind", () => {
    for (const action of ACTIONS) {
      const entry: Entry = makeEntry(action, "device-abc123", 1_760_000_000_000);
      expect(parseEntry(wire(entry)), action.type).toEqual(entry);
    }
  });

  it("copies only known fields", () => {
    const parsed = parseEntry(
      entryWith({ type: "power", base: slotKey(0), player: "p1", delta: 1, extra: "x" }, { note: "dropped" }),
    );
    expect(parsed).toEqual(entryWith({ type: "power", base: slotKey(0), player: "p1", delta: 1 }));
    expect(parseAction({ type: "endTurn", base: slotKey(0) })).toEqual({ type: "endTurn" });
  });

  it("rejects bad envelopes", () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry(entryWith({ type: "endTurn" }, { id: "short" }))).toBeNull();
    expect(parseEntry(entryWith({ type: "endTurn" }, { id: "has spaces in it" }))).toBeNull();
    expect(parseEntry(entryWith({ type: "endTurn" }, { by: 7 }))).toBeNull();
    expect(parseEntry(entryWith({ type: "endTurn" }, { at: "today" }))).toBeNull();
    expect(parseEntry(entryWith({ type: "endTurn" }, { at: Number.NaN }))).toBeNull();
    expect(parseEntry(entryWith({ type: "explode" }))).toBeNull();
  });

  it("rejects changes of zero, too big or not whole", () => {
    for (const delta of [0, 51, -51, 1.5, "1", null]) {
      expect(parseAction({ type: "power", base: slotKey(0), player: "p1", delta }), String(delta)).toBeNull();
    }
    expect(parseAction({ type: "vp", player: "p1", delta: 50 })).not.toBeNull();
  });

  it("rejects references that can't be ids", () => {
    expect(parseAction({ type: "power", base: "nope", player: "p1", delta: 1 })).toBeNull();
    expect(parseAction({ type: "power", base: slotKey(0), player: "not a player id", delta: 1 })).toBeNull();
    expect(parseAction({ type: "place", slot: 8, base: TORTUGA })).toBeNull();
    expect(parseAction({ type: "undo", target: "x" })).toBeNull();
  });

  it("checks the setup's players, bases, target and first player", () => {
    const setup = ACTIONS[0];
    const withPlayers = (players: unknown) => ({ ...setup, players });
    expect(parseAction(withPlayers(PLAYERS.slice(0, 1)))).toBeNull();
    expect(
      parseAction(withPlayers([1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `p${n}`, name: `P${n}`, factions: [] })))),
    ).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], id: "p1" }]))).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], name: "x".repeat(25) }]))).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], name: " ​ " }]))).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], factions: ["a", "b", "c"] }]))).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], factions: ["ninjas", "ninjas"] }]))).toBeNull();
    expect(parseAction(withPlayers([PLAYERS[0], { ...PLAYERS[1], factions: ["Not A Slug"] }]))).toBeNull();
    expect(parseAction({ ...setup, bases: [] })).toBeNull();
    expect(parseAction({ ...setup, bases: Array(9).fill(TORTUGA) })).toBeNull();
    expect(parseAction({ ...setup, target: 0 })).toBeNull();
    expect(parseAction({ ...setup, first: 3 })).toBeNull();
  });

  it("checks base numbers", () => {
    const place = (base: unknown) => parseAction({ type: "place", slot: 1, base });
    expect(place({ ...TORTUGA, vps: [4, 3] })).toBeNull();
    expect(place({ ...TORTUGA, vps: [4, 3, -2] })).toBeNull();
    expect(place({ ...TORTUGA, breakpoint: 100 })).toBeNull();
    expect(place({ ...TORTUGA, card: "Tortuga!" })).toBeNull();
    expect(place({ ...TORTUGA, bonus: "double-everything" })).toBeNull();
    expect(place({ ...TORTUGA, name: "" })).toBeNull();
    expect(place(CUSTOM)).toEqual({ type: "place", slot: 1, base: CUSTOM });
  });

  it("refuses the same player twice in one scoring", () => {
    const awards = [
      { player: "p1", vp: 4 },
      { player: "p1", vp: 3 },
    ];
    expect(parseAction({ type: "score", base: slotKey(0), awards })).toBeNull();
  });
});

describe("cleanName", () => {
  it("strips invisible characters and collapses whitespace", () => {
    expect(cleanName("  Alex​ \t Smith\n", 24)).toBe("Alex Smith");
    expect(cleanName("Zoë 🎲", 24)).toBe("Zoë 🎲");
    expect(cleanName("x".repeat(24), 24)).toHaveLength(24);
    expect(cleanName("x".repeat(25), 24)).toBeNull();
    expect(cleanName(42, 24)).toBeNull();
  });
});

describe("parseEntries", () => {
  it("keeps well-formed entries once each, in order", () => {
    const a = makeEntry({ type: "endTurn" }, "device-abc123", 1);
    const b = makeEntry({ type: "vp", player: "p1", delta: 1 }, "device-abc123", 2);
    expect(parseEntries(wire([a, { junk: true }, b, a]))).toEqual([a, b]);
    expect(parseEntries("not a list")).toEqual([]);
  });
});

describe("ids", () => {
  it("makes long random ids", () => {
    const ids = Array.from({ length: 200 }, newId);
    for (const id of ids) expect(id).toMatch(ID_PATTERN);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes room codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = newRoomCode();
      expect(code).toHaveLength(5);
      for (const char of code) expect(ROOM_ALPHABET).toContain(char);
      expect(parseRoomCode(code)).toBe(code);
    }
  });

  it("reads a typed code, ignoring case, spaces and dashes", () => {
    expect(parseRoomCode(" k7x-qz ")).toBe("K7XQZ");
    expect(parseRoomCode("K7XQ")).toBeNull();
    expect(parseRoomCode("K7XQZZ")).toBeNull();
    // 0, 1 and vowels are never used.
    expect(parseRoomCode("K0XQZ")).toBeNull();
    expect(parseRoomCode("KAXQZ")).toBeNull();
    expect(parseRoomCode(12345)).toBeNull();
  });
});
