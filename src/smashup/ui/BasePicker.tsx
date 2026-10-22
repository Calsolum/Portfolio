"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/controls";

import type { BaseCard } from "../data/bases";
import { MAX_BASE_NAME, cleanName } from "../lib/actions";
import { ALL_SET_IDS, SET_BY_ID, searchBases, snapshotOf } from "../lib/catalog";
import type { BaseSnapshot } from "../types";
import { Dialog, Stepper, vpText } from "./common";

const SHOWN = 60;

function CustomBase({ onPick }: { onPick: (base: BaseSnapshot) => void }) {
  const [name, setName] = useState("");
  const [breakpoint, setBreakpoint] = useState(20);
  const [vps, setVps] = useState<[number, number, number]>([4, 2, 1]);
  const clean = cleanName(name, MAX_BASE_NAME);

  return (
    <details className="border border-edge">
      <summary className="cursor-pointer px-3 py-3 font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-accent">
        A base that isn&apos;t listed
      </summary>
      <div className="flex flex-col gap-3 border-t border-edge p-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">Name</span>
          <input
            value={name}
            maxLength={MAX_BASE_NAME}
            onChange={(e) => setName(e.target.value)}
            className="border border-edge bg-bg px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted">Breakpoint</span>
          <Stepper label="Breakpoint" value={breakpoint} min={1} max={60} onChange={setBreakpoint} />
        </div>
        {(["1st", "2nd", "3rd"] as const).map((place, i) => (
          <div key={place} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted">VP for {place}</span>
            <Stepper
              label={`VP for ${place}`}
              value={vps[i]}
              min={0}
              max={20}
              onChange={(value) => setVps((prev) => prev.map((vp, j) => (j === i ? value : vp)) as [number, number, number])}
            />
          </div>
        ))}
        <Button
          variant="primary"
          disabled={!clean}
          onClick={() => clean && onPick({ name: clean, breakpoint, vps })}
        >
          Use this base
        </Button>
      </div>
    </details>
  );
}

function BaseOption({ base, used, onPick }: { base: BaseCard; used: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-edge px-3 py-2 text-left transition-colors hover:bg-surface hover:text-accent"
      >
        <span className="min-w-0">
          <span className={`block truncate font-mono text-sm ${used ? "text-muted" : "text-ink"}`}>
            {base.name}
            {used ? <span className="ml-2 text-[0.65rem] uppercase tracking-[0.12em]">used</span> : null}
          </span>
          <span className="block truncate font-mono text-[0.65rem] text-muted">
            {SET_BY_ID.get(base.set)?.name}
            {base.monsters ? ` · ${base.monsters} ${base.monsters === 1 ? "monster" : "monsters"}` : ""}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          {base.breakpoint} · {vpText(base.vps)}
        </span>
      </button>
    </li>
  );
}

/** Pick a base by name from the sets the player owns, or type one in. */
export function BasePicker({
  title,
  owned,
  inPlay,
  seen,
  onPick,
  onClose,
}: {
  title: string;
  owned: ReadonlySet<string>;
  /** Card ids of the bases in play, which can't come out twice. */
  inPlay: ReadonlySet<string>;
  /** Card ids that have already been out this game, listed last. */
  seen: ReadonlySet<string>;
  onPick: (base: BaseSnapshot) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [everything, setEverything] = useState(false);

  const results = useMemo(() => {
    const sets = everything ? new Set(ALL_SET_IDS) : owned;
    const found = searchBases(query, sets).filter((base) => !inPlay.has(base.id));
    return [...found.filter((base) => !seen.has(base.id)), ...found.filter((base) => seen.has(base.id))];
  }, [query, everything, owned, inPlay, seen]);

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          data-autofocus
          placeholder="Type a base's name"
          aria-label="Search bases"
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-edge bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-2 font-mono text-xs text-muted">
          <input type="checkbox" checked={everything} onChange={(e) => setEverything(e.target.checked)} />
          Include sets you haven&apos;t ticked as yours
        </label>
        {results.length ? (
          <ul className="max-h-[45dvh] overflow-y-auto border-t border-edge">
            {results.slice(0, SHOWN).map((base) => (
              <BaseOption key={base.id} base={base} used={seen.has(base.id)} onPick={() => onPick(snapshotOf(base))} />
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-muted">No base by that name in your sets.</p>
        )}
        {results.length > SHOWN ? (
          <p className="font-mono text-[0.65rem] text-muted">
            {results.length - SHOWN} more. Keep typing to narrow it down.
          </p>
        ) : null}
        <CustomBase onPick={onPick} />
      </div>
    </Dialog>
  );
}
