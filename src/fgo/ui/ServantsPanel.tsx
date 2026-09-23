"use client";

import { useMemo, useState } from "react";

import type { ServantListing } from "../atlas/client";
import type { SavedServant, SavedState, Settings } from "../state/store";
import { Button, Face, Label, NumberField, Panel, Select, classLabel, stars } from "./common";
import { ServantSearch } from "./Search";

const LEVEL_CAP: Record<number, number> = { 5: 90, 4: 80, 3: 70, 2: 65, 1: 60, 0: 65 };

export function newServant(
  s: ServantListing,
  settings: Settings,
  key = `own:${s.id}`,
): SavedServant {
  return {
    key,
    id: s.id,
    name: s.name,
    className: s.className,
    rarity: s.rarity,
    face: s.face,
    level: LEVEL_CAP[s.rarity] ?? 90,
    fou: settings.defaultFou,
    npLevel: settings.defaultNp,
    skillLevels: [settings.defaultSkills, settings.defaultSkills, settings.defaultSkills],
    appendLevels: {},
  };
}

const levelOptions = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const appendOptions = [{ value: 0, label: "–" }, ...levelOptions];

export function ServantEditor({
  servant,
  onChange,
  onRemove,
}: {
  servant: SavedServant;
  onChange: (s: SavedServant) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<SavedServant>) => onChange({ ...servant, ...patch });
  const setSkill = (i: number, v: number) => {
    const skillLevels = servant.skillLevels.slice();
    skillLevels[i] = v;
    set({ skillLevels });
  };
  return (
    <div className="flex flex-col gap-3 border border-edge bg-bg p-3">
      <div className="flex items-center gap-3">
        <Face src={servant.face} alt={servant.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{servant.name}</p>
          <p className="font-mono text-[0.65rem] text-muted">
            {classLabel(servant.className)} · {stars(servant.rarity)}
          </p>
        </div>
        <Button variant="danger" onClick={onRemove} title={`Remove ${servant.name}`}>
          Remove
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <NumberField label="Level" value={servant.level} min={1} max={120} onChange={(level) => set({ level })} />
        <Select
          label="NP"
          value={servant.npLevel}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `NP${n}` }))}
          onChange={(npLevel) => set({ npLevel })}
        />
        <Select
          label="ATK fou"
          value={servant.fou}
          options={[0, 500, 1000, 1500, 2000].map((n) => ({ value: n, label: `+${n}` }))}
          onChange={(fou) => set({ fou })}
        />
        {[0, 1, 2].map((i) => (
          <Select
            key={i}
            label={`S${i + 1}`}
            value={servant.skillLevels[i] ?? 10}
            options={levelOptions}
            onChange={(v) => setSkill(i, v)}
          />
        ))}
      </div>
      <details>
        <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
          Append skills
        </summary>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <Select
              key={n}
              label={n === 2 ? "A2 · NP charge" : n === 3 ? "A3 · vs class" : `A${n}`}
              value={servant.appendLevels[n] ?? 0}
              options={appendOptions}
              onChange={(v) => set({ appendLevels: { ...servant.appendLevels, [n]: v } })}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

export function ServantsPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const [adding, setAdding] = useState(state.servants.length === 0);
  const [filter, setFilter] = useState("");
  const owned = useMemo(() => new Set(state.servants.map((s) => s.id)), [state.servants]);

  const add = (list: ServantListing[]) =>
    update((s) => ({
      ...s,
      servants: [
        ...s.servants,
        ...list.filter((l) => !s.servants.some((x) => x.id === l.id)).map((l) => newServant(l, s.settings)),
      ],
    }));

  const shown = state.servants.filter(
    (s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const setDefault = (patch: Partial<Settings>) =>
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={`Your servants (${state.servants.length})`}
        aside={
          <Button variant={adding ? "ghost" : "primary"} onClick={() => setAdding(!adding)}>
            {adding ? "Done adding" : "Add servants"}
          </Button>
        }
      >
        {adding ? (
          <div className="mb-6 flex flex-col gap-4 border-b border-edge pb-6">
            <div className="flex flex-wrap items-end gap-3">
              <Label>New servants start at:</Label>
              <Select
                label="Skills"
                value={state.settings.defaultSkills}
                options={levelOptions.map((o) => ({ ...o, label: `${o.value}/${o.value}/${o.value}` }))}
                onChange={(defaultSkills) => setDefault({ defaultSkills })}
              />
              <Select
                label="NP"
                value={state.settings.defaultNp}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `NP${n}` }))}
                onChange={(defaultNp) => setDefault({ defaultNp })}
              />
              <Select
                label="ATK fou"
                value={state.settings.defaultFou}
                options={[0, 1000, 2000].map((n) => ({ value: n, label: `+${n}` }))}
                onChange={(defaultFou) => setDefault({ defaultFou })}
              />
            </div>
            <ServantSearch owned={owned} onPick={(s) => add([s])} onPickMany={add} />
          </div>
        ) : null}

        {state.servants.length === 0 ? (
          <p className="font-mono text-xs text-muted">
            Add the servants you own. Filter by class or rarity and use &ldquo;Add all&rdquo; to enter a
            whole class at once, then adjust NP and skill levels where they differ from the defaults.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {state.servants.length > 6 ? (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter your servants"
                className="border border-edge bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((servant) => (
                <ServantEditor
                  key={servant.key}
                  servant={servant}
                  onChange={(next) =>
                    update((s) => ({
                      ...s,
                      servants: s.servants.map((x) => (x.key === next.key ? next : x)),
                    }))
                  }
                  onRemove={() =>
                    update((s) => ({ ...s, servants: s.servants.filter((x) => x.key !== servant.key) }))
                  }
                />
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
