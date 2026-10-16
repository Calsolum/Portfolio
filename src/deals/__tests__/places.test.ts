import { afterEach, describe, expect, it, vi } from "vitest";

import { PLACES_TTL_MS } from "../lib/cache";
import { haversineKm } from "../lib/geo";
import { OverpassUnavailableError } from "../lib/osm";
import { COVER_MARGIN_KM, loadPlaces } from "../lib/places";
import fixture from "./fixtures/overpass-brampton.json";

/** Not on a rounding boundary: 43.685832, -79.7599366 is where Nominatim puts Brampton. */
const EXACT = { lat: 43.685832, lon: -79.7599366 };
const T0 = 1_800_000_000_000;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function overpass(status = 200) {
  const bodies: string[] = [];
  const impl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return status === 200
      ? new Response(JSON.stringify(fixture), { status })
      : new Response("Bad Gateway", { status });
  }) as typeof fetch;
  return { impl, bodies };
}

const boxOf = (body: string) =>
  /%28(-?[\d.]+)%2C(-?[\d.]+)%2C(-?[\d.]+)%2C(-?[\d.]+)%29/.exec(body)!.slice(1).map(Number);

afterEach(() => vi.unstubAllGlobals());

describe("loadPlaces", () => {
  it("fetches once, then serves the same place and radius from the cache even from the exact position", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const { impl, bodies } = overpass();

    const first = await loadPlaces(EXACT, 2, { fetchImpl: impl, now: () => T0 });
    const again = await loadPlaces(EXACT, 2, { fetchImpl: impl, now: () => T0 + 1000 });
    // A few metres off, as a phone's GPS would be on the next visit.
    const nudged = await loadPlaces({ lat: EXACT.lat + 0.0003, lon: EXACT.lon - 0.0003 }, 2, {
      fetchImpl: impl,
      now: () => T0 + 2000,
    });

    expect(bodies).toHaveLength(1);
    expect(again).toEqual(first);
    expect(nudged.length).toBeGreaterThan(0);
  });

  it("asks Overpass for a slightly wider circle than requested", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const wide = overpass();
    await loadPlaces(EXACT, 2, { fetchImpl: wide.impl, now: () => T0 });
    // A 2 km box is 0.01799 degrees of latitude either side; 2.2 km is 0.01978.
    const [south, , north] = boxOf(wide.bodies[0]);
    expect((north - south) / 2).toBeCloseTo(2.2 / 111.2, 4);
    expect(COVER_MARGIN_KM).toBe(0.2);
  });

  it("returns only places inside the requested circle, around the exact position", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const places = await loadPlaces(EXACT, 1, { fetchImpl: overpass().impl, now: () => T0 });
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) expect(haversineKm(EXACT, place)).toBeLessThanOrEqual(1);
  });

  it("serves a smaller radius from a bigger lookup without another request", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const { impl, bodies } = overpass();
    const three = await loadPlaces(EXACT, 3, { fetchImpl: impl, now: () => T0 });
    const one = await loadPlaces(EXACT, 1, { fetchImpl: impl, now: () => T0 + 1000 });
    expect(bodies).toHaveLength(1);
    expect(one.length).toBeLessThan(three.length);
  });

  it("fetches again for a bigger radius, or when the stored lookup is a day old", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const { impl, bodies } = overpass();
    await loadPlaces(EXACT, 1, { fetchImpl: impl, now: () => T0 });
    await loadPlaces(EXACT, 3, { fetchImpl: impl, now: () => T0 + 1000 });
    expect(bodies).toHaveLength(2);
    await loadPlaces(EXACT, 3, { fetchImpl: impl, now: () => T0 + PLACES_TTL_MS + 5000 });
    expect(bodies).toHaveLength(3);
  });

  it("works without any storage, and does not cache a failure", async () => {
    const down = overpass(502);
    await expect(
      loadPlaces(EXACT, 2, { fetchImpl: down.impl, endpoints: ["https://a.example/"], now: () => T0 }),
    ).rejects.toBeInstanceOf(OverpassUnavailableError);

    const up = overpass();
    expect((await loadPlaces(EXACT, 2, { fetchImpl: up.impl, now: () => T0 })).length).toBeGreaterThan(0);
    expect(up.bodies).toHaveLength(1);
  });
});
