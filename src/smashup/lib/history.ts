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
  /** Played with the Madness deck. */
  madness: boolean;
  /** The seat that went first, for a rematch. */
  first: number;
  /** In seat order. VP is the final total, after any Madness. */
  players: { name: string; factions: string[]; vp: number; madness?: number }[];
  /** More than one only when Madness left players level. */
  winners: string[];
  bases: { name: string; awards: { player: string; vp: number }[] }[];
}

export const MAX_HISTORY = 100;

/** The history entry for a game that has been won; null while it is still going. */
export function historyEntry(state: GameState, shared: boolean): HistoryEntry | null {
  const result = state.result;
  if (result?.kind !== "won") return null;
  const name = (id: string) => state.players.find((player) => player.id === id)?.name ?? "Someone";
  return {
    id: state.id,
    startedAt: state.startedAt,
    endedAt: result.at,
    turns: state.turn.number - 1,
    target: state.target,
    shared,
    madness: state.madness !== null,
    first: state.first,
    players: state.players.map((player) => ({
      name: player.name,
      factions: player.factions,
      vp: result.final[player.id] ?? state.vp[player.id],
      ...(state.madness ? { madness: state.madness[player.id] } : {}),
    })),
    winners: result.winners.map(name),
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

export interface PlayerStats {
  name: string;
  games: number;
  wins: number;
  /** Final VP per game, to one decimal place. */
  averageVp: number;
}

export interface FactionStats {
  faction: string;
  games: number;
  wins: number;
}

/** Players are the same person when their names match, ignoring case and spaces at the ends. */
const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * Wins and averages across the device's finished games. A shared win counts as
 * a win for each player in it. Players are listed by wins, factions by games.
 */
export function statsFrom(history: readonly HistoryEntry[]): { players: PlayerStats[]; factions: FactionStats[] } {
  const players = new Map<string, PlayerStats & { totalVp: number }>();
  const factions = new Map<string, FactionStats>();

  for (const game of history) {
    const winners = new Set(game.winners.map(nameKey));
    for (const player of game.players) {
      const key = nameKey(player.name);
      const won = winners.has(key);
      // History is newest first, so the first spelling met is the latest one used.
      const row = players.get(key) ?? { name: player.name, games: 0, wins: 0, averageVp: 0, totalVp: 0 };
      row.games += 1;
      row.wins += won ? 1 : 0;
      row.totalVp += player.vp;
      players.set(key, row);
      for (const faction of player.factions) {
        const tally = factions.get(faction) ?? { faction, games: 0, wins: 0 };
        tally.games += 1;
        tally.wins += won ? 1 : 0;
        factions.set(faction, tally);
      }
    }
  }

  return {
    players: [...players.values()]
      .map(({ totalVp, ...row }) => ({ ...row, averageVp: Math.round((totalVp / row.games) * 10) / 10 }))
      .sort((a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games || b.games - a.games),
    factions: [...factions.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
  };
}
