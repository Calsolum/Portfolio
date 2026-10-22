"use client";

import { Notice, Panel } from "@/components/ui/controls";

import { factionName } from "../lib/catalog";
import type { HistoryEntry } from "../lib/history";
import { ConfirmButton } from "./common";

const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

export function HistoryPanel({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  if (!history.length) {
    return <Notice>Finished games are kept here, on this device. None yet.</Notice>;
  }

  return (
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
          const winner = game.players.find((player) => player.name === game.winner);
          return (
            <li key={game.id} className="border border-edge p-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
                {day(game.endedAt)} · {game.turns} {game.turns === 1 ? "turn" : "turns"}
                {game.shared ? " · shared" : ""}
              </p>
              <p className="mt-1 font-display text-2xl tracking-wide text-ink">
                {game.winner} won with {winner?.vp ?? "?"} VP
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
                      <span className="tabular-nums text-muted">{player.vp}</span>
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
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
