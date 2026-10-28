"use client";

import { useMemo } from "react";

import { Button, Notice, Panel } from "@/components/ui/controls";

import { factionName } from "../lib/catalog";
import { statsFrom, type HistoryEntry } from "../lib/history";
import { ConfirmButton } from "./common";
import type { SetupPreset } from "./SetupPanel";

const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

const percent = (wins: number, games: number) => `${Math.round((wins / games) * 100)}%`;

/** Wins and averages across this phone's finished games. */
function Stats({ history }: { history: HistoryEntry[] }) {
  const { players, factions } = useMemo(() => statsFrom(history), [history]);
  const cell = "px-2 py-1.5 text-right tabular-nums";

  return (
    <Panel title="Stats" aside={<span className="font-mono text-xs text-muted">{history.length} games</span>}>
      <div className="flex flex-col gap-5">
        <table className="w-full font-mono text-xs">
          <caption className="sr-only">Players</caption>
          <thead className="text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="py-1.5 pr-2 text-left font-normal">Player</th>
              <th className={`${cell} font-normal`}>Games</th>
              <th className={`${cell} font-normal`}>Wins</th>
              <th className={`${cell} font-normal`}>Avg VP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge text-ink">
            {players.map((player) => (
              <tr key={player.name}>
                <td className="max-w-0 truncate py-1.5 pr-2">{player.name}</td>
                <td className={cell}>{player.games}</td>
                <td className={cell}>
                  {player.wins} <span className="text-muted">{percent(player.wins, player.games)}</span>
                </td>
                <td className={cell}>{player.averageVp}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {factions.length ? (
          <table className="w-full font-mono text-xs">
            <caption className="sr-only">Factions</caption>
            <thead className="text-[0.65rem] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="py-1.5 pr-2 text-left font-normal">Faction</th>
                <th className={`${cell} font-normal`}>Games</th>
                <th className={`${cell} font-normal`}>Wins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge text-ink">
              {factions.slice(0, 10).map((faction) => (
                <tr key={faction.faction}>
                  <td className="max-w-0 truncate py-1.5 pr-2">{factionName(faction.faction)}</td>
                  <td className={cell}>{faction.games}</td>
                  <td className={cell}>
                    {faction.wins} <span className="text-muted">{percent(faction.wins, faction.games)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
          From the games finished on this phone. Players count as the same when their names match, so type them the
          same way each game. A shared win counts for everyone in it.
        </p>
      </div>
    </Panel>
  );
}

export function HistoryPanel({
  history,
  onClear,
  onRematch,
}: {
  history: HistoryEntry[];
  onClear: () => void;
  onRematch: (preset: SetupPreset) => void;
}) {
  if (!history.length) {
    return <Notice>Finished games are kept here, on this device. None yet.</Notice>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Stats history={history} />

      <Panel
        title="Finished games"
        aside={
          <ConfirmButton confirmText="Tap again to clear" onConfirm={onClear}>
            Clear
          </ConfirmButton>
        }
      >
        <ol className="flex flex-col gap-4">
          {history.map((game) => {
            const winners = game.players.filter((player) => game.winners.includes(player.name));
            return (
              <li key={game.id} className="border border-edge p-3">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
                  {day(game.endedAt)} · {game.turns} {game.turns === 1 ? "turn" : "turns"}
                  {game.shared ? " · shared" : ""}
                  {game.madness ? " · Madness" : ""}
                </p>
                <p className="mt-1 font-display text-2xl tracking-wide text-ink">
                  {game.winners.join(" and ")} {game.winners.length > 1 ? "shared the win" : "won"} with{" "}
                  {winners[0]?.vp ?? "?"} VP
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {[...game.players]
                    .sort((a, b) => b.vp - a.vp)
                    .map((player) => (
                      <li key={player.name} className="flex justify-between gap-3 font-mono text-xs">
                        <span className="text-ink">
                          {player.name}
                          {player.factions.length ? (
                            <span className="text-muted"> · {player.factions.map(factionName).join(" + ")}</span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-muted">
                          {player.vp}
                          {player.madness ? ` · ${player.madness} Madness` : ""}
                        </span>
                      </li>
                    ))}
                </ul>
                {game.bases.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted hover:text-accent">
                      {game.bases.length} {game.bases.length === 1 ? "base" : "bases"} scored
                    </summary>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {game.bases.map((base, i) => (
                        <li key={i} className="font-mono text-[0.65rem] text-muted">
                          <span className="text-ink">{base.name}</span>
                          {base.awards.length
                            ? `: ${base.awards.map((award) => `${award.player} ${award.vp}`).join(", ")}`
                            : ": no points"}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <div className="mt-3">
                  <Button
                    onClick={() =>
                      onRematch({
                        players: game.players.map((player) => ({ name: player.name, factions: player.factions })),
                        target: game.target,
                        first: game.first,
                        madness: game.madness,
                      })
                    }
                    title="Same players, factions and seats; pick new bases"
                  >
                    Rematch
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}
