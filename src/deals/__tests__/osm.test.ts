import { describe, expect, it } from "vitest";

import { haversineKm } from "../lib/geo";
import {
  FOOD_AMENITIES,
  OVERPASS_ENDPOINTS,
  OverpassUnavailableError,
  countryOf,
  fetchPlaces,
  labelFromAddress,
  looksLikePostalCode,
  overpassQuery,
  parsePlaces,
  reverseLookup,
  searchLocations,
} from "../lib/osm";
import fixture from "./fixtures/overpass-brampton.json";

const CENTER = { lat: 43.6858, lon: -79.7599 };

interface Call {
  url: string;
  init?: RequestInit;
}
type Handler = (call: Call) => Response | Promise<Response>;

/** A fetch whose n-th call runs the n-th handler (the last handler repeats). */
function fakeFetch(...handlers: Handler[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handlers[Math.min(calls.length - 1, handlers.length - 1)](call);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok: Handler = () => json(fixture);
const down: Handler = () => new Response("Bad Gateway", { status: 502 });
const hang: Handler = ({ init }) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

describe("overpassQuery", () => {
  it("asks for every food amenity inside a box around the rounded centre, with no around filter", () => {
    const query = overpassQuery({ lat: 43.68587, lon: -79.75993 }, 2);
    expect(query).toContain("[out:json][timeout:40]");
    // 2 km either side of (43.686, -79.76): 0.01799 degrees of latitude, 0.02484 of longitude here.
    expect(query).toContain("(43.66801,-79.78484,43.70399,-79.73516)");
    expect(query.endsWith("out tags center qt;")).toBe(true);
    // `around` is what made the same question time out after 46 s on a public server.
    expect(query).not.toContain("around");
    for (const kind of FOOD_AMENITIES) expect(query).toContain(`nwr["amenity"="${kind}"]["name"]`);
  });

  it("grows the box with the radius", () => {
    const south = (query: string) => Number(/\((-?[\d.]+),/.exec(query)![1]);
    expect(south(overpassQuery(CENTER, 3))).toBeLessThan(south(overpassQuery(CENTER, 1)));
  });

  it("keeps the box on the planet near the poles and the date line", () => {
    const box = /\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)/.exec(overpassQuery({ lat: 89.99, lon: 179.99 }, 3))!
      .slice(1)
      .map(Number);
    const [south, west, north, east] = box;
    expect(north).toBeLessThanOrEqual(90);
    expect(east).toBeLessThanOrEqual(180);
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
  });
});

describe("parsePlaces", () => {
  const places = parsePlaces(fixture, CENTER);

  it("reads every food place in a real Brampton response", () => {
    expect(places).toHaveLength(fixture.elements.length);
    for (const place of places) {
      expect(place.name).not.toBe("");
      expect(FOOD_AMENITIES).toContain(place.kind);
      expect(Number.isFinite(place.lat) && Number.isFinite(place.lon)).toBe(true);
    }
  });

  it("keeps the brand and Wikidata ID that identify a chain", () => {
    const wildWing = places.find((place) => place.id === "node/10909775170");
    expect(wildWing).toMatchObject({
      name: "Wild Wing",
      kind: "restaurant",
      brand: "Wild Wing",
      brandWikidata: "Q8000869",
    });
  });

  it("takes the centre of a building mapped as a way", () => {
    const mcdonalds = places.find((place) => place.id === "way/34342695");
    expect(mcdonalds).toMatchObject({ lat: 43.696302, lon: -79.772751, brandWikidata: "Q38076" });
  });

  it("tidies cuisine tags", () => {
    expect(places.find((place) => place.name === "Munchers")?.cuisine).toBe("Indian · American");
    expect(places.find((place) => place.name === "Ice Cream Cafe")?.cuisine).toBe("Ice cream · Funnel cake");
  });

  it("sorts nearest first when given a centre", () => {
    const distances = places.map((place) => haversineKm(CENTER, place));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("returns nothing for input that is not an Overpass response", () => {
    expect(parsePlaces(null)).toEqual([]);
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces({ elements: "nope" })).toEqual([]);
  });

  it("skips malformed, nameless, non-food and off-planet elements", () => {
    const parsed = parsePlaces({
      elements: [
        null,
        5,
        {},
        { type: "node", id: 1, lat: 43, lon: -79, tags: { amenity: "bank", name: "Not food" } },
        { type: "node", id: 2, lat: 200, lon: -79, tags: { amenity: "cafe", name: "Bad latitude" } },
        { type: "way", id: 3, tags: { amenity: "cafe", name: "Way without a centre" } },
        { type: "node", id: 4, lat: 43, lon: -79, tags: { amenity: "cafe" } },
        { type: "node", id: 5, lat: 43, lon: -79, tags: { amenity: "cafe", name: "Fine", "brand:wikidata": "Qabc" } },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "node/5", name: "Fine" });
    expect(parsed[0].brandWikidata).toBeUndefined();
  });

  it("merges a venue mapped twice, keeping the fuller entry, but not same-name venues far apart", () => {
    const parsed = parsePlaces({
      elements: [
        { type: "node", id: 1, lat: 43.7, lon: -79.7, tags: { amenity: "cafe", name: "Beans" } },
        {
          type: "way",
          id: 2,
          center: { lat: 43.70002, lon: -79.70002 },
          tags: { amenity: "cafe", name: "Beans", "addr:street": "Main Street", "addr:housenumber": "5" },
        },
        { type: "node", id: 3, lat: 43.8, lon: -79.7, tags: { amenity: "cafe", name: "Beans" } },
      ],
    });
    expect(parsed.map((place) => place.id).sort()).toEqual(["node/3", "way/2"]);
    expect(parsed.find((place) => place.id === "way/2")?.address).toBe("5 Main Street");
  });
});

describe("fetchPlaces", () => {
  it("posts the query to the first server and parses the answer", async () => {
    const { impl, calls } = fakeFetch(ok);
    const places = await fetchPlaces(CENTER, 5, { fetchImpl: impl });
    expect(places).toHaveLength(fixture.elements.length);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(OVERPASS_ENDPOINTS[0]);
    expect(calls[0].init?.method).toBe("POST");
    expect(String(calls[0].init?.body)).toContain("data=");
  });

  it("trims the square box back to the circle that was asked for", async () => {
    const { impl } = fakeFetch(ok);
    const places = await fetchPlaces(CENTER, 1, { fetchImpl: impl });
    const here = { lat: 43.686, lon: -79.76 };
    expect(places.length).toBeGreaterThan(0);
    expect(places.length).toBeLessThan(fixture.elements.length);
    for (const place of places) expect(haversineKm(here, place)).toBeLessThanOrEqual(1);
  });

  it("moves on to the next server when one is down, and says so", async () => {
    const { impl, calls } = fakeFetch(down, ok);
    const status: string[] = [];
    const places = await fetchPlaces(CENTER, 5, { fetchImpl: impl, onStatus: (message) => status.push(message) });
    expect(places).toHaveLength(fixture.elements.length);
    expect(calls.map((call) => call.url)).toEqual([OVERPASS_ENDPOINTS[0], OVERPASS_ENDPOINTS[1]]);
    expect(status).toHaveLength(1);
  });

  it("treats a query that timed out on the server as a failure, even though it answers 200", async () => {
    const timedOut: Handler = () => json({ remark: "runtime error: Query timed out in query at line 4.", elements: [] });
    const { impl, calls } = fakeFetch(timedOut, ok);
    const places = await fetchPlaces(CENTER, 5, { fetchImpl: impl });
    expect(places).toHaveLength(fixture.elements.length);
    expect(calls).toHaveLength(2);
  });

  it("gives up on a server that hangs after the timeout", async () => {
    const { impl, calls } = fakeFetch(hang, ok);
    const places = await fetchPlaces(CENTER, 5, { fetchImpl: impl, timeoutMs: 20 });
    expect(places).toHaveLength(fixture.elements.length);
    expect(calls).toHaveLength(2);
  });

  it("throws OverpassUnavailableError when every server fails", async () => {
    const { impl, calls } = fakeFetch(down);
    const status: string[] = [];
    await expect(
      fetchPlaces(CENTER, 5, { fetchImpl: impl, onStatus: (message) => status.push(message) }),
    ).rejects.toBeInstanceOf(OverpassUnavailableError);
    expect(calls).toHaveLength(OVERPASS_ENDPOINTS.length);
    expect(status).toHaveLength(OVERPASS_ENDPOINTS.length - 1);
  });

  it("stops at once when the caller aborts, without trying other servers", async () => {
    const { impl, calls } = fakeFetch(hang, ok);
    const controller = new AbortController();
    const pending = fetchPlaces(CENTER, 5, { fetchImpl: impl, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("starts the next server alongside one that is slow, takes the first answer, and cancels the rest", async () => {
    const aborted: string[] = [];
    const slow: Handler = ({ url, init }) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted.push(url);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    const { impl, calls } = fakeFetch(slow, ok);
    const status: string[] = [];
    const places = await fetchPlaces(CENTER, 5, {
      fetchImpl: impl,
      staggerMs: 15,
      timeoutMs: 5000,
      onStatus: (message) => status.push(message),
    });

    expect(places).toHaveLength(fixture.elements.length);
    expect(calls.map((call) => call.url)).toEqual([OVERPASS_ENDPOINTS[0], OVERPASS_ENDPOINTS[1]]);
    expect(aborted).toEqual([OVERPASS_ENDPOINTS[0]]);
    expect(status).toHaveLength(1);
    expect(status[0]).toMatch(/slow/i);
  });

  it("does not start a second server when the first answers in time", async () => {
    const { impl, calls } = fakeFetch(ok);
    await fetchPlaces(CENTER, 5, { fetchImpl: impl, staggerMs: 15 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(calls).toHaveLength(1);
  });

  it("starts the next server at once after a failure, without waiting out the stagger", async () => {
    const { impl, calls } = fakeFetch(down, ok);
    const started = Date.now();
    await fetchPlaces(CENTER, 5, { fetchImpl: impl, staggerMs: 60_000 });
    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("keeps going while one server is still slow and others fail, and succeeds on a later one", async () => {
    // The first hangs, the second and third fail at once, the fourth answers.
    const { impl, calls } = fakeFetch(hang, down, down, ok);
    const places = await fetchPlaces(CENTER, 5, { fetchImpl: impl, staggerMs: 10, timeoutMs: 5000 });
    expect(places).toHaveLength(fixture.elements.length);
    expect(calls).toHaveLength(4);
  });

  it("does not start at all when the caller has already aborted", async () => {
    const { impl, calls } = fakeFetch(ok);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchPlaces(CENTER, 5, { fetchImpl: impl, signal: controller.signal })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("labels", () => {
  it("names the neighbourhood, city and state without repeating itself", () => {
    expect(labelFromAddress({ suburb: "Downtown Brampton", city: "Brampton", state: "Ontario" })).toBe(
      "Downtown Brampton, Brampton, Ontario",
    );
    expect(labelFromAddress({ city: "Brampton", state: "Brampton" })).toBe("Brampton");
  });

  it("falls back to the country, then to the fallback text", () => {
    expect(labelFromAddress({ town: "Lyon", country: "France" })).toBe("Lyon, France");
    expect(labelFromAddress(undefined, "Somewhere")).toBe("Somewhere");
    expect(labelFromAddress({}, "Somewhere")).toBe("Somewhere");
  });

  it("can lead with the street", () => {
    expect(labelFromAddress({ house_number: "1", road: "Main Street", city: "Brampton" }, "", true)).toBe(
      "1 Main Street, Brampton",
    );
  });

  it("reads a two-letter country code only", () => {
    expect(countryOf({ country_code: "ca" })).toBe("CA");
    expect(countryOf({ country_code: "canada" })).toBeUndefined();
    expect(countryOf(undefined)).toBeUndefined();
  });
});

describe("looksLikePostalCode", () => {
  it("recognises Canadian, US and UK postal codes, with or without the space", () => {
    for (const code of ["L6V", "L6V 1A9", "l6v1a9", "M5V-3L9", "90210", "90210-1234", "SW1A 1AA", "EC1A1BB"]) {
      expect(looksLikePostalCode(code), code).toBe(true);
    }
  });

  it("does not take place names or addresses for postal codes", () => {
    for (const text of ["Brampton", "60 Queen St E", "Springfield", "L6V 1A9 Brampton", "12", "1234567"]) {
      expect(looksLikePostalCode(text), text).toBe(false);
    }
  });
});

describe("searchLocations", () => {
  it("turns Nominatim rows into locations and drops rows without a usable position", async () => {
    const { impl, calls } = fakeFetch(() =>
      json([
        {
          lat: "43.6858",
          lon: "-79.7599",
          name: "Brampton",
          display_name: "Brampton, Peel, Ontario, Canada",
          address: { city: "Brampton", state: "Ontario", country: "Canada", country_code: "ca" },
        },
        {
          lat: "43.6426",
          lon: "-79.3871",
          name: "CN Tower",
          display_name: "CN Tower, Bremner Boulevard, Toronto, Ontario, Canada",
          address: {
            house_number: "290",
            road: "Bremner Boulevard",
            suburb: "Entertainment District",
            city: "Toronto",
            state: "Ontario",
            country_code: "ca",
          },
        },
        { lat: "nope", lon: "-79", display_name: "Broken" },
      ]),
    );
    const found = await searchLocations("brampton", undefined, impl);
    expect(found).toEqual([
      { lat: 43.6858, lon: -79.7599, label: "Brampton, Ontario", country: "CA" },
      {
        lat: 43.6426,
        lon: -79.3871,
        label: "CN Tower, 290 Bremner Boulevard, Entertainment District, Toronto, Ontario",
        country: "CA",
      },
    ]);
    expect(calls[0].url).toContain("nominatim.openstreetmap.org/search?");
    expect(calls[0].url).toContain("limit=5");
  });

  it("returns an empty list for a non-list answer and throws on an HTTP error", async () => {
    expect(await searchLocations("x", undefined, fakeFetch(() => json({ error: "?" })).impl)).toEqual([]);
    await expect(
      searchLocations("x", undefined, fakeFetch(() => new Response("", { status: 429 })).impl),
    ).rejects.toThrow("429");
  });
});

describe("reverseLookup", () => {
  it("sends only the rounded position and returns a neighbourhood label", async () => {
    const { impl, calls } = fakeFetch(() =>
      json({
        display_name: "Downtown Brampton, Brampton, Peel, Ontario, Canada",
        address: { suburb: "Downtown Brampton", city: "Brampton", state: "Ontario", country_code: "ca" },
      }),
    );
    const found = await reverseLookup({ lat: 43.68587, lon: -79.75993 }, undefined, impl);
    expect(found).toEqual({ label: "Downtown Brampton, Brampton, Ontario", country: "CA" });
    expect(calls[0].url).toContain("lat=43.686");
    expect(calls[0].url).toContain("lon=-79.76");
    expect(calls[0].url).toContain("zoom=14");
    expect(calls[0].url).not.toContain("43.68587");
  });
});
