"use client";

import { useRef, useState } from "react";

import { cacheClear } from "../atlas/cache";
import { type SavedState, parseState, useSavedState } from "../state/store";
import { CesPanel } from "./CesPanel";
import { Button, Notice, Panel } from "./common";
import { PlanPanel } from "./PlanPanel";
import { QuestPanel } from "./QuestPanel";
import { ServantsPanel } from "./ServantsPanel";
import { SupportPanel } from "./SupportPanel";

const TABS = [
  { id: "quest", label: "Quest" },
  { id: "servants", label: "Servants" },
  { id: "ces", label: "CEs" },
  { id: "support", label: "Support" },
  { id: "plan", label: "Plan" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function DataPanel({
  state,
  update,
}: {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; tone: "muted" | "error" } | null>(null);

  const exportState = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fgo-team-builder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importState = async (f: File) => {
    try {
      const next = parseState(await f.text());
      update(() => next);
      setMessage({ text: `Imported ${next.servants.length} servants and ${next.ces.length} CEs.`, tone: "muted" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "That file couldn't be read.", tone: "error" });
    }
  };

  return (
    <Panel title="Your data">
      <p className="mb-4 font-mono text-xs leading-relaxed text-muted">
        Your roster is saved in this browser only. Export a backup to move it to another device or
        keep it safe if browser data is cleared.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportState}>Export backup</Button>
        <Button onClick={() => file.current?.click()}>Import backup</Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importState(f);
            e.target.value = "";
          }}
        />
        <Button
          onClick={async () => {
            await cacheClear();
            setMessage({ text: "Game data cache cleared; it reloads from Atlas Academy on next use.", tone: "muted" });
          }}
        >
          Clear game data cache
        </Button>
      </div>
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      ) : null}
    </Panel>
  );
}

export function FgoApp() {
  const { state, update, loaded } = useSavedState();
  const [tab, setTab] = useState<Tab>("quest");

  const counts: Partial<Record<Tab, number>> = {
    servants: state.servants.length,
    ces: state.ces.length,
    support: state.friends.length,
  };

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Team builder sections"
        className="sticky top-16 z-10 -mx-6 flex overflow-x-auto border-y border-edge bg-bg/95 px-6 backdrop-blur md:mx-0 md:border-x md:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`min-h-11 shrink-0 flex-1 border-b-2 px-4 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
              tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {counts[t.id] ? <span className="ml-1 text-muted">{counts[t.id]}</span> : null}
          </button>
        ))}
      </nav>

      {!loaded ? (
        <Notice>Loading your roster…</Notice>
      ) : (
        <>
          {tab === "quest" ? <QuestPanel state={state} update={update} /> : null}
          {tab === "servants" ? <ServantsPanel state={state} update={update} /> : null}
          {tab === "ces" ? <CesPanel state={state} update={update} /> : null}
          {tab === "support" ? <SupportPanel state={state} update={update} /> : null}
          {/* Kept mounted so a running search survives switching tabs. */}
          <div hidden={tab !== "plan"} className="flex flex-col gap-6">
            <PlanPanel state={state} update={update} />
            <DataPanel state={state} update={update} />
          </div>
        </>
      )}

      <p className="font-mono text-[0.65rem] leading-relaxed text-muted">
        Game data from{" "}
        <a href="https://atlasacademy.io" className="underline hover:text-accent">
          Atlas Academy
        </a>{" "}
        (NA). Not affiliated with Aniplex, Lasengle or TYPE-MOON.
      </p>
    </div>
  );
}
