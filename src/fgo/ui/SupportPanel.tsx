"use client";

import { useState } from "react";

import { type ServantListing, listMysticCodes, listServants } from "../atlas/client";
import type { SavedFriend, SavedState } from "../state/store";
import { Button, Face, LoadError, Notice, Panel, Select, useAsync } from "./common";
import { EquipSearch, ServantSearch } from "./Search";
import { ServantEditor, newServant } from "./ServantsPanel";

/** Supports that are almost always on the friend list, by collection number. */
const POPULAR = [284, 314, 316, 215, 150, 37];

function FriendCard({
  friend,
  onChange,
  onRemove,
}: {
  friend: SavedFriend;
  onChange: (f: SavedFriend) => void;
  onRemove: () => void;
}) {
  const [pickingCe, setPickingCe] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <ServantEditor servant={friend} onChange={(s) => onChange({ ...friend, ...s })} onRemove={onRemove} />
      <div className="flex flex-wrap items-center gap-3 border border-t-0 border-edge bg-bg px-3 pb-3">
        {friend.ce ? (
          <>
            <Face src={friend.ce.face} alt={friend.ce.name} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{friend.ce.name}</span>
            <label className="flex items-center gap-2 font-mono text-xs text-muted">
              <input
                type="checkbox"
                checked={friend.ce.mlb}
                onChange={(e) => onChange({ ...friend, ce: friend.ce && { ...friend.ce, mlb: e.target.checked } })}
              />
              MLB
            </label>
            <Button variant="danger" onClick={() => onChange({ ...friend, ce: undefined })}>
              ✕
            </Button>
          </>
        ) : (
          <span className="flex-1 font-mono text-xs text-muted">No CE on this support</span>
        )}
        <Button onClick={() => setPickingCe(!pickingCe)}>{pickingCe ? "Cancel" : "Choose CE"}</Button>
      </div>
      {pickingCe ? (
        <div className="border border-edge bg-bg p-3">
          <EquipSearch
            pickLabel="Use"
            onPick={(e) => {
              onChange({ ...friend, ce: { id: e.id, name: e.name, face: e.face, mlb: true } });
              setPickingCe(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SupportPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const [adding, setAdding] = useState(false);
  const servants = useAsync(listServants);
  const mcs = useAsync(listMysticCodes);

  const addFriend = (s: ServantListing) =>
    update((st) => {
      const n = Math.max(0, ...st.friends.map((f) => Number(f.key.split(":")[1]) || 0)) + 1;
      const base = newServant(s, st.settings, `friend:${n}`);
      return {
        ...st,
        friends: [...st.friends, { ...base, skillLevels: [10, 10, 10], fou: 1000, level: base.level }],
      };
    });

  const popular = (servants.data ?? []).filter((s) => POPULAR.includes(s.collectionNo));

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={`Friend supports (${state.friends.length})`}
        aside={
          <Button variant={adding ? "ghost" : "primary"} onClick={() => setAdding(!adding)}>
            {adding ? "Done adding" : "Add support"}
          </Button>
        }
      >
        <p className="mb-4 font-mono text-xs leading-relaxed text-muted">
          Servants you can reliably borrow. A team uses at most one of them, and they can be the
          attacker as well as a support. Friends are assumed to be at 10/10/10; change it if yours
          aren&apos;t.
        </p>
        {popular.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {popular.map((s) => (
              <Button key={s.id} onClick={() => addFriend(s)}>
                + {s.name}
              </Button>
            ))}
          </div>
        ) : null}
        {adding ? (
          <div className="mb-6 border-b border-edge pb-6">
            <ServantSearch pickLabel="Add" onPick={addFriend} />
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {state.friends.map((friend) => (
            <FriendCard
              key={friend.key}
              friend={friend}
              onChange={(next) =>
                update((s) => ({ ...s, friends: s.friends.map((f) => (f.key === next.key ? next : f)) }))
              }
              onRemove={() => update((s) => ({ ...s, friends: s.friends.filter((f) => f.key !== friend.key) }))}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Mystic codes">
        <p className="mb-4 font-mono text-xs leading-relaxed text-muted">
          Tick the ones you have unlocked. Each ticked code is tried, and a plan names the one it
          needs.
        </p>
        {mcs.error ? <LoadError error={mcs.error} retry={mcs.retry} /> : null}
        {mcs.loading ? <Notice>Loading mystic codes…</Notice> : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {(mcs.data ?? []).map((mc) => {
            const saved = state.mysticCodes.find((m) => m.id === mc.id);
            return (
              <li key={mc.id} className="flex items-center gap-3 border border-edge bg-bg p-2">
                <Face src={mc.icon} alt={mc.name} size={32} />
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(saved)}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        mysticCodes: e.target.checked
                          ? [...s.mysticCodes, { id: mc.id, name: mc.name, icon: mc.icon, level: 10 }]
                          : s.mysticCodes.filter((m) => m.id !== mc.id),
                      }))
                    }
                  />
                  <span className="truncate">{mc.name}</span>
                </label>
                {saved ? (
                  <Select
                    label="Lv"
                    value={saved.level}
                    options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                    onChange={(level) =>
                      update((s) => ({
                        ...s,
                        mysticCodes: s.mysticCodes.map((m) => (m.id === mc.id ? { ...m, level } : m)),
                      }))
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
