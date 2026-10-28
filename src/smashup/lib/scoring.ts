import type { Award, BaseBonus, BaseInPlay, Counts, PlayerInfo } from "../types";

/**
 * Scoring by the rulebook. A base pays its 1st, 2nd and 3rd place VP to the
 * players with the most power there. To score at all a player needs a minion or
 * at least 1 power on the base. Tied players each get the best place they tied
 * for, and the places they fill are used up: 10, 10 and 5 power pays 1st, 1st
 * and 3rd, and two players tied for 2nd leave nobody in 3rd.
 */

/** A minion's power never drops below 0, so neither does a player's total on a base. */
export const effectivePower = (counts: Counts | undefined): number =>
  counts ? Math.max(0, counts.power + counts.temp) : 0;

export const breakpointOf = (base: BaseInPlay): number => Math.max(0, base.base.breakpoint + base.breakpointDelta);

export const totalPower = (base: BaseInPlay): number =>
  Object.values(base.counts).reduce((sum, counts) => sum + effectivePower(counts), 0);

/** The base scores when the total power on it reaches its breakpoint. */
export const isReady = (base: BaseInPlay): boolean => totalPower(base) >= breakpointOf(base);

export type Place = 1 | 2 | 3;

export interface Standing {
  player: string;
  power: number;
  minions: number;
  eligible: boolean;
  /** The place whose VP this player gets; null in 4th or below, or when not eligible. */
  place: Place | null;
  /** The base's VP for that place. */
  vp: number;
  /** VP from the base's ability that the tracker can work out. */
  bonus: number;
}

/** Players ranked on a base, eligible players first, most power first. */
export function standings(base: BaseInPlay, players: readonly PlayerInfo[]): Standing[] {
  const rows: Standing[] = players.map((player) => {
    const counts = base.counts[player.id];
    const power = effectivePower(counts);
    const minions = counts?.minions ?? 0;
    return { player: player.id, power, minions, eligible: minions > 0 || power >= 1, place: null, vp: 0, bonus: 0 };
  });

  // sort is stable, so players with equal power keep their seating order.
  const ranked = rows.filter((row) => row.eligible).sort((a, b) => b.power - a.power);
  for (let start = 0; start < ranked.length; ) {
    let end = start;
    while (end < ranked.length && ranked[end].power === ranked[start].power) end++;
    const place = start < 3 ? ((start + 1) as Place) : null;
    for (let i = start; i < end; i++) {
      ranked[i].place = place;
      ranked[i].vp = place ? base.base.vps[place - 1] : 0;
    }
    start = end;
  }

  // The winner is whoever takes 1st; when 1st is tied, each of them.
  const winners = ranked.filter((row) => row.place === 1);
  switch (base.base.bonus) {
    case "vp-per-minion":
      for (const row of rows) row.bonus = row.minions;
      break;
    case "winner-vp-per-5-power":
      for (const row of winners) row.bonus = Math.floor(row.power / 5);
      break;
    case "winner-vp-per-powerless-player": {
      const powerless = rows.filter((row) => row.power === 0).length;
      for (const row of winners) row.bonus = powerless;
      break;
    }
    case "others-vp-per-minion":
      for (const row of rows) if (row.place !== 1) row.bonus = row.minions;
      break;
    case "winner-vp-at-exact-breakpoint":
      if (totalPower(base) === breakpointOf(base)) for (const row of winners) row.bonus = 1;
      break;
    case "top-three-vp-at-22-power":
      if (totalPower(base) >= 22) for (const row of ranked) if (row.place !== null) row.bonus = 1;
      break;
    case "vp-for-one-minion":
      for (const row of rows) if (row.minions === 1) row.bonus = 1;
      break;
  }

  return [...ranked, ...rows.filter((row) => !row.eligible)];
}

/** What the scoring sheet says about a bonus it has filled in, in its own words rather than the card's. */
export const BONUS_NOTES: Record<BaseBonus, string> = {
  "vp-per-minion": "Each player also gets 1 VP per minion here.",
  "winner-vp-per-5-power": "The winner also gets 1 VP per 5 power here.",
  "winner-vp-per-powerless-player": "The winner also gets 1 VP per player with no power here.",
  "others-vp-per-minion": "Everyone but the winner also gets 1 VP per minion here.",
  "winner-vp-at-exact-breakpoint": "The winner gets 1 more VP when the total power equals the breakpoint.",
  "top-three-vp-at-22-power": "With 22 or more power here in all, the top three each get 1 more VP.",
  "vp-for-one-minion": "Each player with exactly one minion here gets 1 more VP.",
};

/** What the scoring sheet suggests before anyone edits it: every non-zero total. */
export function suggestedAwards(rows: readonly Standing[]): Award[] {
  return rows.filter((row) => row.vp + row.bonus !== 0).map((row) => ({ player: row.player, vp: row.vp + row.bonus }));
}
