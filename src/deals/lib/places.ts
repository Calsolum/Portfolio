import type { Coords, Place } from "../types";
import { findCachedPlaces, loadPlacesEntries, rememberPlaces, savePlacesEntries } from "./cache";
import { haversineKm, roundCoords } from "./geo";
import { fetchPlaces, type FetchPlacesOptions } from "./osm";

/**
 * A lookup is stored around the position rounded to about 100 m, so a repeat
 * request from the exact position sits a few metres off-centre. Fetching a
 * slightly wider circle than asked keeps the stored one containing it, and
 * lets the same place and radius be served from the cache every time.
 */
export const COVER_MARGIN_KM = 0.2;

export interface LoadPlacesOptions extends FetchPlacesOptions {
  now?: () => number;
}

/**
 * Food places within `radiusKm` of `location`: from this browser's cache when a
 * recent lookup covers the circle, otherwise from OpenStreetMap (and then cached).
 */
export async function loadPlaces(
  location: Coords,
  radiusKm: number,
  options: LoadPlacesOptions = {},
): Promise<Place[]> {
  const { now = Date.now, ...fetchOptions } = options;
  const at = now();

  const cached = findCachedPlaces(loadPlacesEntries(), location, radiusKm, at);
  if (cached) return cached;

  const where = roundCoords(location);
  const covered = radiusKm + COVER_MARGIN_KM;
  const fetched = await fetchPlaces(where, covered, fetchOptions);
  savePlacesEntries(rememberPlaces(loadPlacesEntries(), { ...where, radiusKm: covered, at, places: fetched }, at));
  return fetched.filter((place) => haversineKm(location, place) <= radiusKm);
}
