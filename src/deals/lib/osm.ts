import type { Coords, Place, UserLocation } from "../types";
import { haversineKm, isValidCoords, roundCoords } from "./geo";
import { normalizeName } from "./match";

const NOMINATIM = "https://nominatim.openstreetmap.org";

/**
 * The public Overpass servers fall over regularly, so there are several, and a
 * slow one is raced rather than waited for (see fetchPlaces). maps.mail.ru is
 * left out on purpose: it runs from Russia, and visitors’ coordinates should
 * not go there without them knowing.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

export const FOOD_AMENITIES = [
  "restaurant",
  "fast_food",
  "cafe",
  "pub",
  "bar",
  "food_court",
  "ice_cream",
] as const;

/**
 * Asks for every named food place in the square that contains the search circle.
 * A bounding box is what Overpass answers fast: the same question phrased with
 * `around` timed out after 46 s on a public server, where this takes about two
 * seconds. The square's corners are trimmed back to the circle in fetchPlaces.
 * One exact-match filter per amenity is answered from the tag index, where a
 * regex over all of them makes the server scan. Only the visitor’s location,
 * rounded to about 110 m, goes into the query.
 */
export function overpassQuery(center: Coords, radiusKm: number): string {
  const { lat, lon } = roundCoords(center);
  const dLat = radiusKm / 111.2;
  const dLon = radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const box = [
    Math.max(-90, lat - dLat),
    Math.max(-180, lon - dLon),
    Math.min(90, lat + dLat),
    Math.min(180, lon + dLon),
  ]
    .map((degrees) => degrees.toFixed(5))
    .join(",");
  const filters = FOOD_AMENITIES.map((kind) => `nwr["amenity"="${kind}"]["name"](${box});`).join("");
  return `[out:json][timeout:40];(${filters});out tags center qt;`;
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

const isFood = (value: unknown): value is (typeof FOOD_AMENITIES)[number] =>
  typeof value === "string" && (FOOD_AMENITIES as readonly string[]).includes(value);

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** "indian;pakistani" becomes "Indian · Pakistani". */
function cuisineLabel(raw: unknown): string | undefined {
  const value = text(raw, 80);
  if (!value) return undefined;
  return value
    .split(";")
    .slice(0, 2)
    .map((part) => part.trim().replace(/_/g, " "))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function toPlace(element: OverpassElement): Place | null {
  const { type, id, tags } = element;
  if ((type !== "node" && type !== "way" && type !== "relation") || typeof id !== "number") return null;
  if (!tags || typeof tags !== "object") return null;

  const name = text(tags.name, 100);
  if (!name || !isFood(tags.amenity)) return null;

  // Nodes carry their own position; ways and relations get a centre from `out center`.
  const lat = type === "node" ? element.lat : element.center?.lat;
  const lon = type === "node" ? element.lon : element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const coords = { lat, lon };
  if (!isValidCoords(coords)) return null;

  const wikidata = text(tags["brand:wikidata"], 20);
  const street = [text(tags["addr:housenumber"], 20), text(tags["addr:street"], 80)].filter(Boolean).join(" ");

  return {
    id: `${type}/${id}`,
    name,
    kind: tags.amenity,
    lat,
    lon,
    cuisine: cuisineLabel(tags.cuisine),
    brand: text(tags.brand, 80),
    brandWikidata: wikidata && /^Q\d+$/.test(wikidata) ? wikidata : undefined,
    address: street || undefined,
  };
}

const richness = (place: Place) =>
  [place.cuisine, place.brand, place.brandWikidata, place.address].filter(Boolean).length;

/** OpenStreetMap often maps one venue twice: a point and the building around it. Keep the fuller one. */
function dropDuplicates(places: Place[]): Place[] {
  const kept = new Map<string, Place[]>();
  for (const place of places) {
    const key = normalizeName(place.name);
    const group = kept.get(key) ?? [];
    const twin = group.findIndex((other) => haversineKm(other, place) < 0.08);
    if (twin === -1) group.push(place);
    else if (richness(place) > richness(group[twin])) group[twin] = place;
    kept.set(key, group);
  }
  return [...kept.values()].flat();
}

/** Overpass JSON to places, nearest first when a centre is given. Anything malformed is skipped. */
export function parsePlaces(json: unknown, center?: Coords): Place[] {
  const elements = (json as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const places: Place[] = [];
  for (const element of elements as OverpassElement[]) {
    const place = element && typeof element === "object" ? toPlace(element) : null;
    if (place) places.push(place);
  }

  const unique = dropDuplicates(places);
  if (center) unique.sort((a, b) => haversineKm(center, a) - haversineKm(center, b));
  return unique;
}

export class OverpassUnavailableError extends Error {
  constructor() {
    super("OpenStreetMap's servers aren't answering right now.");
    this.name = "OverpassUnavailableError";
  }
}

export interface FetchPlacesOptions {
  signal?: AbortSignal;
  /** Told when a server fails or is slow and another is being tried. */
  onStatus?: (message: string) => void;
  fetchImpl?: typeof fetch;
  endpoints?: readonly string[];
  /** Per server. */
  timeoutMs?: number;
  /** How long a server may stay silent before the next one is tried alongside it. */
  staggerMs?: number;
}

async function requestOverpass(
  endpoint: string,
  query: string,
  parent: AbortSignal | undefined,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parent?.addEventListener("abort", onParentAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Overpass answered ${res.status}`);
    const json: unknown = await res.json();
    // A query that runs out of time still answers 200, with a remark and possibly half the results.
    const remark = (json as { remark?: unknown } | null)?.remark;
    if (typeof remark === "string" && /error|timed out|out of memory/i.test(remark)) throw new Error(remark);
    return json;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Nearby food places from the first Overpass server to answer. Servers are
 * tried in order, a failure starts the next at once, and a server that stays
 * silent for `staggerMs` is joined by the next one rather than waited for. The
 * first good answer wins and the rest are cancelled.
 */
export async function fetchPlaces(
  center: Coords,
  radiusKm: number,
  options: FetchPlacesOptions = {},
): Promise<Place[]> {
  const {
    signal,
    onStatus,
    fetchImpl = fetch,
    endpoints = OVERPASS_ENDPOINTS,
    timeoutMs = 35_000,
    staggerMs = 5_000,
  } = options;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const query = overpassQuery(center, radiusKm);
  const here = roundCoords(center);

  // Every request shares this controller, so the first answer cancels the rest.
  const race = new AbortController();
  const stop = () => race.abort();
  signal?.addEventListener("abort", stop, { once: true });

  return new Promise<Place[]>((resolve, reject) => {
    let next = 0;
    let failures = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      race.abort();
      finish();
    };

    const arm = () => {
      clearTimeout(timer);
      if (next < endpoints.length) {
        timer = setTimeout(() => launch("OpenStreetMap is slow to answer. Trying another server as well…"), staggerMs);
      }
    };

    const launch = (reason?: string) => {
      if (settled || next >= endpoints.length) return;
      if (reason) onStatus?.(reason);
      const endpoint = endpoints[next];
      next += 1;

      requestOverpass(endpoint, query, race.signal, timeoutMs, fetchImpl).then(
        (json) =>
          settle(() => resolve(parsePlaces(json, here).filter((place) => haversineKm(here, place) <= radiusKm))),
        (err: unknown) => {
          if (settled) return;
          if (signal?.aborted) return settle(() => reject(err));
          failures += 1;
          if (failures >= endpoints.length) return settle(() => reject(new OverpassUnavailableError()));
          launch("OpenStreetMap is busy, trying another server…");
        },
      );
      arm();
    };

    launch();
  });
}

/* Nominatim: place names to coordinates and back. */

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface NominatimRow {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

/** "Downtown Brampton, Brampton, Ontario": neighbourhood, city, then state. */
export function labelFromAddress(
  address: NominatimAddress | undefined,
  fallback = "",
  withStreet = false,
): string {
  if (!address) return fallback;
  const street = withStreet ? [address.house_number, address.road].filter(Boolean).join(" ") : "";
  const area = address.suburb ?? address.neighbourhood ?? address.city_district;
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  const parts = [street, area, city, address.state ?? address.country];
  const unique = parts.filter((part, i): part is string => Boolean(part) && parts.indexOf(part) === i);
  return unique.join(", ") || fallback;
}

export function countryOf(address: NominatimAddress | undefined): string | undefined {
  const code = address?.country_code?.toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

export interface AreaInfo {
  label: string;
  city?: string;
  region?: string;
  /** ISO 3166-1 alpha-2, upper case. */
  country?: string;
  countryName?: string;
}

/** The pieces of an address that say which area it is, for naming a search area. */
export function areaFromAddress(address: NominatimAddress | undefined, fallback = ""): AreaInfo {
  return {
    label: labelFromAddress(address, fallback),
    city: address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.county,
    region: address?.state,
    country: countryOf(address),
    countryName: address?.country,
  };
}

function locationFromRow(row: NominatimRow): UserLocation | null {
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!isValidCoords({ lat, lon })) return null;

  const fallback = (row.display_name ?? "").split(",").slice(0, 3).join(",").trim();
  let label = labelFromAddress(row.address, fallback, true);
  // Searching for a landmark: lead with its name.
  if (row.name && !label.toLowerCase().startsWith(row.name.toLowerCase())) label = `${row.name}, ${label}`;
  if (!label) return null;
  return { lat, lon, label, country: countryOf(row.address) };
}

/**
 * Whether text reads like a Canadian, US or UK postal code. OpenStreetMap only
 * knows the postal codes someone has mapped, so a miss on one of these deserves a
 * different explanation than a miss on a place name.
 */
export function looksLikePostalCode(text: string): boolean {
  const value = text.trim();
  return (
    /^[A-Za-z]\d[A-Za-z][ -]?(\d[A-Za-z]\d)?$/.test(value) || // Canada: L6V or L6V 1A2
    /^\d{5}(-\d{4})?$/.test(value) || // United States
    /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/.test(value) // United Kingdom
  );
}

/** Up to five matches. Call this on submit only: the Nominatim usage policy forbids search-as-you-type. */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<UserLocation[]> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "5" });
  const res = await fetchImpl(`${NOMINATIM}/search?${params}`, { signal });
  if (!res.ok) throw new Error(`The location search failed (${res.status}).`);
  const rows: unknown = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => locationFromRow(row as NominatimRow))
    .filter((location): location is UserLocation => location !== null);
}

/** Names the neighbourhood around a point. Only the rounded position is sent. */
export async function reverseLookup(
  at: Coords,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<{ label: string; country?: string }> {
  const { lat, lon } = roundCoords(at);
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "14",
    addressdetails: "1",
  });
  const res = await fetchImpl(`${NOMINATIM}/reverse?${params}`, { signal });
  if (!res.ok) throw new Error(`The location lookup failed (${res.status}).`);
  const row = (await res.json()) as NominatimRow;
  const fallback = (row.display_name ?? "").split(",").slice(0, 3).join(",").trim();
  return { label: labelFromAddress(row.address, fallback), country: countryOf(row.address) };
}
