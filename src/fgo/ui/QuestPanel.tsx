"use client";

import { type FormEvent, useState } from "react";

import {
  getQuestPhase,
  getWarFreeQuests,
  listWars,
  searchQuests,
} from "../atlas/client";
import type { BasicQuestPhase } from "../atlas/types";
import type { SavedQuest, SavedState } from "../state/store";
import { Button, Label, LoadError, Notice, Panel, TextInput, classLabel, useAsync } from "./common";

function QuestPreview({ quest }: { quest: SavedQuest }) {
  const phase = useAsync(() => getQuestPhase(quest.id, quest.phase), [quest.id, quest.phase]);
  if (phase.error) return <LoadError error={phase.error} retry={phase.retry} />;
  if (phase.loading || !phase.data) return <Notice>Loading enemies…</Notice>;
  const stages = [...phase.data.stages].sort((a, b) => a.wave - b.wave);
  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage) => {
        const enemies = stage.enemies.filter((e) => e.deck === "enemy").sort((a, b) => a.deckId - b.deckId);
        const onField = stage.enemyFieldPosCount ?? 3;
        return (
          <div key={stage.wave} className="border border-edge bg-bg p-3">
            <Label>Wave {stage.wave}</Label>
            <ul className="mt-2 grid gap-1">
              {enemies.map((e, i) => (
                <li
                  key={`${e.deckId}-${i}`}
                  className={`flex flex-wrap justify-between gap-x-4 font-mono text-xs ${i >= onField ? "text-muted" : "text-ink"}`}
                >
                  <span>
                    {e.name} · {classLabel(e.svt.className)}
                    {i >= onField ? " · reinforcement" : ""}
                  </span>
                  <span className="text-accent">{e.hp.toLocaleString()} HP</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function QuestPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BasicQuestPhase[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warId, setWarId] = useState<number | null>(null);
  const [manualId, setManualId] = useState("");
  const [manualPhase, setManualPhase] = useState("3");
  const wars = useAsync(listWars);
  const warQuests = useAsync(
    () => (warId ? getWarFreeQuests(warId) : Promise.resolve([])),
    [warId],
  );

  const choose = (quest: SavedQuest) => update((s) => ({ ...s, quest }));

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchQuests(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {state.quest ? (
        <Panel
          title="Selected quest"
          aside={
            <span className="font-mono text-xs text-muted">
              {state.quest.id}/{state.quest.phase}
            </span>
          }
        >
          <p className="mb-1 text-lg text-ink">{state.quest.name}</p>
          <p className="mb-4 font-mono text-xs text-muted">
            {[state.quest.spotName, state.quest.warLongName].filter(Boolean).join(" · ")}
          </p>
          <QuestPreview quest={state.quest} />
        </Panel>
      ) : null}

      <Panel title="Find a quest">
        <form onSubmit={search} className="flex flex-wrap items-end gap-3">
          <TextInput label="Quest or spot name" value={query} onChange={setQuery} placeholder="e.g. Hollow Tree" />
          <Button type="submit" variant="primary" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
        {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
        {results ? (
          results.length === 0 ? (
            <div className="mt-3"><Notice>No free or event quests by that name.</Notice></div>
          ) : (
            <ul className="mt-4 grid gap-2">
              {results.slice(0, 50).map((q) => (
                <li key={`${q.id}-${q.phase}`} className="flex flex-wrap items-center gap-3 border border-edge bg-bg p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{q.name}</p>
                    <p className="font-mono text-[0.65rem] text-muted">
                      {q.spotName} · {q.warLongName} · {q.consume} AP
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      choose({ id: q.id, phase: q.phase, name: q.name, spotName: q.spotName, warLongName: q.warLongName })
                    }
                  >
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>

      <Panel title="Browse by war">
        {wars.error ? <LoadError error={wars.error} retry={wars.retry} /> : null}
        <select
          value={warId ?? ""}
          onChange={(e) => setWarId(e.target.value ? Number(e.target.value) : null)}
          className="w-full border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink"
        >
          <option value="">{wars.loading ? "Loading wars…" : "Choose a war or event"}</option>
          {(wars.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.longName.replace(/\n/g, " ")}
            </option>
          ))}
        </select>
        {warId ? (
          warQuests.loading ? (
            <div className="mt-3"><Notice>Loading quests…</Notice></div>
          ) : warQuests.error ? (
            <div className="mt-3"><LoadError error={warQuests.error} retry={warQuests.retry} /></div>
          ) : (warQuests.data ?? []).length === 0 ? (
            <div className="mt-3"><Notice>This war has no free quests.</Notice></div>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(warQuests.data ?? []).map((q) => (
                <li key={q.id} className="flex items-center gap-3 border border-edge bg-bg p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{q.name}</p>
                    <p className="font-mono text-[0.65rem] text-muted">
                      {q.spotName} · {q.consume} AP
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      choose({
                        id: q.id,
                        phase: q.phase,
                        name: q.name,
                        spotName: q.spotName,
                        warLongName: wars.data?.find((w) => w.id === warId)?.longName.replace(/\n/g, " "),
                      })
                    }
                  >
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>

      <Panel title="By quest ID">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const id = Number(manualId);
            const phase = Number(manualPhase) || 1;
            if (!id) return;
            setError(null);
            try {
              const q = await getQuestPhase(id, phase);
              choose({ id, phase, name: q.name, spotName: q.spotName, warLongName: q.warLongName });
            } catch (err) {
              setError(err instanceof Error ? `Quest ${id}/${phase}: ${err.message}` : "Quest not found.");
            }
          }}
        >
          <TextInput label="Quest ID (from Atlas Academy)" value={manualId} onChange={setManualId} placeholder="93000001" />
          <label className="flex flex-col gap-1">
            <Label>Phase</Label>
            <input
              value={manualPhase}
              onChange={(e) => setManualPhase(e.target.value)}
              inputMode="numeric"
              className="w-16 border border-edge bg-bg px-2 py-2 font-mono text-sm text-ink"
            />
          </label>
          <Button type="submit">Use</Button>
        </form>
        {error && !results ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
        <p className="mt-3 font-mono text-[0.65rem] leading-relaxed text-muted">
          For event quests the search can&apos;t find: open the quest on apps.atlasacademy.io and copy the
          ID and phase from its address.
        </p>
      </Panel>
    </div>
  );
}
