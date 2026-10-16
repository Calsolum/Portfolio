import type { Coords } from "../types";

const EARTH_RADIUS_KM = 6371.0088;

export function isValidCoords(c: Coords): boolean {
  return (
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lon) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lon >= -180 &&
    c.lon <= 180
  );
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Three decimals is about 110 m. That is all any third-party service needs to see. */
export function roundCoords(c: Coords, decimals = 3): Coords {
  const factor = 10 ** decimals;
  return { lat: Math.round(c.lat * factor) / factor, lon: Math.round(c.lon * factor) / factor };
}

/**
 * Web search works on a coarse grid so that everyone in the same patch shares
 * one cached search and the server never learns where in the patch they are.
 * 0.05 degrees is about 5.5 km north-south and 4 km east-west at Toronto's latitude.
 */
export const CELL_DEG = 0.05;
const LAT_CELLS = Math.round(180 / CELL_DEG);
const LON_CELLS = Math.round(360 / CELL_DEG);

/** Integer grid indices, both counted from the south-west corner of the world. */
export interface Cell {
  lat: number;
  lon: number;
}

export function cellOf(c: Coords): Cell {
  return {
    lat: Math.min(LAT_CELLS - 1, Math.floor((c.lat + 90) / CELL_DEG)),
    lon: Math.min(LON_CELLS - 1, Math.floor((c.lon + 180) / CELL_DEG)),
  };
}

export function cellId(cell: Cell): string {
  return `${cell.lat}:${cell.lon}`;
}

/** Strict: two integers inside the grid, nothing else. This is what the API route trusts. */
export function parseCellId(raw: string | null | undefined): Cell | null {
  const match = /^(\d{1,4}):(\d{1,4})$/.exec(raw ?? "");
  if (!match) return null;
  const cell = { lat: Number(match[1]), lon: Number(match[2]) };
  return cell.lat < LAT_CELLS && cell.lon < LON_CELLS ? cell : null;
}

export function cellCenter(cell: Cell): Coords {
  return {
    lat: Math.round(((cell.lat + 0.5) * CELL_DEG - 90) * 1e6) / 1e6,
    lon: Math.round(((cell.lon + 0.5) * CELL_DEG - 180) * 1e6) / 1e6,
  };
}

/** Opens turn-by-turn directions in Google Maps (or the Maps app on a phone). */
export function directionsUrl(to: Coords): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}`;
}

/** For places we only know by name and address. */
export function mapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** "650 m" under a kilometre (to the nearest 50), "1.4 km" above. */
export function formatDistance(km: number): string {
  const meters = Math.round((km * 1000) / 50) * 50;
  return meters < 1000 ? `${Math.max(50, meters)} m` : `${km.toFixed(1)} km`;
}
