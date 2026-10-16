/**
 * Shared shapes for the Daily Deals page. Everything here is plain data, so it
 * can cross the network (the web-search route) and sit in localStorage.
 */

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Coords {
  lat: number;
  lon: number;
}

/** Where the visitor is looking. Exact coordinates never leave the browser. */
export interface UserLocation extends Coords {
  label: string;
  /** ISO 3166-1 alpha-2, upper case. Keeps country-specific chain deals honest. */
  country?: string;
}

/** A food place from OpenStreetMap. */
export interface Place extends Coords {
  /** The OSM element, e.g. "node/375835454". */
  id: string;
  name: string;
  /** The OSM `amenity` value: restaurant, fast_food, cafe, pub, bar, food_court or ice_cream. */
  kind: string;
  cuisine?: string;
  brand?: string;
  /** Wikidata ID of the brand, e.g. "Q8000869" for Wild Wing. The reliable way to spot a chain. */
  brandWikidata?: string;
  address?: string;
}

export type DealMatch =
  /** A chain: any nearby branch carries the deal. Matched on Wikidata ID first, then on name. */
  | { kind: "brand"; names: string[]; wikidata?: string[]; countries?: string[] }
  /** A single venue, so it shows even when OpenStreetMap is unreachable. */
  | { kind: "place"; name: string; lat: number; lon: number; address?: string; osm?: string };

/** A deal someone has checked against its source and typed into src/deals/data/curated.ts. */
export interface CuratedDeal {
  /** Unique and stable, e.g. "wild-wing-wing-wednesday". */
  id: string;
  title: string;
  details: string;
  days: Weekday[];
  hours?: string;
  price?: string;
  conditions?: string;
  /** The page that states the deal. */
  sourceUrl: string;
  /** The day the source was last checked, YYYY-MM-DD. */
  verified: string;
  /** The last day the deal runs, YYYY-MM-DD, when the source gives one. It stops showing the day after. */
  until?: string;
  match: DealMatch;
}

/** A deal Claude found on the web, after the server has validated it. */
export interface WebDeal {
  place: string;
  address?: string;
  title: string;
  details: string;
  days: Weekday[];
  hours?: string;
  price?: string;
  /** A page the search actually returned. */
  sourceUrl: string;
  chain: boolean;
}

export interface WebSearchResult {
  /** The area that was searched, e.g. "Downtown Brampton, Brampton, Ontario". */
  area: string;
  /** ISO timestamp of the search. */
  searchedAt: string;
  deals: WebDeal[];
}

/** One card on the page: a curated or web deal, tied to a nearby place where possible. */
export interface DealView {
  /** Stable React key. */
  key: string;
  origin: "curated" | "web";
  place: string;
  address?: string;
  title: string;
  details: string;
  days: Weekday[];
  hours?: string;
  price?: string;
  conditions?: string;
  sourceUrl: string;
  /** Curated deals only: when the source was last checked, YYYY-MM-DD. */
  verified?: string;
  /** True when `verified` is older than the staleness window. */
  stale?: boolean;
  /** The last day the deal runs, YYYY-MM-DD, when its source says so. */
  until?: string;
  /** Straight-line distance from the search point, when the place is known. */
  distanceKm?: number;
  lat?: number;
  lon?: number;
  /** How many matching branches are inside the radius (chains only). */
  locations?: number;
  chain?: boolean;
}

export const RADII_KM = [1, 2, 3] as const;
export type RadiusKm = (typeof RADII_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 2;
