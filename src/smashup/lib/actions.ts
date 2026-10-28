import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Action,
  type Award,
  type BaseBonus,
  type BaseSnapshot,
  type Entry,
  type PlayerInfo,
} from "../types";
import { ID_PATTERN, newId } from "./ids";

/**
 * Entries reach a device from storage and from other phones, and reach the
 * server from anyone, so each one is checked before it is replayed or stored:
 * well formed or dropped. Only known fields are copied across.
 */

export const MAX_PLAYER_NAME = 24;
export const MAX_BASE_NAME = 48;
/** Players + 1 at six players is 7; one spare for house rules. */
export const MAX_BASES = 8;
export const MAX_DELTA = 50;
export const MAX_TARGET = 99;
/** The power pad goes to 11; no printed minion comes close, but effects can. */
export const MAX_MINION_POWER = 20;
const MAX_NUMBER = 99;

const BONUSES: readonly BaseBonus[] = [
  "vp-per-minion",
  "winner-vp-per-5-power",
  "winner-vp-per-powerless-player",
  "others-vp-per-minion",
  "winner-vp-at-exact-breakpoint",
  "top-three-vp-at-22-power",
  "vp-for-one-minion",
];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,12}$/;
const BASE_KEY = /^[A-Za-z0-9_-]{8,40}:\d$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const matches = (value: unknown, pattern: RegExp, max = 60): value is string =>
  typeof value === "string" && value.length <= max && pattern.test(value);

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** A change of zero does nothing, so it is not a valid action. */
const delta = (value: unknown) => int(value, -MAX_DELTA, MAX_DELTA) || null;

/** Control and zero-width characters removed and whitespace collapsed; null if empty or too long. */
export function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text && [...text].length <= max ? text : null;
}

export function parseBase(value: unknown): BaseSnapshot | null {
  if (!isRecord(value)) return null;
  const name = cleanName(value.name, MAX_BASE_NAME);
  const breakpoint = int(value.breakpoint, 0, MAX_NUMBER);
  const vps = Array.isArray(value.vps) && value.vps.length === 3 ? value.vps.map((vp) => int(vp, 0, MAX_NUMBER)) : null;
  if (!name || breakpoint === null || !vps || vps.some((vp) => vp === null)) return null;
  if (value.card !== undefined && !matches(value.card, SLUG)) return null;
  if (value.bonus !== undefined && !BONUSES.includes(value.bonus as BaseBonus)) return null;

  const [first, second, third] = vps as number[];
  const base: BaseSnapshot = { name, breakpoint, vps: [first, second, third] };
  if (value.card !== undefined) base.card = value.card;
  if (value.bonus !== undefined) base.bonus = value.bonus as BaseBonus;
  return base;
}

function parsePlayer(value: unknown): PlayerInfo | null {
  if (!isRecord(value) || !matches(value.id, PLAYER_ID)) return null;
  const name = cleanName(value.name, MAX_PLAYER_NAME);
  const factions = Array.isArray(value.factions) ? value.factions : null;
  if (!name || !factions || factions.length > 2 || !factions.every((id) => matches(id, SLUG))) return null;
  if (new Set(factions).size !== factions.length) return null;
  return { id: value.id, name, factions: factions as string[] };
}

function parseSetup(value: Record<string, unknown>): Action | null {
  const rawPlayers = value.players;
  if (!Array.isArray(rawPlayers) || rawPlayers.length < MIN_PLAYERS || rawPlayers.length > MAX_PLAYERS) return null;
  const players: PlayerInfo[] = [];
  for (const raw of rawPlayers) {
    const player = parsePlayer(raw);
    if (!player || players.some((other) => other.id === player.id)) return null;
    players.push(player);
  }

  const rawBases = value.bases;
  if (!Array.isArray(rawBases) || rawBases.length < 1 || rawBases.length > MAX_BASES) return null;
  const bases: BaseSnapshot[] = [];
  for (const raw of rawBases) {
    const base = parseBase(raw);
    if (!base) return null;
    bases.push(base);
  }

  const target = int(value.target, 1, MAX_TARGET);
  const first = int(value.first, 0, players.length - 1);
  if (target === null || first === null) return null;
  return value.madness === true
    ? { type: "setup", players, bases, target, first, madness: true }
    : { type: "setup", players, bases, target, first };
}

function parseAwards(value: unknown): Award[] | null {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) return null;
  const awards: Award[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !matches(raw.player, PLAYER_ID)) return null;
    const vp = int(raw.vp, -MAX_NUMBER, MAX_NUMBER);
    if (vp === null || awards.some((award) => award.player === raw.player)) return null;
    awards.push({ player: raw.player, vp });
  }
  return awards;
}

export function parseAction(value: unknown): Action | null {
  if (!isRecord(value)) return null;
  const type = value.type;
  switch (type) {
    case "setup":
      return parseSetup(value);
    case "power":
    case "temp":
    case "minions": {
      const change = delta(value.delta);
      if (!matches(value.base, BASE_KEY) || !matches(value.player, PLAYER_ID) || !change) return null;
      return { type, base: value.base, player: value.player, delta: change };
    }
    case "minion": {
      const power = int(value.power, 0, MAX_MINION_POWER);
      const sign = value.delta === 1 || value.delta === -1 ? value.delta : null;
      if (!matches(value.base, BASE_KEY) || !matches(value.player, PLAYER_ID) || power === null || !sign) return null;
      return { type, base: value.base, player: value.player, delta: sign, power };
    }
    case "turn":
      return matches(value.player, PLAYER_ID) ? { type, player: value.player } : null;
    case "breakpoint": {
      const change = delta(value.delta);
      return matches(value.base, BASE_KEY) && change ? { type, base: value.base, delta: change } : null;
    }
    case "vp":
    case "madness": {
      const change = delta(value.delta);
      return matches(value.player, PLAYER_ID) && change ? { type, player: value.player, delta: change } : null;
    }
    case "score": {
      const awards = parseAwards(value.awards);
      return matches(value.base, BASE_KEY) && awards ? { type, base: value.base, awards } : null;
    }
    case "place": {
      const slot = int(value.slot, 0, MAX_BASES - 1);
      const base = parseBase(value.base);
      return slot !== null && base ? { type, slot, base } : null;
    }
    case "swap": {
      const to = parseBase(value.to);
      return matches(value.base, BASE_KEY) && to ? { type, base: value.base, to } : null;
    }
    case "endTurn":
      return { type };
    case "undo":
      return matches(value.target, ID_PATTERN) ? { type, target: value.target } : null;
    default:
      return null;
  }
}

export function parseEntry(value: unknown): Entry | null {
  if (!isRecord(value) || !matches(value.id, ID_PATTERN) || !matches(value.by, ID_PATTERN)) return null;
  const at = value.at;
  if (typeof at !== "number" || !Number.isFinite(at) || at <= 0) return null;
  const action = parseAction(value.action);
  return action ? { id: value.id, by: value.by, at: Math.round(at), action } : null;
}

/** Well-formed entries only, each id once, in the order given. */
export function parseEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const raw of value) {
    const entry = parseEntry(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  return entries;
}

export function makeEntry(action: Action, device: string, at = Date.now()): Entry {
  return { id: newId(), by: device, at, action };
}
