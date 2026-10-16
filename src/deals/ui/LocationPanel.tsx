"use client";

import { useRef, useState } from "react";

import { Button, Notice, Panel, TextInput } from "@/components/ui/controls";

import { looksLikePostalCode, reverseLookup, searchLocations } from "../lib/osm";
import type { UserLocation } from "../types";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; what: string }
  | { kind: "error"; message: string }
  | { kind: "none"; query: string; postal: boolean }
  | { kind: "choose"; matches: UserLocation[] };

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 5 * 60_000,
    });
  });
}

function geolocationMessage(err: unknown): string {
  const code = typeof err === "object" && err !== null && "code" in err ? (err as { code: number }).code : 0;
  if (code === 1) return "Location access was blocked. Allow it in your browser, or type a place instead.";
  if (code === 3) return "Finding your location took too long. Try again, or type a place instead.";
  if (err instanceof Error && err.message === "unsupported") {
    return "This browser cannot share its location. Type a place instead.";
  }
  return "Your device could not work out where you are. Type a place instead.";
}

export function LocationPanel({
  location,
  onChange,
}: {
  location: UserLocation | null;
  onChange: (next: UserLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const running = useRef<AbortController | null>(null);

  const begin = (what: string) => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setStatus({ kind: "busy", what });
    return controller.signal;
  };

  const choose = (next: UserLocation) => {
    setStatus({ kind: "idle" });
    setQuery("");
    onChange(next);
  };

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    const signal = begin("Searching…");
    try {
      const matches = await searchLocations(text, signal);
      if (signal.aborted) return;
      if (matches.length === 0) setStatus({ kind: "none", query: text, postal: looksLikePostalCode(text) });
      else if (matches.length === 1) choose(matches[0]);
      else setStatus({ kind: "choose", matches });
    } catch {
      if (!signal.aborted) {
        setStatus({ kind: "error", message: "The place search is not answering. Try again in a moment." });
      }
    }
  };

  const locate = async () => {
    const signal = begin("Finding your location…");
    try {
      const { latitude: lat, longitude: lon } = (await currentPosition()).coords;
      if (signal.aborted) return;
      // The label is a courtesy; if naming the neighbourhood fails the position still works.
      const named = await reverseLookup({ lat, lon }, signal).catch(() => null);
      if (signal.aborted) return;
      choose({ lat, lon, label: named?.label || "Your location", country: named?.country });
    } catch (err) {
      if (!signal.aborted) setStatus({ kind: "error", message: geolocationMessage(err) });
    }
  };

  const busy = status.kind === "busy";

  return (
    <Panel title="Where are you?">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <TextInput
          label="City, address or postal code"
          value={query}
          onChange={setQuery}
          placeholder="Brampton, Ontario"
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={busy || !query.trim()}>
            Find
          </Button>
          <Button onClick={() => void locate()} disabled={busy}>
            Use my location
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 flex flex-col gap-3">
        {status.kind === "busy" ? <Notice>{status.what}</Notice> : null}
        {status.kind === "error" ? <Notice tone="error">{status.message}</Notice> : null}
        {status.kind === "none" ? (
          <Notice>
            {status.postal
              ? `OpenStreetMap does not know the postal code “${status.query}”. It only has the ones that have been mapped, so try the city name or a street address.`
              : `Nothing found for “${status.query}”. Try a city name or a street address.`}
          </Notice>
        ) : null}
        {status.kind === "choose" ? (
          <div>
            <p className="mb-2 font-mono text-xs text-muted">Which one?</p>
            <ul className="flex flex-col gap-2">
              {status.matches.map((match) => (
                <li key={`${match.lat},${match.lon}`}>
                  <button
                    type="button"
                    onClick={() => choose(match)}
                    className="min-h-11 w-full border border-edge px-3 py-2 text-left font-mono text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    {match.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {location ? (
        <p className="mt-4 font-mono text-xs leading-relaxed text-muted">
          Showing deals near <span className="text-ink">{location.label}</span>
        </p>
      ) : null}
    </Panel>
  );
}
