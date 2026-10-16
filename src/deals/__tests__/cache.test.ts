import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PLACES_TTL_MS,
  WEB_TTL_MS,
  findCachedPlaces,
  loadLocation,
  loadPlacesEntries,
  loadWebResult,
  rememberPlaces,
  saveLocation,
  savePlacesEntries,
  saveWebResult,
  type PlacesEntry,
} from "../lib/cache";
import type { Place, WebSearchResult } from "../types";

const CENTER = { lat: 43.686, lon: -79.76 };
const T0 = 1_800_000_000_000;
const north = (km: number) => CENTER.lat + km / 111.2;

const place = (id: string, km: number): Place => ({
  id,
  name: id,
  kind: "pub",
  lat: north(km),
  lon: CENTER.lon,
});

const entry = (overrides: Partial<PlacesEntry> = {}): PlacesEntry => ({
  ...CENTER,
  radiusKm: 3,
  at: T0,
  places: [place("near", 0.4), place("mid", 1.5), place("far", 2.6)],
  ...overrides,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("findCachedPlaces", () => {
  it("serves a smaller circle from a bigger lookup, trimmed to it", () => {
    const found = findCachedPlaces([entry()], CENTER, 1, T0 + 1000);
    expect(found?.map((p) => p.id)).toEqual(["near"]);
    expect(findCachedPlaces([entry()], CENTER, 2, T0 + 1000)?.map((p) => p.id)).toEqual(["near", "mid"]);
  });

  it("serves a slightly moved centre while its circle still fits inside the cached one", () => {
    const moved = { lat: north(0.5), lon: CENTER.lon };
    expect(findCachedPlaces([entry()], moved, 2, T0)).toBeDefined();
  });

  it("refuses when the asked circle pokes outside the cached one", () => {
    expect(findCachedPlaces([entry({ radiusKm: 2 })], CENTER, 3, T0)).toBeUndefined();
    expect(findCachedPlaces([entry()], { lat: north(1.5), lon: CENTER.lon }, 2, T0)).toBeUndefined();
  });

  it("refuses an expired lookup", () => {
    expect(findCachedPlaces([entry()], CENTER, 1, T0 + PLACES_TTL_MS + 1)).toBeUndefined();
    expect(findCachedPlaces([entry()], CENTER, 1, T0 + PLACES_TTL_MS)).toBeDefined();
  });
});

describe("rememberPlaces", () => {
  it("puts the newest lookup first and keeps only a few", () => {
    let entries: PlacesEntry[] = [];
    for (let i = 0; i < 6; i += 1) {
      entries = rememberPlaces(entries, entry({ lat: CENTER.lat + i, at: T0 + i }), T0 + i);
    }
    expect(entries).toHaveLength(4);
    expect(entries[0].lat).toBe(CENTER.lat + 5);
  });

  it("replaces an older lookup of the same spot that the new one covers", () => {
    const entries = rememberPlaces([entry({ radiusKm: 1 })], entry({ radiusKm: 3, at: T0 + 5 }), T0 + 5);
    expect(entries).toHaveLength(1);
    expect(entries[0].radiusKm).toBe(3);
  });

  it("keeps a bigger lookup of the same spot when a smaller one is added", () => {
    const entries = rememberPlaces([entry({ radiusKm: 3 })], entry({ radiusKm: 1, at: T0 + 5 }), T0 + 5);
    expect(entries.map((e) => e.radiusKm)).toEqual([1, 3]);
  });

  it("forgets expired lookups", () => {
    const later = T0 + PLACES_TTL_MS + 10;
    const entries = rememberPlaces([entry()], entry({ lat: CENTER.lat + 1, at: later }), later);
    expect(entries).toHaveLength(1);
  });
});

describe("storage", () => {
  it("does nothing, without throwing, when there is no localStorage", () => {
    expect(loadLocation()).toBeUndefined();
    expect(loadPlacesEntries()).toEqual([]);
    expect(loadWebResult("1:2", T0)).toBeUndefined();
    expect(() => saveLocation({ ...CENTER, label: "x" })).not.toThrow();
    expect(() => savePlacesEntries([entry()])).not.toThrow();
  });

  it("round-trips a saved location", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveLocation({ ...CENTER, label: "Downtown Brampton", country: "CA" });
    expect(loadLocation()).toEqual({ ...CENTER, label: "Downtown Brampton", country: "CA" });
  });

  it("ignores a corrupted or invalid saved location", () => {
    for (const stored of ["{not json", JSON.stringify({ lat: 400, lon: 0, label: "x" }), JSON.stringify({ lat: 1, lon: 1 }), "null"]) {
      vi.stubGlobal("localStorage", memoryStorage({ "deals:location:v1": stored }));
      expect(loadLocation()).toBeUndefined();
    }
  });

  it("round-trips places and drops malformed entries", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    savePlacesEntries([entry()]);
    expect(loadPlacesEntries()).toHaveLength(1);

    storage.data.set("deals:places:v1", JSON.stringify([entry(), { lat: 1 }, "junk"]));
    expect(loadPlacesEntries()).toHaveLength(1);
  });

  const result: WebSearchResult = {
    area: "Brampton, Ontario",
    searchedAt: "2026-10-16T14:00:00.000Z",
    deals: [
      {
        place: "Wild Wing",
        title: "Wing Wednesday",
        details: "Wings for less.",
        days: ["wed"],
        sourceUrl: "https://www.wildwing.ca/specials",
        chain: true,
      },
    ],
  };

  it("keeps web results for a week, per cell", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveWebResult("2673:2004", result, T0);
    expect(loadWebResult("2673:2004", T0 + 1000)?.deals).toHaveLength(1);
    expect(loadWebResult("2673:2005", T0 + 1000)).toBeUndefined();
    expect(loadWebResult("2673:2004", T0 + WEB_TTL_MS + 1)).toBeUndefined();
  });

  it("keeps only the most recent cells", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    for (let i = 0; i < 9; i += 1) saveWebResult(`1:${i}`, result, T0 + i);
    expect(JSON.parse(storage.data.get("deals:web:v1") ?? "[]")).toHaveLength(6);
    expect(loadWebResult("1:8", T0 + 10)).toBeDefined();
    expect(loadWebResult("1:0", T0 + 10)).toBeUndefined();
  });

  it("re-validates stored results, so a tampered link is not trusted", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const tampered = { ...result, deals: [{ ...result.deals[0], sourceUrl: "javascript:alert(1)" }] };
    storage.data.set("deals:web:v1", JSON.stringify([{ cell: "1:1", at: T0, result: tampered }]));
    expect(loadWebResult("1:1", T0)?.deals).toEqual([]);
  });
});
