import { BASES, type BaseCard } from "../data/bases";
import { FACTIONS, type Faction } from "../data/factions";
import { SETS, type GameSet } from "../data/sets";
import type { BaseSnapshot } from "../types";

/** Lookups and filters over the base, faction and set lists. */

export const SET_BY_ID: ReadonlyMap<string, GameSet> = new Map(SETS.map((set) => [set.id, set]));
export const BASE_BY_ID: ReadonlyMap<string, BaseCard> = new Map(BASES.map((base) => [base.id, base]));
export const FACTION_BY_ID: ReadonlyMap<string, Faction> = new Map(FACTIONS.map((faction) => [faction.id, faction]));

/** Every set is ticked until a player says which they own. */
export const ALL_SET_IDS: readonly string[] = SETS.map((set) => set.id);

/** True when one of the owned sets has it, where it first came out or in a box that reprints it. */
export const ownedIn = (item: { set: string; alsoIn?: readonly string[] }, owned: ReadonlySet<string>): boolean =>
  owned.has(item.set) || (item.alsoIn ?? []).some((id) => owned.has(id));

export function snapshotOf(card: BaseCard): BaseSnapshot {
  const snapshot: BaseSnapshot = { card: card.id, name: card.name, breakpoint: card.breakpoint, vps: card.vps };
  if (card.bonus) snapshot.bonus = card.bonus;
  return snapshot;
}

/** Lower case, with accents, apostrophes and full stops dropped and ß as ss: what search compares. */
export const searchKey = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/ß/g, "ss")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'.]/g, "")
    .toLowerCase();

/** Bases matching what was typed, from the owned sets, names starting with the query first. */
export function searchBases(query: string, owned: ReadonlySet<string>): BaseCard[] {
  const key = searchKey(query.trim());
  const matches = BASES.filter((base) => ownedIn(base, owned) && searchKey(base.name).includes(key));
  if (!key) return matches;
  return [
    ...matches.filter((base) => searchKey(base.name).startsWith(key)),
    ...matches.filter((base) => !searchKey(base.name).startsWith(key)),
  ];
}

export const factionName = (id: string): string => FACTION_BY_ID.get(id)?.name ?? id;
