import type {
  Action,
  BaseInPlay,
  BaseSnapshot,
  Entry,
  GameResult,
  GameState,
  LogStatus,
  PlayerInfo,
} from "../types";
import { effectivePower } from "./scoring";

/**
 * The board after a list of entries, oldest first, worked out from scratch each
 * time. A game has a few hundred entries, so replaying is instant, and it makes
 * undo exact: an undone entry is simply left out.
 *
 * An entry that no longer fits is skipped rather than refused, because in a
 * shared game it may have been tapped a moment before someone else's change
 * arrived: a tap on a base that has just scored, a base placed in a slot that
 * has just been filled.
 */

const MAX_TEMP = 99;
/** The Madness deck has 30 cards. */
const MAX_MADNESS = 30;

const newBase = (entryId: string, slot: number, base: BaseSnapshot, players: readonly PlayerInfo[]): BaseInPlay => ({
  key: `${entryId}:${slot}`,
  base,
  breakpointDelta: 0,
  counts: Object.fromEntries(players.map((player) => [player.id, { power: 0, temp: 0, minions: 0 }])),
});

export const findBase = (state: GameState, key: string): BaseInPlay | undefined =>
  state.slots.find((base) => base?.key === key) ?? undefined;

export const playerName = (state: GameState, id: string): string =>
  state.players.find((player) => player.id === id)?.name ?? "Someone";

export const activePlayer = (state: GameState): PlayerInfo => state.players[state.turn.player];

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);

/** One log line, written before the entry is applied so it can still name a base that is about to score. */
function describe(state: GameState, action: Action): string {
  const who = (id: string) => playerName(state, id);
  const where = (key: string) => findBase(state, key)?.base.name ?? "a base no longer in play";
  switch (action.type) {
    case "power":
      return `${who(action.player)} ${signed(action.delta)} power on ${where(action.base)}`;
    case "temp":
      return `${who(action.player)} ${signed(action.delta)} power this turn on ${where(action.base)}`;
    case "minions":
      return `${who(action.player)} ${signed(action.delta)} ${Math.abs(action.delta) === 1 ? "minion" : "minions"} on ${where(action.base)}`;
    case "minion":
      return action.delta > 0
        ? `${who(action.player)} played a ${action.power}-power minion on ${where(action.base)}`
        : `${who(action.player)} lost a ${action.power}-power minion from ${where(action.base)}`;
    case "turn":
      return `Turn handed to ${who(action.player)}`;
    case "madness":
      return `${who(action.player)} ${signed(action.delta)} Madness`;
    case "breakpoint":
      return `${where(action.base)} breakpoint ${signed(action.delta)}`;
    case "vp":
      return `${who(action.player)} ${signed(action.delta)} VP`;
    case "score": {
      const paid = action.awards.filter((award) => award.vp !== 0);
      const list = paid.map((award) => `${who(award.player)} ${award.vp}`).join(", ");
      return `${where(action.base)} scored${list ? `: ${list}` : " with no points paid"}`;
    }
    case "place":
      return `Next base: ${action.base.name}`;
    case "swap":
      return `${where(action.base)} swapped for ${action.to.name}`;
    case "endTurn":
      return `${activePlayer(state).name} ended turn ${state.turn.number}`;
    default:
      return "";
  }
}

/**
 * Checked at the end of each turn. The game ends once one player has more VP
 * than everyone else and at least the target; a shared lead plays on. With
 * Madness, each player then loses 1 VP for every two Madness cards, the
 * highest total wins even if it is under the target, a tie goes to the player
 * with fewer Madness cards, and players still level share the win.
 */
function resultAfterTurn(state: GameState, at: number): GameResult | null {
  const best = Math.max(...state.players.map((player) => state.vp[player.id]));
  if (best < state.target) return null;
  const leaders = state.players.filter((player) => state.vp[player.id] === best).map((player) => player.id);
  if (leaders.length > 1) return { kind: "tied", leaders };

  const madness = state.madness;
  const final = Object.fromEntries(
    state.players.map((player) => [player.id, state.vp[player.id] - Math.floor((madness?.[player.id] ?? 0) / 2)]),
  );
  const top = Math.max(...Object.values(final));
  let winners = state.players.map((player) => player.id).filter((id) => final[id] === top);
  if (madness && winners.length > 1) {
    const fewest = Math.min(...winners.map((id) => madness[id]));
    winners = winners.filter((id) => madness[id] === fewest);
  }
  return { kind: "won", winners, at, final };
}

/** Applies one entry. Returns false when it no longer fits and nothing changed. */
function apply(state: GameState, entry: Entry): boolean {
  const action = entry.action;
  switch (action.type) {
    case "power":
    case "temp":
    case "minions": {
      const counts = findBase(state, action.base)?.counts[action.player];
      if (!counts) return false;
      const before = counts[action.type];
      // Power and minions can't go below 0; power this turn can, to take power away until the turn ends.
      counts[action.type] =
        action.type === "temp"
          ? Math.max(-MAX_TEMP, Math.min(MAX_TEMP, before + action.delta))
          : Math.max(0, before + action.delta);
      return counts[action.type] !== before;
    }
    case "minion": {
      const counts = findBase(state, action.base)?.counts[action.player];
      // A minion can only be lost from where there is one.
      if (!counts || (action.delta < 0 && counts.minions === 0)) return false;
      const before = `${counts.minions}/${counts.power}`;
      counts.minions = Math.max(0, counts.minions + action.delta);
      counts.power = Math.max(0, counts.power + action.delta * action.power);
      return `${counts.minions}/${counts.power}` !== before;
    }
    case "turn": {
      const seat = state.players.findIndex((player) => player.id === action.player);
      if (seat < 0 || seat === state.turn.player) return false;
      state.turn = { ...state.turn, player: seat };
      return true;
    }
    case "madness": {
      const madness = state.madness;
      if (!madness || !(action.player in madness)) return false;
      const before = madness[action.player];
      madness[action.player] = Math.max(0, Math.min(MAX_MADNESS, before + action.delta));
      return madness[action.player] !== before;
    }
    case "breakpoint": {
      const base = findBase(state, action.base);
      if (!base) return false;
      const before = base.breakpointDelta;
      base.breakpointDelta = Math.max(-base.base.breakpoint, before + action.delta);
      return base.breakpointDelta !== before;
    }
    case "vp": {
      if (!(action.player in state.vp)) return false;
      state.vp[action.player] += action.delta;
      return true;
    }
    case "score": {
      const slot = state.slots.findIndex((base) => base?.key === action.base);
      const base = state.slots[slot];
      if (!base) return false;
      const awards = action.awards.filter((award) => award.player in state.vp);
      for (const award of awards) state.vp[award.player] += award.vp;
      state.scored.push({
        entry: entry.id,
        base: base.base,
        turn: state.turn.number,
        power: Object.fromEntries(state.players.map((player) => [player.id, effectivePower(base.counts[player.id])])),
        awards,
      });
      // Its minions go to their owners' discard piles, so its counts go with it.
      state.slots[slot] = null;
      return true;
    }
    case "place": {
      if (action.slot >= state.slots.length || state.slots[action.slot] !== null) return false;
      state.slots[action.slot] = newBase(entry.id, action.slot, action.base, state.players);
      if (action.base.card) state.seen.push(action.base.card);
      return true;
    }
    case "swap": {
      const base = findBase(state, action.base);
      if (!base) return false;
      // The minions stay; anything that changed the old base's breakpoint was attached to it and goes.
      base.base = action.to;
      base.breakpointDelta = 0;
      if (action.to.card) state.seen.push(action.to.card);
      return true;
    }
    case "endTurn": {
      for (const base of state.slots) {
        if (base) for (const counts of Object.values(base.counts)) counts.temp = 0;
      }
      // A win stands; a shared lead is checked again at the end of the next turn.
      if (state.result?.kind !== "won") state.result = resultAfterTurn(state, entry.at);
      state.turn = { player: (state.turn.player + 1) % state.players.length, number: state.turn.number + 1 };
      return true;
    }
    default:
      return false;
  }
}

export function replay(entries: readonly Entry[]): GameState | null {
  const setup = entries[0];
  if (setup?.action.type !== "setup") return null;
  const { players, bases, target, first, madness } = setup.action;

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const undone = new Set<string>();
  for (const entry of entries) {
    if (entry.action.type !== "undo") continue;
    const taken = byId.get(entry.action.target);
    // There is no redo, and the setup can't be taken back.
    if (taken && taken.action.type !== "undo" && taken.action.type !== "setup") undone.add(taken.id);
  }

  const state: GameState = {
    id: setup.id,
    startedAt: setup.at,
    players,
    target,
    first,
    madness: madness ? Object.fromEntries(players.map((player) => [player.id, 0])) : null,
    slots: bases.map((base, slot) => newBase(setup.id, slot, base, players)),
    vp: Object.fromEntries(players.map((player) => [player.id, 0])),
    turn: { player: first, number: 1 },
    scored: [],
    seen: bases.flatMap((base) => (base.card ? [base.card] : [])),
    result: null,
    log: [
      {
        id: setup.id,
        by: setup.by,
        at: setup.at,
        type: "setup",
        text: `New game: ${players.map((player) => player.name).join(", ")}`,
        status: "done",
      },
    ],
  };

  const applied = new Set([setup.id]);
  for (const entry of entries.slice(1)) {
    const type = entry.action.type;
    if (applied.has(entry.id) || type === "setup" || type === "undo") continue;
    applied.add(entry.id);
    const text = describe(state, entry.action);
    let status: LogStatus = "undone";
    if (!undone.has(entry.id)) status = apply(state, entry) ? "done" : "skipped";
    state.log.push({ id: entry.id, by: entry.by, at: entry.at, type, text, status });
  }
  return state;
}

/** The newest entry that undo would take back, from one device or from anyone. */
export function lastUndoable(state: GameState, device?: string): string | undefined {
  for (let i = state.log.length - 1; i > 0; i--) {
    const line = state.log[i];
    if (line.status === "done" && (!device || line.by === device)) return line.id;
  }
  return undefined;
}
