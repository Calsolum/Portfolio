"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Button, Notice, Panel } from "@/components/ui/controls";

import { FACTIONS } from "../data/factions";
import { SETS, type SetKind } from "../data/sets";
import { MAX_PLAYER_NAME, cleanName } from "../lib/actions";
import { ALL_SET_IDS, FACTION_BY_ID, SET_BY_ID, ownedIn } from "../lib/catalog";
import { MAX_PLAYERS, MIN_PLAYERS, type Action, type BaseSnapshot, type PlayerInfo } from "../types";
import { BasePicker } from "./BasePicker";
import { ConfirmButton, PlayerDot, Stepper, vpText } from "./common";

const KIND_LABEL: Record<SetKind, string> = {
  main: "Sets",
  "big-box": "Big boxes",
  "event-kit": "Event kits",
  booster: "Boosters and promos",
};

interface Seat {
  name: string;
  factions: [string, string];
}

const seat = (name = "", factions: readonly string[] = []): Seat => ({
  name,
  factions: [factions[0] ?? "", factions[1] ?? ""],
});

/** A rematch: the same players, factions, seats and settings, with the bases picked afresh. */
export interface SetupPreset {
  players: { name: string; factions: string[] }[];
  target: number;
  first: number;
  madness: boolean;
}

/** The Madness deck comes with the Cthulhu set; its factions are the ones that use it. */
const MADNESS_SET = "obligatory-cthulhu";

function OwnedSets({ owned, onChange }: { owned: string[]; onChange: (owned: string[]) => void }) {
  const set = new Set(owned);
  const toggle = (id: string) => onChange(set.has(id) ? owned.filter((x) => x !== id) : [...owned, id]);
  return (
    <details className="border border-edge">
      <summary className="cursor-pointer px-3 py-3 font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-accent">
        Your sets · {owned.length} of {SETS.length}
      </summary>
      <div className="flex flex-col gap-4 border-t border-edge p-3">
        <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
          Only bases and factions from these show up when you pick. Saved on this device.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onChange([...ALL_SET_IDS])}>All</Button>
          <Button onClick={() => onChange([])}>None</Button>
        </div>
        {(Object.keys(KIND_LABEL) as SetKind[]).map((kind) => (
          <fieldset key={kind} className="flex flex-col gap-1">
            <legend className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
              {KIND_LABEL[kind]}
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {SETS.filter((item) => item.kind === kind).map((item) => (
                <label key={item.id} className="flex min-h-9 items-center gap-2 font-mono text-xs text-ink">
                  <input type="checkbox" checked={set.has(item.id)} onChange={() => toggle(item.id)} />
                  {item.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </details>
  );
}

export function SetupPanel({
  owned,
  lastNames,
  preset,
  inProgress,
  onOwnedChange,
  onStart,
  join,
}: {
  owned: string[];
  lastNames: string[];
  /** Fills the form for a rematch. */
  preset?: SetupPreset | null;
  /** A game is going, so starting another replaces it. */
  inProgress: boolean;
  onOwnedChange: (owned: string[]) => void;
  onStart: (setup: Extract<Action, { type: "setup" }>) => void;
  /** The join-by-code form, when sharing is switched on. */
  join?: ReactNode;
}) {
  const [seats, setSeats] = useState<Seat[]>(() => {
    if (preset) return preset.players.map((player) => seat(player.name, player.factions));
    const names = lastNames.length >= MIN_PLAYERS ? lastNames : ["", "", ""];
    return names.map((name) => seat(name));
  });
  const [bases, setBases] = useState<(BaseSnapshot | null)[]>(() => Array(seats.length + 1).fill(null));
  const [target, setTarget] = useState(preset?.target ?? 15);
  const [first, setFirst] = useState(preset ? Math.min(preset.first, seats.length - 1) : 0);
  const [madness, setMadness] = useState(preset?.madness ?? false);
  const [choosing, setChoosing] = useState<number | null>(null);

  const ownedSet = useMemo(() => new Set(owned), [owned]);
  /** Owned factions grouped by the set they came in, for the faction lists. */
  const factionGroups = useMemo(() => {
    const groups = new Map<string, typeof FACTIONS[number][]>();
    for (const faction of FACTIONS) {
      if (!ownedIn(faction, ownedSet)) continue;
      groups.set(faction.set, [...(groups.get(faction.set) ?? []), faction]);
    }
    return [...groups];
  }, [ownedSet]);
  const inPlay = useMemo(() => new Set(bases.flatMap((base) => (base?.card ? [base.card] : []))), [bases]);

  const setSeatCount = (count: number) => {
    setSeats((prev) => (count > prev.length ? [...prev, seat()] : prev.slice(0, count)));
    // The rulebook's number of bases follows the players: one more than there are players.
    setBases((prev) => {
      const wanted = count + 1;
      return prev.length < wanted ? [...prev, ...Array(wanted - prev.length).fill(null)] : prev.slice(0, wanted);
    });
    setFirst((prev) => Math.min(prev, count - 1));
  };

  const names = seats.map((s) => cleanName(s.name, MAX_PLAYER_NAME));
  const missing = [
    names.some((name) => !name) ? "a name for every player" : null,
    names.every(Boolean) && new Set(names).size !== names.length ? "a different name for each player" : null,
    bases.some((base) => !base) ? "every starting base" : null,
  ].filter(Boolean);

  const start = () => {
    const players: PlayerInfo[] = seats.map((s, i) => ({
      id: `p${i + 1}`,
      name: names[i] ?? `Player ${i + 1}`,
      factions: [...new Set(s.factions.filter(Boolean))],
    }));
    const chosen = bases.filter((base): base is BaseSnapshot => base !== null);
    onStart({ type: "setup", players, bases: chosen, target, first, ...(madness ? { madness: true } : {}) });
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Players" aside={<Stepper label="Players" value={seats.length} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={setSeatCount} />}>
        <ol className="flex flex-col gap-4">
          {seats.map((s, i) => (
            <li key={i} className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <PlayerDot index={i} />
                <span className="sr-only">Player {i + 1} name</span>
                <input
                  value={s.name}
                  maxLength={MAX_PLAYER_NAME}
                  placeholder={`Player ${i + 1}`}
                  onChange={(e) =>
                    setSeats((prev) => prev.map((other, j) => (j === i ? { ...other, name: e.target.value } : other)))
                  }
                  className="w-full border border-edge bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 pl-4.5">
                {[0, 1].map((k) => (
                  <select
                    key={k}
                    aria-label={`Player ${i + 1} faction ${k + 1}`}
                    value={s.factions[k]}
                    onChange={(e) => {
                      const picked = e.target.value;
                      setSeats((prev) =>
                        prev.map((other, j) => {
                          if (j !== i) return other;
                          const next: [string, string] = [...other.factions];
                          next[k] = picked;
                          return { ...other, factions: next };
                        }),
                      );
                      // A Cthulhu faction means the Madness deck is in play.
                      if (FACTION_BY_ID.get(picked)?.set === MADNESS_SET) setMadness(true);
                    }}
                    className="min-w-0 border border-edge bg-bg px-2 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Faction (optional)</option>
                    {factionGroups.map(([setId, group]) => (
                      <optgroup key={setId} label={SET_BY_ID.get(setId)?.name ?? setId}>
                        {group.map((faction) => (
                          <option key={faction.id} value={faction.id}>
                            {faction.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Starting bases" aside={<span className="font-mono text-xs text-muted">{bases.length} in play</span>}>
        <p className="mb-3 font-mono text-[0.65rem] leading-relaxed text-muted">
          One more base than there are players. Pick the ones you dealt from your base deck.
        </p>
        <ul className="flex flex-col gap-2">
          {bases.map((base, slot) => (
            <li key={slot} className="flex items-center justify-between gap-3 border border-edge px-3 py-2">
              {base ? (
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm text-ink">{base.name}</span>
                  <span className="block font-mono text-[0.65rem] text-muted">
                    Breakpoint {base.breakpoint} · pays {vpText(base.vps)}
                  </span>
                </span>
              ) : (
                <span className="font-mono text-xs text-muted">Base {slot + 1}</span>
              )}
              <Button onClick={() => setChoosing(slot)}>{base ? "Change" : "Choose"}</Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-mono text-[0.65rem] text-muted">House rule: more or fewer bases</span>
          <Stepper
            label="Bases in play"
            value={bases.length}
            min={1}
            max={8}
            onChange={(count) =>
              setBases((prev) => (count > prev.length ? [...prev, null] : prev.slice(0, count)))
            }
          />
        </div>
      </Panel>

      <Panel title="Game">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted">VP to win</span>
            <Stepper label="VP to win" value={target} min={1} max={99} onChange={setTarget} />
          </div>
          <label className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted">Goes first</span>
            <select
              value={first}
              onChange={(e) => setFirst(Number(e.target.value))}
              className="border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
            >
              {seats.map((s, i) => (
                <option key={i} value={i}>
                  {names[i] ?? `Player ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-start gap-2 font-mono text-xs text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={madness}
              onChange={(e) => setMadness(e.target.checked)}
            />
            <span>
              Madness deck in play
              <span className="block text-[0.65rem] leading-relaxed text-muted">
                The Cthulhu set&apos;s factions use it. The tracker counts each player&apos;s Madness and takes 1 VP
                for every two when the game ends.
              </span>
            </span>
          </label>
          <OwnedSets owned={owned} onChange={onOwnedChange} />
        </div>
      </Panel>

      <div className="flex flex-col gap-2">
        {missing.length ? <Notice>Still needed: {missing.join(", ")}.</Notice> : null}
        {inProgress ? (
          <ConfirmButton
            confirmText="Tap again: this replaces the game in progress"
            onConfirm={() => !missing.length && start()}
            className={missing.length ? "pointer-events-none opacity-40" : ""}
          >
            Start game
          </ConfirmButton>
        ) : (
          <Button variant="primary" disabled={missing.length > 0} onClick={start}>
            Start game
          </Button>
        )}
      </div>

      {join}

      {choosing !== null ? (
        <BasePicker
          title={`Starting base ${choosing + 1}`}
          owned={ownedSet}
          inPlay={inPlay}
          seen={new Set()}
          onClose={() => setChoosing(null)}
          onPick={(base) => {
            setBases((prev) => prev.map((other, slot) => (slot === choosing ? base : other)));
            setChoosing(null);
          }}
        />
      ) : null}
    </div>
  );
}
