"use client";

import { useMemo, useState } from "react";

import {
  type EquipListing,
  type ServantListing,
  listEquips,
  listServants,
} from "../atlas/client";
import {
  Button,
  CLASS_LABEL,
  Face,
  LoadError,
  Notice,
  TextInput,
  classLabel,
  stars,
  useAsync,
} from "./common";

const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const LIMIT = 40;

export function ServantSearch({
  onPick,
  onPickMany,
  owned,
  pickLabel = "Add",
}: {
  onPick: (s: ServantListing) => void;
  onPickMany?: (s: ServantListing[]) => void;
  owned?: Set<number>;
  pickLabel?: string;
}) {
  const list = useAsync(listServants);
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("");
  const [rarity, setRarity] = useState(0);
  const [hideOwned, setHideOwned] = useState(true);

  const matches = useMemo(() => {
    const q = normalise(query.trim());
    return (list.data ?? []).filter(
      (s) =>
        (!q || normalise(s.name).includes(q) || String(s.collectionNo) === q) &&
        (!cls || s.className === cls) &&
        (!rarity || s.rarity === rarity) &&
        !(hideOwned && owned?.has(s.id)),
    );
  }, [list.data, query, cls, rarity, hideOwned, owned]);

  if (list.error) return <LoadError error={list.error} retry={list.retry} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput label="Find a servant" value={query} onChange={setQuery} placeholder="Name or collection no." />
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">Class</span>
          <select
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            className="border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink"
          >
            <option value="">All</option>
            {Object.entries(CLASS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">Rarity</span>
          <select
            value={rarity}
            onChange={(e) => setRarity(Number(e.target.value))}
            className="border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink"
          >
            <option value={0}>All</option>
            {[5, 4, 3, 2, 1, 0].map((r) => (
              <option key={r} value={r}>
                {r ? stars(r) : "0★"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {owned ? (
        <label className="flex items-center gap-2 font-mono text-xs text-muted">
          <input type="checkbox" checked={hideOwned} onChange={(e) => setHideOwned(e.target.checked)} />
          Hide servants already added
        </label>
      ) : null}

      {list.loading ? (
        <Notice>Loading the servant list…</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted">
              {matches.length} match{matches.length === 1 ? "" : "es"}
              {matches.length > LIMIT ? ` · showing ${LIMIT}` : ""}
            </span>
            {onPickMany && matches.length > 0 && (query || cls || rarity) ? (
              <Button onClick={() => onPickMany(matches)}>Add all {matches.length}</Button>
            ) : null}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {matches.slice(0, LIMIT).map((s) => (
              <li key={s.id} className="flex items-center gap-3 border border-edge bg-bg p-2">
                <Face src={s.face} alt={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{s.name}</p>
                  <p className="font-mono text-[0.65rem] text-muted">
                    #{s.collectionNo} · {classLabel(s.className)} · {stars(s.rarity)}
                  </p>
                </div>
                <Button onClick={() => onPick(s)}>{pickLabel}</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function EquipSearch({
  onPick,
  owned,
  pickLabel = "Add",
}: {
  onPick: (e: EquipListing) => void;
  owned?: Set<number>;
  pickLabel?: string;
}) {
  const list = useAsync(listEquips);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState(0);

  const matches = useMemo(() => {
    const q = normalise(query.trim());
    return (list.data ?? []).filter(
      (e) =>
        (!q || normalise(e.name).includes(q) || String(e.collectionNo) === q) &&
        (!rarity || e.rarity === rarity) &&
        !owned?.has(e.id),
    );
  }, [list.data, query, rarity, owned]);

  if (list.error) return <LoadError error={list.error} retry={list.retry} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput label="Find a craft essence" value={query} onChange={setQuery} placeholder="Name or collection no." />
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">Rarity</span>
          <select
            value={rarity}
            onChange={(e) => setRarity(Number(e.target.value))}
            className="border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink"
          >
            <option value={0}>All</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {stars(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.loading ? (
        <Notice>Loading the craft essence list…</Notice>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {matches.slice(0, LIMIT).map((e) => (
            <li key={e.id} className="flex items-center gap-3 border border-edge bg-bg p-2">
              <Face src={e.face} alt={e.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{e.name}</p>
                <p className="font-mono text-[0.65rem] text-muted">
                  #{e.collectionNo} · {stars(e.rarity)}
                </p>
              </div>
              <Button onClick={() => onPick(e)}>{pickLabel}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
