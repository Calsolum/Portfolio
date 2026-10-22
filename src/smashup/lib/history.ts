import type { GameState } from "../types";

/**
 * A finished game as kept in the device's history: names rather than ids, so
 * an entry still reads correctly after the game itself is gone.
 */
export interface HistoryEntry {
  /** The game's id, so an entry is replaced (or removed) if the ending is undone. */
  id: string;
  startedAt: number;
  endedAt: number;
  turns: number;
  target: number;
  shared: boolean;
  players: { name: string; factions: string[]; vp: number }[];
  winner: string;
  bases: { name: string; awards: { player: string; vp: number }[] }[];
}

export const MAX_HISTORY = 100;

/** The history entry for a game that has been won; null while it is still going. */
export function historyEntry(state: GameState, shared: boolean): HistoryEntry | null {
  if (state.result?.kind !== "won") return null;
  const name = (id: string) => state.players.find((player) => player.id === id)?.name ?? "Someone";
  return {
    id: state.id,
    startedAt: state.startedAt,
    endedAt: state.result.at,
    turns: state.turn.number - 1,
    target: state.target,
    shared,
    players: state.players.map((player) => ({ name: player.name, factions: player.factions, vp: state.vp[player.id] })),
    winner: name(state.result.winner),
    bases: state.scored.map((scored) => ({
      name: scored.base.name,
      awards: scored.awards.map((award) => ({ player: name(award.player), vp: award.vp })),
    })),
  };
}

/** The history with this game's entry added, replaced or removed, newest first. Unchanged history comes back as is. */
export function withGame(history: readonly HistoryEntry[], gameId: string, entry: HistoryEntry | null): HistoryEntry[] {
  const current = history.find((item) => item.id === gameId);
  if (!entry) return current ? history.filter((item) => item.id !== gameId) : (history as HistoryEntry[]);
  if (current && JSON.stringify(current) === JSON.stringify(entry)) return history as HistoryEntry[];
  return [entry, ...history.filter((item) => item.id !== gameId)].slice(0, MAX_HISTORY);
}
