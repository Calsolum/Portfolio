import type { Coords, CuratedDeal, DealMatch, DealView, Place, Weekday, WebDeal } from "../types";
import { haversineKm } from "./geo";

export type BrandMatch = Extract<DealMatch, { kind: "brand" }>;

/** Words that say what kind of venue it is, not which one. Never enough to match on alone. */
const GENERIC_TOKENS = new Set([
  "the", "and", "of", "a", "restaurant", "restaurants", "bar", "grill", "pub", "cafe", "kitchen",
  "house", "pizza", "pizzeria", "bistro", "tavern", "lounge", "eatery",
]);

/** Lower case, no accents or punctuation, "&" spelled out, apostrophes dropped ("McDonald's" is "mcdonalds"). */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A name normalised once, with its words, so it is not normalised again for every comparison. */
interface NameKey {
  text: string;
  words: string[];
}

function keyOf(raw: string): NameKey {
  const text = normalizeName(raw);
  return { text, words: text ? text.split(" ") : [] };
}

function keysMatch(a: NameKey, b: NameKey): boolean {
  if (!a.text || !b.text) return false;
  if (a.text === b.text) return true;

  const [short, long] = a.words.length <= b.words.length ? [a.words, b.words] : [b.words, a.words];
  if (!short.some((word) => !GENERIC_TOKENS.has(word))) return false;
  return short.every((word) => long.includes(word));
}

/**
 * True when two names plausibly point at the same venue: identical once
 * normalised, or every word of the shorter one appears in the longer one
 * ("Wild Wing" in "Wild Wing Brampton") and at least one of those words says
 * something more than "pub" or "grill".
 */
export function namesMatch(a: string, b: string): boolean {
  return keysMatch(keyOf(a), keyOf(b));
}

/**
 * A busy area has thousands of places and every comparison would normalise
 * their names again, so each place keeps its keys. The same objects live in the
 * page's state from one render to the next, which is what makes this pay off.
 */
const placeKeyCache = new WeakMap<Place, { name: NameKey; brand?: NameKey }>();

function placeKeys(place: Place): { name: NameKey; brand?: NameKey } {
  let keys = placeKeyCache.get(place);
  if (!keys) {
    keys = { name: keyOf(place.name), brand: place.brand ? keyOf(place.brand) : undefined };
    placeKeyCache.set(place, keys);
  }
  return keys;
}

function matchesBrand(place: Place, wikidata: readonly string[] | undefined, nameKeys: readonly NameKey[]): boolean {
  if (place.brandWikidata && wikidata?.includes(place.brandWikidata)) return true;
  const keys = placeKeys(place);
  return nameKeys.some((key) => keysMatch(key, keys.name) || (keys.brand ? keysMatch(key, keys.brand) : false));
}

export function placeMatchesBrand(place: Place, match: BrandMatch): boolean {
  return matchesBrand(place, match.wikidata, match.names.map(keyOf));
}

/** The places the checked list has deals for, in order of first appearance: "Wild Wing", "Tracks Brew Pub". */
export function coveredPlaces(deals: readonly CuratedDeal[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const deal of deals) {
    const name = deal.match.kind === "brand" ? deal.match.names[0] : deal.match.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** True once the last day a deal runs is over. An unreadable date never hides a deal. */
export function hasEnded(until: string | undefined, now: Date): boolean {
  if (!until) return false;
  const end = Date.parse(`${until}T23:59:59Z`);
  return Number.isFinite(end) && now.getTime() > end;
}

export const STALE_AFTER_DAYS = 90;

/** Curated deals are only as good as the day someone last checked them. */
export function isStale(verified: string, now: Date): boolean {
  const checked = Date.parse(`${verified}T00:00:00Z`);
  if (!Number.isFinite(checked)) return true;
  return now.getTime() - checked > STALE_AFTER_DAYS * 86_400_000;
}

export interface BuildArgs {
  /** The point distances are measured from. */
  center: Coords;
  radiusKm: number;
  /** Food places from OpenStreetMap; empty when Overpass could not be reached. */
  places: readonly Place[];
  /** The visitor's country, when known, so a Canadian chain deal is not shown in Texas. */
  country?: string;
  now: Date;
}

interface Nearest {
  place: Place;
  km: number;
  count: number;
}

/** The closest of the places `matches`, how far it is, and how many matched inside the radius. */
function nearestMatch(
  places: readonly Place[],
  matches: (place: Place) => boolean,
  center: Coords,
  radiusKm: number,
): Nearest | undefined {
  let best: Nearest | undefined;
  let count = 0;
  for (const place of places) {
    if (!matches(place)) continue;
    const km = haversineKm(center, place);
    if (km > radiusKm) continue;
    count += 1;
    if (!best || km < best.km) best = { place, km, count: 0 };
  }
  return best ? { ...best, count } : undefined;
}

export function buildCuratedViews(deals: readonly CuratedDeal[], args: BuildArgs): DealView[] {
  const views: DealView[] = [];

  for (const deal of deals) {
    if (hasEnded(deal.until, args.now)) continue;

    const common = {
      key: `curated:${deal.id}`,
      origin: "curated" as const,
      title: deal.title,
      details: deal.details,
      days: deal.days,
      hours: deal.hours,
      price: deal.price,
      conditions: deal.conditions,
      sourceUrl: deal.sourceUrl,
      verified: deal.verified,
      stale: isStale(deal.verified, args.now),
      until: deal.until,
    };

    if (deal.match.kind === "place") {
      const { name, lat, lon, address } = deal.match;
      const distanceKm = haversineKm(args.center, { lat, lon });
      if (distanceKm > args.radiusKm) continue;
      views.push({ ...common, place: name, address, lat, lon, distanceKm });
      continue;
    }

    const match = deal.match;
    if (match.countries?.length && args.country && !match.countries.includes(args.country)) continue;

    const nameKeys = match.names.map(keyOf);
    const nearest = nearestMatch(
      args.places,
      (place) => matchesBrand(place, match.wikidata, nameKeys),
      args.center,
      args.radiusKm,
    );
    if (!nearest) continue;
    views.push({
      ...common,
      place: nearest.place.brand ?? nearest.place.name,
      address: nearest.place.address,
      lat: nearest.place.lat,
      lon: nearest.place.lon,
      distanceKm: nearest.km,
      locations: nearest.count,
      chain: true,
    });
  }
  return views;
}

export function buildWebViews(deals: readonly WebDeal[], args: BuildArgs): DealView[] {
  return deals.map((deal, index) => {
    const dealKey = keyOf(deal.place);
    const nearest = nearestMatch(
      args.places,
      (place) => {
        const keys = placeKeys(place);
        return keysMatch(dealKey, keys.name) || (keys.brand ? keysMatch(dealKey, keys.brand) : false);
      },
      args.center,
      args.radiusKm,
    );
    return {
      key: `web:${index}:${normalizeName(deal.place)}:${normalizeName(deal.title)}`,
      origin: "web" as const,
      place: deal.place,
      address: deal.address ?? nearest?.place.address,
      title: deal.title,
      details: deal.details,
      days: deal.days,
      hours: deal.hours,
      price: deal.price,
      sourceUrl: deal.sourceUrl,
      distanceKm: nearest?.km,
      lat: nearest?.place.lat,
      lon: nearest?.place.lon,
      locations: nearest && nearest.count > 1 ? nearest.count : undefined,
      chain: deal.chain,
    };
  });
}

/** A web deal adds nothing when a curated deal already covers the same venue on the same day. */
export function dropCoveredWebViews(web: readonly DealView[], curated: readonly DealView[]): DealView[] {
  return web.filter(
    (candidate) =>
      !curated.some(
        (known) =>
          namesMatch(candidate.place, known.place) &&
          candidate.days.some((day) => known.days.includes(day)),
      ),
  );
}

export function forDay(views: readonly DealView[], day: Weekday | "all"): DealView[] {
  return day === "all" ? [...views] : views.filter((view) => view.days.includes(day));
}

/** Nearest first; deals with no known location last; curated ahead of web at the same distance. */
export function sortViews(views: readonly DealView[]): DealView[] {
  return [...views].sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    if (a.origin !== b.origin) return a.origin === "curated" ? -1 : 1;
    return a.place.localeCompare(b.place);
  });
}
