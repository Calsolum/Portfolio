import type { Action, BaseInPlay, BaseSnapshot, Counts, Entry, PlayerInfo } from "../types";

export const PLAYERS: PlayerInfo[] = [
  { id: "p1", name: "Alex", factions: ["pirates", "ninjas"] },
  { id: "p2", name: "Sam", factions: ["zombies", "robots"] },
  { id: "p3", name: "Kim", factions: [] },
];

export const FOUR_PLAYERS: PlayerInfo[] = [...PLAYERS, { id: "p4", name: "Jo", factions: [] }];

export const TORTUGA: BaseSnapshot = { card: "tortuga", name: "Tortuga", breakpoint: 21, vps: [4, 3, 2] };
export const JUNGLE_OASIS: BaseSnapshot = { card: "jungle-oasis", name: "Jungle Oasis", breakpoint: 12, vps: [2, 0, 0] };
export const NINJA_DOJO: BaseSnapshot = { card: "ninja-dojo", name: "Ninja Dojo", breakpoint: 18, vps: [2, 3, 2] };
export const THE_HOMEWORLD: BaseSnapshot = { card: "the-homeworld", name: "The Homeworld", breakpoint: 23, vps: [4, 2, 1] };
export const RHODES_PLAZA_MALL: BaseSnapshot = {
  card: "rhodes-plaza-mall",
  name: "Rhodes Plaza Mall",
  breakpoint: 24,
  vps: [0, 0, 0],
  bonus: "vp-per-minion",
};
export const FACTORY: BaseSnapshot = {
  card: "factory-436-1337",
  name: "Factory 436-1337",
  breakpoint: 25,
  vps: [2, 2, 1],
  bonus: "winner-vp-per-5-power",
};
export const CUSTOM: BaseSnapshot = { name: "House base", breakpoint: 20, vps: [3, 2, 1] };

export const SETUP_ID = "setup-entry";

/** The key of the base dealt into a slot at setup. */
export const slotKey = (slot: number) => `${SETUP_ID}:${slot}`;

/**
 * A game's entries with predictable ids and times: the setup, then
 * "entry-0001", "entry-0002" and so on, all from "device-a" unless given.
 */
export function script(
  bases: BaseSnapshot[] = [TORTUGA, JUNGLE_OASIS, NINJA_DOJO, THE_HOMEWORLD],
  players: PlayerInfo[] = PLAYERS,
  target = 15,
) {
  const entries: Entry[] = [
    { id: SETUP_ID, by: "device-a", at: 1_000, action: { type: "setup", players, bases, target, first: 0 } },
  ];
  let count = 0;
  const add = (action: Action, by = "device-a"): string => {
    count += 1;
    const id = `entry-${String(count).padStart(4, "0")}`;
    entries.push({ id, by, at: 1_000 + count, action });
    return id;
  };
  return { entries, add };
}

/** A base in play with the given counts, for scoring tests. */
export function baseWith(base: BaseSnapshot, counts: Record<string, Partial<Counts>>, breakpointDelta = 0): BaseInPlay {
  return {
    key: slotKey(0),
    base,
    breakpointDelta,
    counts: Object.fromEntries(
      Object.entries(counts).map(([player, given]) => [player, { power: 0, temp: 0, minions: 0, ...given }]),
    ),
  };
}
