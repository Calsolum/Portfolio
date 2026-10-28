"use client";

import { useState } from "react";

import { Dialog } from "./common";

const POWERS = Array.from({ length: 12 }, (_, power) => power);

/**
 * A minion played or lost on a base, entered as one tap of its power: the
 * minion count and the power change together.
 */
export function MinionPad({
  player,
  base,
  canLose,
  onPick,
  onClose,
}: {
  player: string;
  base: string;
  /** Losing a minion needs one there to lose. */
  canLose: boolean;
  onPick: (delta: 1 | -1, power: number) => void;
  onClose: () => void;
}) {
  const [lost, setLost] = useState(false);
  const verb = lost ? "lost" : "played";

  return (
    <Dialog title={`${player} · ${base}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Played or lost" className="flex border border-edge">
          {(
            [
              [false, "Played"],
              [true, "Lost"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={lost === value}
              disabled={value && !canLose}
              onClick={() => setLost(value)}
              className={`min-h-11 flex-1 font-mono text-xs uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                lost === value ? "bg-accent text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-muted">The power of the minion {player} {verb}:</p>
        <div className="grid grid-cols-4 gap-2">
          {POWERS.map((power) => (
            <button
              key={power}
              type="button"
              aria-label={`${player} ${verb} a ${power}-power minion`}
              onClick={() => onPick(lost ? -1 : 1, power)}
              className="flex h-14 items-center justify-center border border-edge font-mono text-2xl tabular-nums text-ink transition-colors hover:border-accent hover:text-accent active:bg-accent active:text-bg"
            >
              {power}
            </button>
          ))}
        </div>
        <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
          Counts the minion and its power in one go. For power counters and effects, use the − and + buttons.
        </p>
      </div>
    </Dialog>
  );
}
