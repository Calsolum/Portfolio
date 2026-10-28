"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Button, Notice } from "@/components/ui/controls";

import { activePlayer, findBase, lastUndoable } from "../lib/game";
import { isReady } from "../lib/scoring";
import type { Action, BaseSnapshot, GameState } from "../types";
import { BaseCard, type Mode } from "./BaseCard";
import { BasePicker } from "./BasePicker";
import { Dialog, PlayerDot, Stepper } from "./common";
import { ScoreSheet } from "./ScoreSheet";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "power", label: "Power", hint: "Minions played, +1 power counters: power that stays." },
  { id: "temp", label: "This turn", hint: "Power until the end of the turn; End turn clears it." },
  { id: "minions", label: "Minions", hint: "How many minions each player has here." },
];

type Picking = { kind: "place"; slot: number } | { kind: "swap"; base: string };

export function Board({
  board,
  device,
  shared,
  owned,
  dispatch,
  onNewGame,
  onRematch,
  toolbar,
}: {
  board: GameState;
  device: string;
  /** In a shared game, Undo takes back this phone's own last change. */
  shared: boolean;
  owned: ReadonlySet<string>;
  dispatch: (action: Action) => void;
  onNewGame: () => void;
  /** A new game with the same players, factions and seating. */
  onRematch: () => void;
  toolbar?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("power");
  const [scoring, setScoring] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [vpFor, setVpFor] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const active = activePlayer(board);
  const undoable = lastUndoable(board, shared ? device : undefined);
  const ready = board.slots.filter((base) => base && isReady(base));
  const inPlay = useMemo(
    () => new Set(board.slots.flatMap((base) => (base?.base.card ? [base.base.card] : []))),
    [board.slots],
  );
  const seen = useMemo(() => new Set(board.seen), [board.seen]);
  const nameOf = (id: string) => board.players.find((player) => player.id === id)?.name ?? "Someone";
  const scoringBase = scoring ? findBase(board, scoring) : undefined;

  // In a shared game another phone can get there first: the base scores, or the slot is filled.
  // A sheet or picker for something that has gone closes rather than coming back if that is undone.
  if (scoring && !scoringBase) setScoring(null);
  if (
    (picking?.kind === "swap" && !findBase(board, picking.base)) ||
    (picking?.kind === "place" && board.slots[picking.slot])
  ) {
    setPicking(null);
  }
  const leaderVp = Math.max(...board.players.map((player) => board.vp[player.id]));
  const won = board.result?.kind === "won" ? board.result : null;
  /** The VP shown in the accent colour: the leaders during play, the winners once the game is won (after Madness). */
  const highlighted = (id: string) => (won ? won.winners.includes(id) : board.vp[id] === leaderVp && leaderVp > 0);

  const endTurn = () => {
    setConfirmEnd(false);
    dispatch({ type: "endTurn" });
  };

  const pick = (base: BaseSnapshot) => {
    if (picking?.kind === "place") dispatch({ type: "place", slot: picking.slot, base });
    else if (picking?.kind === "swap") dispatch({ type: "swap", base: picking.base, to: base });
    setPicking(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Turn"
        className="sticky top-16 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-y border-edge bg-bg/95 px-6 py-2 backdrop-blur md:mx-0 md:border-x md:px-4"
      >
        <p className="flex items-center gap-2 font-mono text-sm text-ink">
          <span className="text-muted">Turn {board.turn.number}</span>
          <PlayerDot index={board.turn.player} />
          <span className="font-semibold">{active.name}</span>
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => undoable && dispatch({ type: "undo", target: undoable })}
            disabled={!undoable}
            title={shared ? "Take back your last change" : "Take back the last change"}
          >
            Undo
          </Button>
          <Button variant="primary" onClick={() => (ready.length ? setConfirmEnd(true) : endTurn())}>
            End turn
          </Button>
        </div>
      </section>

      <section aria-label="Victory points" className="flex flex-wrap gap-2">
        {board.players.map((player, index) => {
          const madness = board.madness?.[player.id];
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => setVpFor(player.id)}
              aria-label={`${player.name}: ${board.vp[player.id]} VP${madness !== undefined ? `, ${madness} Madness` : ""}. Change`}
              className={`flex min-h-11 items-center gap-2 border px-3 py-1 font-mono text-sm transition-colors hover:border-accent ${
                index === board.turn.player ? "border-ink" : "border-edge"
              }`}
            >
              <PlayerDot index={index} />
              <span className="text-ink">{player.name}</span>
              <span className={`tabular-nums ${highlighted(player.id) ? "text-accent" : "text-muted"}`}>
                {board.vp[player.id]}
              </span>
              {madness ? <span className="text-[0.65rem] text-accent2">{madness} Madness</span> : null}
            </button>
          );
        })}
        <span className="self-center font-mono text-[0.65rem] text-muted">to {board.target} VP</span>
      </section>

      {won ? (
        <section aria-live="polite" className="flex flex-col gap-3 border border-accent bg-card p-4">
          <p className="font-display text-3xl tracking-wide text-accent">
            {won.winners.map(nameOf).join(" and ")} {won.winners.length > 1 ? "share the win" : "wins"} with{" "}
            {won.final[won.winners[0]]} VP
          </p>
          {board.madness ? (
            <p className="font-mono text-xs leading-relaxed text-ink">
              After Madness: {board.players.map((player) => `${player.name} ${won.final[player.id]}`).join(", ")}.
              Every two Madness cards cost 1 VP, and level totals go to the player with fewer Madness.
            </p>
          ) : null}
          <p className="font-mono text-xs text-muted">
            Saved to this device&apos;s history. Undo takes it back if the last change was a mistake.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onRematch} title="Same players, factions and seats; pick new bases">
              Rematch
            </Button>
            <Button onClick={onNewGame}>New game</Button>
          </div>
        </section>
      ) : board.result?.kind === "tied" ? (
        <section aria-live="polite" className="border border-accent2 bg-card p-4">
          <p className="font-mono text-sm text-ink">
            {board.result.leaders.map(nameOf).join(" and ")} are tied on {board.vp[board.result.leaders[0]]} VP. Play
            another turn: the first to pull ahead at the end of a turn wins.
          </p>
        </section>
      ) : null}

      <section aria-label="What the buttons change" className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="What the buttons change" className="flex border border-edge">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={mode === option.id}
              onClick={() => setMode(option.id)}
              className={`min-h-11 flex-1 px-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
                mode === option.id ? "bg-accent text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[0.65rem] text-muted">{MODES.find((option) => option.id === mode)?.hint}</p>
      </section>

      <section aria-label="Bases" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.slots.map((base, slot) =>
          base ? (
            <BaseCard
              key={base.key}
              base={base}
              players={board.players}
              activePlayer={board.turn.player}
              mode={mode}
              onCount={(player, delta) => dispatch({ type: mode, base: base.key, player, delta })}
              onMinion={(player, delta, power) => dispatch({ type: "minion", base: base.key, player, delta, power })}
              onScore={() => setScoring(base.key)}
              onBreakpoint={(delta) => dispatch({ type: "breakpoint", base: base.key, delta })}
              onSwap={() => setPicking({ kind: "swap", base: base.key })}
            />
          ) : (
            <div
              key={`empty-${slot}`}
              className="flex min-h-48 flex-col items-center justify-center gap-3 border border-dashed border-edge p-4 text-center"
            >
              <p className="font-mono text-xs text-muted">A new base takes the place of the one that scored.</p>
              <Button variant="primary" onClick={() => setPicking({ kind: "place", slot })}>
                Choose the next base
              </Button>
            </div>
          ),
        )}
      </section>

      {toolbar}

      <details className="border border-edge bg-card">
        <summary className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-[0.15em] text-muted hover:text-accent">
          Game log · {board.log.length - 1} {board.log.length === 2 ? "change" : "changes"}
        </summary>
        <ol className="flex max-h-96 flex-col overflow-y-auto border-t border-edge">
          {[...board.log].reverse().map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 border-b border-edge px-4 py-1.5">
              <span
                className={`font-mono text-xs ${
                  line.status === "undone" ? "text-muted line-through" : line.status === "skipped" ? "text-muted" : "text-ink"
                }`}
              >
                {line.text}
                {line.status === "skipped" ? " (no longer applied)" : ""}
              </span>
              {line.status === "done" && line.type !== "setup" ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "undo", target: line.id })}
                  className="min-h-9 shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted hover:text-accent2"
                >
                  Undo
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </details>

      {scoringBase ? (
        <ScoreSheet
          base={scoringBase}
          players={board.players}
          onClose={() => setScoring(null)}
          onConfirm={(awards) => {
            dispatch({ type: "score", base: scoringBase.key, awards });
            setScoring(null);
          }}
        />
      ) : null}

      {picking ? (
        <BasePicker
          title={picking.kind === "place" ? "Choose the next base" : "Swap for which base?"}
          owned={owned}
          inPlay={inPlay}
          seen={seen}
          onPick={pick}
          onClose={() => setPicking(null)}
        />
      ) : null}

      {vpFor ? (
        <Dialog title={nameOf(vpFor)} onClose={() => setVpFor(null)}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted">VP</span>
              <Stepper
                label={`${nameOf(vpFor)}'s VP`}
                value={board.vp[vpFor] ?? 0}
                onChange={(value) => dispatch({ type: "vp", player: vpFor, delta: value - (board.vp[vpFor] ?? 0) })}
              />
            </div>
            <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
              For VP gained or lost outside scoring, such as from a base&apos;s ability.
            </p>
            {board.madness ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-xs text-muted">Madness</span>
                  <Stepper
                    label={`${nameOf(vpFor)}'s Madness`}
                    value={board.madness[vpFor] ?? 0}
                    min={0}
                    max={30}
                    onChange={(value) =>
                      dispatch({ type: "madness", player: vpFor, delta: value - (board.madness?.[vpFor] ?? 0) })
                    }
                  />
                </div>
                <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
                  Madness cards in hand, deck and discard. Every two cost 1 VP when the game ends.
                </p>
              </>
            ) : null}
            <Button
              disabled={board.players[board.turn.player]?.id === vpFor}
              onClick={() => {
                dispatch({ type: "turn", player: vpFor });
                setVpFor(null);
              }}
              title="For extra turns, such as from Portal Room, or to put the turn right"
            >
              {board.players[board.turn.player]?.id === vpFor ? "It's their turn" : `Make it ${nameOf(vpFor)}'s turn`}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {confirmEnd ? (
        <Dialog title="Bases ready to score" onClose={() => setConfirmEnd(false)}>
          <div className="flex flex-col gap-4">
            <Notice>
              {ready.map((base) => base?.base.name).join(", ")} {ready.length === 1 ? "has" : "have"} reached the
              breakpoint. Bases score before the turn ends.
            </Notice>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={() => setConfirmEnd(false)}>Back to the board</Button>
              <Button variant="danger" onClick={endTurn}>
                End the turn anyway
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
