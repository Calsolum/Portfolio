"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Notice, Select } from "@/components/ui/controls";

import { CURATED_DEALS } from "../data/curated";
import { loadLocation, loadWebResult, saveLocation, saveWebResult } from "../lib/cache";
import { DAY_LONG, DAY_SHORT, weekdayOf } from "../lib/days";
import { cellId, cellOf } from "../lib/geo";
import {
  buildCuratedViews,
  buildWebViews,
  coveredPlaces,
  dropCoveredWebViews,
  forDay,
  sortViews,
} from "../lib/match";
import { loadPlaces } from "../lib/places";
import { isRecord, parseWebResult } from "../lib/validate";
import {
  DEFAULT_RADIUS_KM,
  RADII_KM,
  WEEKDAYS,
  type Place,
  type RadiusKm,
  type UserLocation,
  type Weekday,
} from "../types";
import { DealCard } from "./DealCard";
import { LocationPanel } from "./LocationPanel";
import { WebSearchPanel, type WebState } from "./WebSearchPanel";

type DayChoice = Weekday | "all";

const IDLE: WebState = { status: "idle" };

const COVERED = coveredPlaces(CURATED_DEALS);
const COVERAGE = `The checked list covers ${COVERED.length} places so far (${COVERED.join(", ")}), and chain deals show only near a branch.`;

interface PlacesState {
  /** Which request this answers, so a late answer to an old request is ignored. */
  key: string;
  places?: Place[];
  error?: string;
}

export function DealsApp() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [radius, setRadius] = useState<RadiusKm>(DEFAULT_RADIUS_KM);
  const [day, setDay] = useState<DayChoice>("all");
  /** The clock and storage only exist in the browser, so these are filled in after hydration. */
  const [now, setNow] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [placesState, setPlacesState] = useState<PlacesState | null>(null);
  const [note, setNote] = useState("");
  const [webByCell, setWebByCell] = useState<Record<string, WebState>>({});
  /** Whether the server has web search switched on. Unknown until it answers. */
  const [webEnabled, setWebEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage and the clock exist only after hydration */
    const saved = loadLocation();
    if (saved) setLocation(saved);
    setDay(weekdayOf(new Date()));
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/deals/web?status=1", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => setWebEnabled(isRecord(body) && body.webSearch === true))
      .catch(() => {
        if (!controller.signal.aborted) setWebEnabled(false);
      });
    return () => controller.abort();
  }, []);

  const chooseLocation = useCallback((next: UserLocation) => {
    saveLocation(next);
    setLocation(next);
  }, []);

  /* Nearby places */

  const requestKey = location
    ? `${location.lat.toFixed(3)},${location.lon.toFixed(3)},${radius},${attempt}`
    : null;

  useEffect(() => {
    if (!location || !requestKey) return;
    const controller = new AbortController();
    loadPlaces(location, radius, { signal: controller.signal, onStatus: setNote })
      .then((places) => {
        setNote("");
        setPlacesState({ key: requestKey, places });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setNote("");
        setPlacesState({
          key: requestKey,
          error: err instanceof Error ? err.message : "Could not look up nearby places.",
        });
      });
    return () => controller.abort();
  }, [location, radius, attempt, requestKey]);

  const placesCurrent = placesState?.key === requestKey ? placesState : null;
  const placesLoading = location !== null && placesCurrent === null;

  /* Web search, one result per grid cell */

  const cellKey = location ? cellId(cellOf(location)) : null;
  const storedWeb = useMemo<WebState | undefined>(() => {
    const result = cellKey ? loadWebResult(cellKey, now) : undefined;
    return result ? { status: "done", result } : undefined;
  }, [cellKey, now]);
  const web: WebState = (cellKey ? webByCell[cellKey] : undefined) ?? storedWeb ?? IDLE;

  const searchWeb = useCallback(async () => {
    if (!cellKey) return;
    const key = cellKey;
    const put = (state: WebState) => setWebByCell((prev) => ({ ...prev, [key]: state }));

    put({ status: "searching", startedAt: Date.now() });
    try {
      const res = await fetch(`/api/deals/web?cell=${encodeURIComponent(key)}`);
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        put({
          status: "error",
          message:
            isRecord(body) && typeof body.message === "string"
              ? body.message
              : "Web search did not work this time. Try again in a few minutes.",
          unavailable: isRecord(body) && body.error === "not_configured",
        });
        return;
      }
      const result = parseWebResult(body);
      if (!result) {
        put({ status: "error", message: "The search came back in a form this page could not read." });
        return;
      }
      saveWebResult(key, result, Date.now());
      put({ status: "done", result });
    } catch {
      put({ status: "error", message: "Could not reach the server. Check your connection and try again." });
    }
  }, [cellKey]);

  /* What to show. Matching is the costly part in a busy area, so each step recomputes only when its own inputs change:
     picking a day redoes the filtering and nothing else. */

  const context = useMemo(
    () =>
      location
        ? {
            center: location,
            radiusKm: radius,
            places: placesCurrent?.places ?? [],
            country: location.country,
            now: new Date(now),
          }
        : null,
    [location, radius, placesCurrent, now],
  );
  const curated = useMemo(() => (context ? buildCuratedViews(CURATED_DEALS, context) : []), [context]);
  const webViews = useMemo(
    () =>
      context && web.status === "done"
        ? dropCoveredWebViews(buildWebViews(web.result.deals, context), curated)
        : [],
    [context, web, curated],
  );
  const { nearby, elsewhere } = useMemo(() => {
    const shown = sortViews(forDay([...curated, ...webViews], day));
    return {
      nearby: shown.filter((deal) => deal.distanceKm !== undefined),
      elsewhere: shown.filter((deal) => deal.distanceKm === undefined),
    };
  }, [curated, webViews, day]);

  const today = now ? weekdayOf(new Date(now)) : null;
  const count = nearby.length + elsewhere.length;
  const when = day === "all" ? "this week" : `on ${DAY_LONG[day]}`;

  return (
    <div className="flex flex-col gap-6">
      <LocationPanel location={location} onChange={chooseLocation} />

      {location ? (
        <>
          <section aria-label="Filters" className="flex flex-col gap-4 border border-edge bg-card p-4">
            <div role="group" aria-label="Day of the week" className="flex flex-wrap gap-2">
              {[...WEEKDAYS, "all" as const].map((choice) => {
                const active = day === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={active}
                    aria-label={
                      choice === "all" ? "All days" : `${DAY_LONG[choice]}${choice === today ? " (today)" : ""}`
                    }
                    onClick={() => setDay(choice)}
                    className={`min-h-11 min-w-14 border px-3 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? "border-accent bg-accent text-bg"
                        : "border-edge text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {choice === "all" ? "All" : DAY_SHORT[choice]}
                    {choice === today ? <span aria-hidden> •</span> : null}
                  </button>
                );
              })}
            </div>
            <Select
              label="Distance"
              value={radius}
              options={RADII_KM.map((km) => ({ value: km, label: `Within ${km} km` }))}
              onChange={setRadius}
            />
          </section>

          <div aria-live="polite" className="flex flex-col gap-3">
            {placesLoading ? (
              <Notice>Looking up food places near {location.label}… {note}</Notice>
            ) : null}
            {placesCurrent?.error ? (
              <div className="flex flex-wrap items-center gap-3">
                <Notice tone="error">
                  {placesCurrent.error} Deals pinned to a specific venue still show below.
                </Notice>
                <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              </div>
            ) : null}
          </div>

          <section aria-label="Deals" className="flex flex-col gap-4">
            <h2 className="font-display text-2xl tracking-wide text-ink">
              {placesLoading ? "Deals" : `${count} ${count === 1 ? "deal" : "deals"}`} {when}{" "}
              <span className="ml-3 font-mono text-xs tracking-normal text-muted">within {radius} km</span>
            </h2>

            {nearby.length > 0 ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {nearby.map((deal) => (
                  <li key={deal.key}>
                    <DealCard deal={deal} areaLabel={location.label} />
                  </li>
                ))}
              </ul>
            ) : null}

            {!placesLoading && !placesCurrent?.error && count === 0 ? (
              <Notice>
                No deals {when} near here yet. {COVERAGE}
                {webEnabled ? " The web search below may find more." : ""}
              </Notice>
            ) : null}

            {elsewhere.length > 0 ? (
              <>
                <h3 className="mt-2 font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  Elsewhere around {location.label}
                </h3>
                <ul className="grid gap-4 md:grid-cols-2">
                  {elsewhere.map((deal) => (
                    <li key={deal.key}>
                      <DealCard deal={deal} areaLabel={location.label} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          {webEnabled === true || web.status === "done" ? (
            <WebSearchPanel state={web} areaLabel={location.label} onSearch={() => void searchWeb()} />
          ) : null}
        </>
      ) : (
        <Notice>
          Type a place or use your location to see weekday food specials nearby. Wing nights, taco Tuesdays and lunch
          combos, by day of the week.
        </Notice>
      )}

      <div className="flex flex-col gap-2 font-mono text-[0.65rem] leading-relaxed text-muted">
        <p>
          Places and place names from{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            © OpenStreetMap contributors
          </a>{" "}
          (Nominatim and Overpass). Distances are straight-line. Deals change, so confirm with the restaurant.
        </p>
        <p>
          Your position stays in this browser. Looking up places sends OpenStreetMap a position rounded to about 100 m.
          A web search tells this site only which 5 km grid square you are in.
        </p>
      </div>
    </div>
  );
}
