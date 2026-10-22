/**
 * Smash Up Base Tracker. A game is a list of actions and the board is what
 * replaying them gives. Devices send actions rather than boards, so two people
 * tapping at once both count, and undo works on anything, scoring included.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** The rulebook's target; a game can set another. */
export const DEFAULT_TARGET = 15;

/** VP for the players in 1st, 2nd and 3rd place. */
export type Vps = readonly [number, number, number];

/** Extra VP from a base's ability that the tracker can work out from what it counts. */
export type BaseBonus =
  | "vp-per-minion"
  | "winner-vp-per-5-power"
  | "winner-vp-per-powerless-player"
  | "others-vp-per-minion"
  | "winner-vp-at-exact-breakpoint"
  | "top-three-vp-at-22-power"
  | "vp-for-one-minion";

/**
 * A base as it came into play. Its numbers travel inside the action, so fixing
 * the base list later never changes a game already played, and every device in
 * a shared game agrees even if one has an older copy of the page.
 */
export interface BaseSnapshot {
  /** Id in the base list; absent for a base typed in by hand. */
  card?: string;
  name: string;
  breakpoint: number;
  vps: Vps;
  bonus?: BaseBonus;
}

export interface PlayerInfo {
  /** Stable within a game: "p1" to "p6". */
  id: string;
  name: string;
  /** Faction ids from the faction list, at most two. */
  factions: string[];
}

export interface Award {
  player: string;
  vp: number;
}

export type Action =
  | { type: "setup"; players: PlayerInfo[]; bases: BaseSnapshot[]; target: number; first: number }
  /** Power that stays: minions played, +1 power counters. */
  | { type: "power"; base: string; player: string; delta: number }
  /** Power until the end of the turn. */
  | { type: "temp"; base: string; player: string; delta: number }
  | { type: "minions"; base: string; player: string; delta: number }
  | { type: "breakpoint"; base: string; delta: number }
  | { type: "vp"; player: string; delta: number }
  /** The awards as confirmed, so a replay never depends on how scoring is worked out today. */
  | { type: "score"; base: string; awards: Award[] }
  /** A new base in a slot left empty by scoring. */
  | { type: "place"; slot: number; base: BaseSnapshot }
  /** A different base in the same place, minions and all (as with Terraforming). */
  | { type: "swap"; base: string; to: BaseSnapshot }
  | { type: "endTurn" }
  | { type: "undo"; target: string };

export type ActionType = Action["type"];

/** An action as it is stored and sent. */
export interface Entry {
  /** Random. Undo points at it, and a shared game uses it to spot its own actions coming back. */
  id: string;
  /** The device that sent it. */
  by: string;
  /** When, by the sender's clock (ms since 1970). */
  at: number;
  action: Action;
}

export interface Counts {
  power: number;
  temp: number;
  minions: number;
}

export interface BaseInPlay {
  /** Unique to this appearance of the base: the placing entry's id and the slot. */
  key: string;
  base: BaseSnapshot;
  /** Changes to the breakpoint from cards in play. */
  breakpointDelta: number;
  /** By player id. */
  counts: Record<string, Counts>;
}

export interface ScoredBase {
  /** The score entry's id. */
  entry: string;
  base: BaseSnapshot;
  turn: number;
  /** Each player's power on the base when it scored. */
  power: Record<string, number>;
  awards: Award[];
}

export type GameResult =
  | { kind: "won"; winner: string; at: number }
  /** Someone has reached the target but the lead is shared, so play goes on. */
  | { kind: "tied"; leaders: string[] };

/** Undone: someone took it back. Skipped: it no longer fit, such as a tap on a base that had already scored. */
export type LogStatus = "done" | "undone" | "skipped";

export interface LogLine {
  id: string;
  by: string;
  at: number;
  type: ActionType;
  text: string;
  status: LogStatus;
}

export interface GameState {
  /** The setup entry's id. */
  id: string;
  startedAt: number;
  players: PlayerInfo[];
  target: number;
  /** One per base in play; null while a scored base waits for the next one. */
  slots: (BaseInPlay | null)[];
  vp: Record<string, number>;
  /** Whose turn (an index into players) and the turn count from 1. */
  turn: { player: number; number: number };
  scored: ScoredBase[];
  /** Card ids of every base that has come out this game, in order. */
  seen: string[];
  result: GameResult | null;
  /** Oldest first. Undo entries have no line of their own; they mark their target. */
  log: LogLine[];
}
