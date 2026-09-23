"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Plan, PlanTurn } from "../engine/optimize";
import { type RunStatus, buildInput, runSearch } from "../state/run";
import type { SavedState, Settings } from "../state/store";
import { Button, Face, Label, Notice, Panel, Select } from "./common";

const pct = (n: number) => `${Math.floor(n * 100)}%`;

function EnemyBar({ name, hp, damage, ratio }: { name: string; hp: number; damage: number; ratio: number }) {
  const width = Math.min(100, ratio * 50);
  const ok = ratio >= 1;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-2 font-mono text-[0.65rem] text-muted">
        <span className="truncate">{name}</span>
        <span className={ok ? "text-ink" : "text-accent2"}>
          {damage.toLocaleString()} / {hp.toLocaleString()} · {pct(ratio)}
        </span>
      </div>
      <div className="relative h-1.5 bg-surface" aria-hidden>
        <div className={`absolute inset-y-0 left-0 ${ok ? "bg-accent" : "bg-accent2"}`} style={{ width: `${width}%` }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-muted" />
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: PlanTurn }) {
  return (
    <li className="grid gap-2 border-t border-edge pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Turn {turn.wave}</Label>
        <span className="font-mono text-[0.65rem] text-muted">
          gauge {pct(turn.gaugeBefore / 10000)} → OC{turn.oc} · refund {pct(turn.refund / 10000)}
        </span>
      </div>
      {turn.actions.length ? (
        <ol className="grid gap-1">
          {turn.actions.map((a, i) => (
            <li key={i} className="text-sm text-ink">
              <span className="text-muted">{a.actor}</span> {a.skill}
              {a.option ? <span className="text-muted"> ({a.option})</span> : null}
              {a.target ? <span className="text-accent"> → {a.target}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No skills needed.</p>
      )}
      <p className="text-sm text-ink">
        <span className="text-accent">NP</span> {turn.attacker} · {turn.np}
      </p>
      <div className="grid gap-2">
        {turn.hits.map((h, i) => (
          <EnemyBar key={i} {...h} />
        ))}
      </div>
    </li>
  );
}

function PlanCard({ plan, rank, faces }: { plan: Plan; rank: number; faces: Map<string, string | undefined> }) {
  return (
    <article className="border border-edge bg-bg">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-edge px-4 py-3">
        <p className="font-display text-2xl text-accent">#{rank}</p>
        <p className="font-mono text-xs text-ink">
          {plan.turns.length} turns · {plan.taps} skill tap{plan.taps === 1 ? "" : "s"} · worst margin{" "}
          <span className="text-accent">{pct(plan.minRatio)}</span>
        </p>
      </header>
      <div className="grid gap-4 p-4">
        <ul className="grid gap-2 sm:grid-cols-3">
          {plan.team.map((m) => (
            <li key={m.key} className="flex items-center gap-2">
              <Face src={faces.get(m.key)} alt={m.label} size={44} />
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{m.label}</p>
                <p className="truncate font-mono text-[0.65rem] text-muted">
                  {m.role === "attacker" ? "Attacker" : "Support"}
                  {m.ce ? ` · ${m.ce}` : m.isFriend ? "" : " · any CE"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {plan.mysticCode ? (
          <p className="font-mono text-xs text-muted">
            Mystic code: <span className="text-ink">{plan.mysticCode}</span>
          </p>
        ) : null}
        <ol className="grid gap-3">
          {plan.turns.map((t) => (
            <TurnView key={t.wave} turn={t} />
          ))}
        </ol>
        {plan.notes.length || plan.ignored.length ? (
          <details className="border-t border-edge pt-3">
            <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
              Caveats ({plan.notes.length + plan.ignored.length})
            </summary>
            <ul className="mt-2 grid gap-1 font-mono text-[0.7rem] text-muted">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              {plan.ignored.map((n) => (
                <li key={n}>Not modelled: {n}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  );
}

export function PlanPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const cancel = useRef<(() => void) | null>(null);

  useEffect(() => () => cancel.current?.(), []);

  const faces = useMemo(
    () => new Map([...state.servants, ...state.friends].map((s) => [s.key, s.face])),
    [state.servants, state.friends],
  );

  const setSetting = (patch: Partial<Settings>) =>
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const running = status?.phase === "loading" || status?.phase === "searching";
  const blockers = [
    !state.quest && "Pick a quest.",
    state.servants.length + state.friends.length === 0 && "Add some servants or friend supports.",
  ].filter(Boolean) as string[];

  const start = async () => {
    cancel.current?.();
    setMissing([]);
    setStatus({ phase: "loading", message: "Loading game data", done: 0, total: 1 });
    try {
      const { input, missing } = await buildInput(state, setStatus);
      setMissing(missing);
      cancel.current = runSearch(input, setStatus);
    } catch (err) {
      setStatus({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const stop = () => {
    cancel.current?.();
    cancel.current = null;
    setStatus((s) => (s?.phase === "searching" ? { phase: "done", result: s.result } : null));
  };

  const result = status && (status.phase === "searching" || status.phase === "done") ? status.result : null;

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Find teams">
        <div className="grid gap-4">
          <p className="font-mono text-xs leading-relaxed text-muted">
            Searches your servants, CEs, friend supports and mystic codes for loadouts where one NP
            clears each wave, then ranks them by fewest turns, then fewest skill taps, then the
            biggest damage margin. Damage is checked at the lowest random roll, so every listed clear
            works on any roll.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Required margin"
              value={state.settings.safety}
              options={[
                { value: 1, label: "100% (min roll)" },
                { value: 1.05, label: "105%" },
                { value: 1.1, label: "110%" },
                { value: 1.2, label: "120%" },
              ]}
              onChange={(safety) => setSetting({ safety })}
            />
            <Select
              label="Results"
              value={state.settings.maxResults}
              options={[6, 12, 24].map((n) => ({ value: n, label: String(n) }))}
              onChange={(maxResults) => setSetting({ maxResults })}
            />
            <Select
              label="Search time"
              value={state.settings.timeBudgetSec}
              options={[10, 20, 40, 90].map((n) => ({ value: n, label: `${n}s` }))}
              onChange={(timeBudgetSec) => setSetting({ timeBudgetSec })}
            />
            {running ? (
              <Button variant="danger" onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" onClick={start} disabled={blockers.length > 0}>
                Find teams
              </Button>
            )}
          </div>
          {blockers.map((b) => (
            <Notice key={b}>{b}</Notice>
          ))}
          <p className="font-mono text-[0.65rem] text-muted">
            {state.servants.length} servants · {state.ces.length} CEs · {state.friends.length} friend
            supports · {state.mysticCodes.length} mystic codes
            {state.quest ? ` · ${state.quest.name}` : ""}
          </p>

          {status?.phase === "loading" ? (
            <Notice>
              {status.message}… {status.done}/{status.total}
            </Notice>
          ) : null}
          {status?.phase === "error" ? <Notice tone="error">{status.message}</Notice> : null}
          {missing.length ? (
            <Notice tone="error">Couldn&apos;t load and skipped: {missing.join(", ")}</Notice>
          ) : null}
          {result ? (
            <div className="grid gap-1">
              <div className="h-1 bg-surface" aria-hidden>
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{
                    width: `${result.progress.total ? (result.progress.tried / result.progress.total) * 100 : 100}%`,
                  }}
                />
              </div>
              <p className="font-mono text-[0.65rem] text-muted">
                {status?.phase === "done" ? "Finished" : "Searching"} · {result.progress.tried}/
                {result.progress.total} team shapes · {result.progress.loadouts.toLocaleString()} loadouts ·{" "}
                {(result.progress.elapsedMs / 1000).toFixed(1)}s
                {status?.phase === "done" && result.progress.tried < result.progress.total
                  ? " · stopped at the time limit; raise it to search further"
                  : ""}
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      {result && result.plans.length > 0 ? (
        <div className="grid gap-4">
          {result.plans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} rank={i + 1} faces={faces} />
          ))}
        </div>
      ) : null}

      {result && result.plans.length === 0 && status?.phase === "done" ? (
        <Panel title="No clean clear found">
          <p className="mb-4 font-mono text-xs leading-relaxed text-muted">
            None of the loadouts clears every wave in one NP each at the required margin. These came
            closest, even with every skill in the team used on the attacker:
          </p>
          <ul className="grid gap-3">
            {result.nearMisses.map((m) => (
              <li key={m.id} className="border border-edge bg-bg p-3">
                <p className="text-sm text-ink">
                  {m.team.map((t) => t.label + (t.ce ? ` [${t.ce}]` : "")).join(" · ")}
                  {m.mysticCode ? ` · ${m.mysticCode}` : ""}
                </p>
                <p className="mt-1 font-mono text-xs text-accent2">{m.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
