"use client";

import { useEffect, useState } from "react";

import { Button, Notice, Panel } from "@/components/ui/controls";

import type { WebSearchResult } from "../types";

export type WebState =
  | { status: "idle" }
  | { status: "searching"; startedAt: number }
  | { status: "done"; result: WebSearchResult }
  | { status: "error"; message: string; unavailable?: boolean };

const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** Counts seconds up. Not a live region, so a screen reader is not read a number every second. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{Math.max(0, Math.round((now - since) / 1000))} s</span>;
}

export function WebSearchPanel({
  state,
  areaLabel,
  onSearch,
}: {
  state: WebState;
  areaLabel: string;
  onSearch: () => void;
}) {
  return (
    <Panel title="Search the web for more">
      {state.status === "idle" ? (
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-2xl font-mono text-xs leading-relaxed text-muted">
            The list above is short and checked by hand. Claude can also search the web around {areaLabel}, reading
            venues&apos; own pages and local news, and list only the deals it can link to. A new search takes a minute
            or two. Its result is kept for a week, so the next person to ask gets it straight away.
          </p>
          <Button variant="primary" onClick={onSearch}>
            Search the web for more deals
          </Button>
        </div>
      ) : null}

      {state.status === "searching" ? (
        <div className="flex flex-col gap-3">
          <div aria-live="polite">
            <Notice>Searching the web and reading pages. Please keep this tab open.</Notice>
          </div>
          <p className="font-mono text-xs text-muted">
            Searching for <Elapsed since={state.startedAt} />
          </p>
        </div>
      ) : null}

      {state.status === "done" ? (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs leading-relaxed text-ink">
            {state.result.deals.length === 0
              ? "The search finished but found no weekday deals it could source."
              : `Found ${state.result.deals.length} ${state.result.deals.length === 1 ? "deal" : "deals"} on the web.`}
          </p>
          <p className="font-mono text-xs leading-relaxed text-muted">
            Searched {dateFormat.format(new Date(state.result.searchedAt))} for {state.result.area}. These come from
            pages Claude read, not from the restaurants, so confirm with the restaurant before you go.
          </p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div aria-live="polite">
            <Notice tone="error">{state.message}</Notice>
          </div>
          {state.unavailable ? null : <Button onClick={onSearch}>Try again</Button>}
        </div>
      ) : null}
    </Panel>
  );
}
