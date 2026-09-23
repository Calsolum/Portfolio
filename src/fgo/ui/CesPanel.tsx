"use client";

import { useMemo, useState } from "react";

import type { EquipListing } from "../atlas/client";
import type { SavedState } from "../state/store";
import { Button, Face, Panel, stars } from "./common";
import { EquipSearch } from "./Search";

export function CesPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const [adding, setAdding] = useState(state.ces.length === 0);
  const owned = useMemo(() => new Set(state.ces.map((c) => c.id)), [state.ces]);

  const add = (e: EquipListing) =>
    update((s) =>
      s.ces.some((c) => c.id === e.id)
        ? s
        : {
            ...s,
            ces: [...s.ces, { id: e.id, name: e.name, rarity: e.rarity, face: e.face, mlb: true, count: 1 }],
          },
    );

  const patch = (id: number, p: Partial<SavedState["ces"][number]>) =>
    update((s) => ({ ...s, ces: s.ces.map((c) => (c.id === id ? { ...c, ...p } : c)) }));

  return (
    <Panel
      title={`Craft essences (${state.ces.length})`}
      aside={
        <Button variant={adding ? "ghost" : "primary"} onClick={() => setAdding(!adding)}>
          {adding ? "Done adding" : "Add CEs"}
        </Button>
      }
    >
      {adding ? (
        <div className="mb-6 border-b border-edge pb-6">
          <EquipSearch owned={owned} onPick={add} />
        </div>
      ) : null}

      {state.ces.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          Add the CEs that matter for farming: starting NP gauge (Kaleidoscope, Black Grail, event
          CEs with charge), NP damage, and card-type buffs. Mark each as max limit broken or not;
          it changes the numbers.
        </p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {state.ces.map((ce) => (
            <li key={ce.id} className="flex flex-wrap items-center gap-3 border border-edge bg-bg p-2">
              <Face src={ce.face} alt={ce.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{ce.name}</p>
                <p className="font-mono text-[0.65rem] text-muted">{stars(ce.rarity)}</p>
              </div>
              <label className="flex items-center gap-2 font-mono text-xs text-muted">
                <input type="checkbox" checked={ce.mlb} onChange={(e) => patch(ce.id, { mlb: e.target.checked })} />
                MLB
              </label>
              <label className="flex items-center gap-2 font-mono text-xs text-muted">
                Copies
                <select
                  value={ce.count}
                  onChange={(e) => patch(ce.id, { count: Number(e.target.value) })}
                  className="border border-edge bg-bg px-1 py-1 text-ink"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="danger"
                onClick={() => update((s) => ({ ...s, ces: s.ces.filter((c) => c.id !== ce.id) }))}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
