"use client";

import { useState } from "react";

import { Button } from "@/components/ui/controls";

import { BONUS_NOTES, breakpointOf, standings, suggestedAwards, totalPower } from "../lib/scoring";
import type { Award, BaseInPlay, PlayerInfo } from "../types";
import { Dialog, PlayerDot, Stepper, ordinal, vpText } from "./common";

/**
 * The scoring sheet: who placed where by the rulebook, and the VP each gets,
 * filled in and open to change before it is confirmed. Base abilities that
 * hand out VP in ways the tracker can't see are settled here by hand.
 */
export function ScoreSheet({
  base,
  players,
  onConfirm,
  onClose,
}: {
  base: BaseInPlay;
  players: PlayerInfo[];
  onConfirm: (awards: Award[]) => void;
  onClose: () => void;
}) {
  const rows = standings(base, players);
  const [vp, setVp] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((row) => [row.player, row.vp + row.bonus])),
  );
  const indexOf = (id: string) => players.findIndex((player) => player.id === id);
  const nameOf = (id: string) => players[indexOf(id)]?.name ?? "Someone";
  const total = totalPower(base);
  const breakpoint = breakpointOf(base);
  const changed = suggestedAwards(rows).some((award) => vp[award.player] !== award.vp);

  return (
    <Dialog title={`Score ${base.base.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs leading-relaxed text-muted">
          {total} power against a breakpoint of {breakpoint}
          {total < breakpoint ? " (not reached, scoring anyway)" : ""}. Pays {vpText(base.base.vps)}.
        </p>

        <ul className="flex flex-col divide-y divide-edge border-y border-edge">
          {rows.map((row) => (
            <li key={row.player} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <PlayerDot index={indexOf(row.player)} />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm text-ink">{nameOf(row.player)}</span>
                  <span className="block font-mono text-[0.65rem] text-muted">
                    {row.eligible
                      ? `${row.place ? ordinal(row.place) : "4th or lower"} · ${row.power} power · ${row.minions} ${row.minions === 1 ? "minion" : "minions"}`
                      : "Nothing here, so no points"}
                    {row.bonus ? ` · +${row.bonus} from the base` : ""}
                  </span>
                </span>
              </span>
              <Stepper
                label={`VP for ${nameOf(row.player)}`}
                value={vp[row.player] ?? 0}
                onChange={(value) => setVp((prev) => ({ ...prev, [row.player]: value }))}
              />
            </li>
          ))}
        </ul>

        {base.base.bonus ? <p className="font-mono text-xs text-muted">{BONUS_NOTES[base.base.bonus]}</p> : null}
        <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
          Ties share the best place they tied for, and the places they fill are used up. Change any number for a
          base ability that pays out another way{changed ? "; yours replace the suggestion" : ""}.
        </p>

        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              onConfirm(
                rows
                  .map((row) => ({ player: row.player, vp: vp[row.player] ?? 0 }))
                  .filter((award) => award.vp !== 0),
              )
            }
          >
            Score it
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
