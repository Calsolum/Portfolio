import type { Coords, Place, UserLocation, WebSearchResult } from "../types";
import { haversineKm, isValidCoords } from "./geo";
import { isRecord, parseWebResult } from "./validate";

/**
 * Everything the page remembers lives in this browser only. Every call is
 * wrapped so a private window or blocked storage just means looking things up
 * again.
 */

const PLACES_KEY = "deals:places:v1";
const WEB_KEY = "deals:web:v1";
const LOCATION_KEY = "deals:location:v1";

export const PLACES_TTL_MS = 24 * 60 * 60 * 1000;
export const WEB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLACE_ENTRIES = 4;
const MAX_WEB_ENTRIES = 6;

function read(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the next visit looks things up again.
  }
}

/* Saved location */

export function loadLocation(): UserLocation | undefined {
  const raw = read(LOCATION_KEY);
  if (!isRecord(raw) || typeof raw.label !== "string" || !raw.label) return undefined;
  const { lat, lon } = raw;
  if (typeof lat !== "number" || typeof lon !== "number" || !isValidCoords({ lat, lon })) return undefined;
  const country = typeof raw.country === "string" && /^[A-Z]{2}$/.test(raw.country) ? raw.country : undefined;
  return { lat, lon, label: raw.label.slice(0, 120), country };
}

export function saveLocation(location: UserLocation): void {
  write(LOCATION_KEY, location);
}

/* Nearby places from OpenStreetMap */

export interface PlacesEntry {
  lat: number;
  lon: number;
  radiusKm: number;
  at: number;
  places: Place[];
}

function isPlacesEntry(value: unknown): value is PlacesEntry {
  return (
    isRecord(value) &&
    typeof value.lat === "number" &&
    typeof value.lon === "number" &&
    typeof value.radiusKm === "number" &&
    typeof value.at === "number" &&
    Array.isArray(value.places)
  );
}

export function loadPlacesEntries(): PlacesEntry[] {
  const raw = read(PLACES_KEY);
  return Array.isArray(raw) ? raw.filter(isPlacesEntry) : [];
}

export function savePlacesEntries(entries: PlacesEntry[]): void {
  write(PLACES_KEY, entries);
}

/**
 * Places from an earlier lookup whose circle fully contains the circle asked
 * for, trimmed to it. Moving the radius down, or a few metres, costs no request.
 */
export function findCachedPlaces(
  entries: readonly PlacesEntry[],
  center: Coords,
  radiusKm: number,
  now: number,
): Place[] | undefined {
  for (const entry of entries) {
    if (now - entry.at > PLACES_TTL_MS) continue;
    if (haversineKm(entry, center) + radiusKm > entry.radiusKm + 1e-9) continue;
    return entry.places.filter((place) => haversineKm(center, place) <= radiusKm);
  }
  return undefined;
}

/** The newest few lookups; a new one replaces an older one for the same spot that it covers. */
export function rememberPlaces(entries: readonly PlacesEntry[], entry: PlacesEntry, now: number): PlacesEntry[] {
  const kept = entries.filter(
    (other) =>
      now - other.at <= PLACES_TTL_MS &&
      !(other.lat === entry.lat && other.lon === entry.lon && other.radiusKm <= entry.radiusKm),
  );
  return [entry, ...kept].slice(0, MAX_PLACE_ENTRIES);
}

/* Web search results, by grid cell */

interface WebEntry {
  cell: string;
  at: number;
  result: WebSearchResult;
}

function loadWebEntries(): WebEntry[] {
  const raw = read(WEB_KEY);
  if (!Array.isArray(raw)) return [];
  const entries: WebEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.cell !== "string" || typeof item.at !== "number") continue;
    const result = parseWebResult(item.result);
    if (result) entries.push({ cell: item.cell, at: item.at, result });
  }
  return entries;
}

export function loadWebResult(cell: string, now: number): WebSearchResult | undefined {
  const entry = loadWebEntries().find((item) => item.cell === cell);
  return entry && now - entry.at <= WEB_TTL_MS ? entry.result : undefined;
}

export function saveWebResult(cell: string, result: WebSearchResult, now: number): void {
  const others = loadWebEntries().filter((item) => item.cell !== cell && now - item.at <= WEB_TTL_MS);
  write(WEB_KEY, [{ cell, at: now, result }, ...others].slice(0, MAX_WEB_ENTRIES));
}
