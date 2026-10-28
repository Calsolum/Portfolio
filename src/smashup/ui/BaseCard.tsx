"use client";

import { useState } from "react";

import { Button } from "@/components/ui/controls";

import { BASE_BY_ID, SET_BY_ID } from "../lib/catalog";
import { breakpointOf, effectivePower, isReady, totalPower } from "../lib/scoring";
import type { BaseInPlay, PlayerInfo } from "../types";
import { PlayerDot, StepButton, vpText } from "./common";
import { MinionPad } from "./MinionPad";

/** A pawn, for the button that plays or loses a minion. */
const PawnIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
    <circle cx="12" cy="6" r="3.2" />
    <path d="M8.6 11h6.8l-1.3 6.2H9.9z" />
    <rect x="6" y="18.2" width="12" height="3" rx="1" />
  </svg>
);

/** What the −/+ buttons change. */
export type Mode = "power" | "temp" | "minions";

const MODE_WORDS: Record<Mode, string> = { power: "power", temp: "power this turn", minions: "minion" };

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);

export function BaseCard({
  base,
  players,
  activePlayer,
  mode,
  onCount,
  onMinion,
  onScore,
  onBreakpoint,
  onSwap,
}: {
  base: BaseInPlay;
  players: PlayerInfo[];
  activePlayer: number;
  mode: Mode;
  onCount: (player: string, delta: number) => void;
  onMinion: (player: string, delta: 1 | -1, power: number) => void;
  onScore: () => void;
  onBreakpoint: (delta: number) => void;
  onSwap: () => void;
}) {
  const [menu, setMenu] = useState(false);
  /** The player whose minion pad is open. */
  const [pad, setPad] = useState<PlayerInfo | null>(null);
  const card = base.base.card ? BASE_BY_ID.get(base.base.card) : undefined;
  const total = totalPower(base);
  const breakpoint = breakpointOf(base);
  const ready = isReady(base);
  const name = base.base.name;

  return (
    <article
      aria-label={`${name}: ${total} of ${breakpoint} power${ready ? ", ready to score" : ""}`}
      className={`flex flex-col border bg-card transition-colors ${ready ? "border-accent" : "border-edge"}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-2xl leading-tight tracking-wide text-ink">{name}</h3>
          <p className="truncate font-mono text-[0.65rem] text-muted">
            {card ? `${SET_BY_ID.get(card.set)?.name} · ` : ""}pays {vpText(base.base.vps)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-2xl tabular-nums leading-tight text-ink">
            {total}
            <span className="text-base text-muted">/{breakpoint}</span>
          </p>
          {base.breakpointDelta ? (
            <p className="font-mono text-[0.65rem] text-muted">
              printed {base.base.breakpoint} {signed(base.breakpointDelta)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-4 mt-2 h-1.5 bg-surface" aria-hidden>
        <div
          className={`h-full transition-all ${ready ? "bg-accent" : "bg-muted"}`}
          style={{ width: `${breakpoint ? Math.min(100, (total / breakpoint) * 100) : 100}%` }}
        />
      </div>

      {card?.monsters && !base.breakpointDelta ? (
        <p className="px-4 pt-2 font-mono text-[0.65rem] leading-relaxed text-muted">
          Starts with {card.monsters} {card.monsters === 1 ? "monster" : "monsters"}: add their power to the breakpoint
          from the menu.
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col">
        {players.map((player, index) => {
          const counts = base.counts[player.id];
          const power = effectivePower(counts);
          return (
            <li
              key={player.id}
              className={`flex items-center gap-2 px-4 py-1 ${index === activePlayer ? "bg-surface" : ""}`}
            >
              <PlayerDot index={index} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm text-ink">{player.name}</span>
                <span className="block truncate font-mono text-[0.65rem] text-muted">
                  <span className={mode === "minions" ? "text-accent" : ""}>
                    {counts?.minions ?? 0} {counts?.minions === 1 ? "minion" : "minions"}
                  </span>
                  {counts?.temp ? (
                    <span className={mode === "temp" ? "text-accent" : ""}> · {signed(counts.temp)} this turn</span>
                  ) : null}
                </span>
              </span>
              <span
                className={`w-9 text-right font-mono text-2xl tabular-nums ${mode === "minions" ? "text-muted" : "text-ink"}`}
              >
                {power}
              </span>
              <StepButton
                label={`${player.name}: one less ${MODE_WORDS[mode]} on ${name}`}
                onClick={() => onCount(player.id, -1)}
                // Power and minions stop at 0; power this turn can go below, to take power away.
                disabled={mode !== "temp" && (counts?.[mode] ?? 0) <= 0}
              >
                −
              </StepButton>
              <StepButton label={`${player.name}: one more ${MODE_WORDS[mode]} on ${name}`} onClick={() => onCount(player.id, 1)}>
                +
              </StepButton>
              <StepButton label={`${player.name}: a minion played or lost on ${name}`} onClick={() => setPad(player)}>
                <PawnIcon />
              </StepButton>
            </li>
          );
        })}
      </ul>

      {pad ? (
        <MinionPad
          player={pad.name}
          base={name}
          canLose={(base.counts[pad.id]?.minions ?? 0) > 0}
          onClose={() => setPad(null)}
          onPick={(delta, power) => {
            onMinion(pad.id, delta, power);
            setPad(null);
          }}
        />
      ) : null}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2">
        {ready ? (
          <Button variant="primary" onClick={onScore}>
            Ready · Score it
          </Button>
        ) : (
          <span className="font-mono text-xs text-muted">{breakpoint - total} to go</span>
        )}
        <Button onClick={() => setMenu((open) => !open)} title="More for this base">
          {menu ? "Done" : "More"}
        </Button>
        {menu ? (
          <div className="flex w-full flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted">Breakpoint</span>
              <span className="flex items-center gap-1">
                <StepButton label={`Lower the breakpoint of ${name}`} onClick={() => onBreakpoint(-1)}>
                  −
                </StepButton>
                <span className="w-10 text-center font-mono text-lg tabular-nums">{breakpoint}</span>
                <StepButton label={`Raise the breakpoint of ${name}`} onClick={() => onBreakpoint(1)}>
                  +
                </StepButton>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!ready ? <Button onClick={onScore}>Score now</Button> : null}
              <Button onClick={onSwap} title="Replace it with another base, keeping the minions">
                Swap base
              </Button>
            </div>
          </div>
        ) : null}
      </footer>
    </article>
  );
}
