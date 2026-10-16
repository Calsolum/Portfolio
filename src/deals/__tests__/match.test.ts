import { describe, expect, it } from "vitest";

import {
  buildCuratedViews,
  buildWebViews,
  coveredPlaces,
  dropCoveredWebViews,
  forDay,
  hasEnded,
  isStale,
  namesMatch,
  normalizeName,
  placeMatchesBrand,
  sortViews,
} from "../lib/match";
import type { CuratedDeal, DealView, Place, WebDeal } from "../types";

const CENTER = { lat: 43.6858, lon: -79.7599 };
const NOW = new Date("2026-10-16T12:00:00Z");

/** One degree of latitude is 111.2 km, so 0.0045 degrees is about 0.5 km. */
const north = (km: number) => CENTER.lat + km / 111.2;

const place = (
  fields: Pick<Place, "id" | "name" | "lat" | "lon"> & Partial<Place>,
): Place => ({ kind: "restaurant", ...fields });

const wildWingNear = place({
  id: "node/1",
  name: "Wild Wing",
  brand: "Wild Wing",
  brandWikidata: "Q8000869",
  lat: north(0.5),
  lon: CENTER.lon,
  address: "1 Main Street",
});
const wildWingFar = place({
  id: "node/2",
  name: "Wild Wing",
  brand: "Wild Wing",
  brandWikidata: "Q8000869",
  lat: north(1.6),
  lon: CENTER.lon,
});
const wildWingOut = place({
  id: "node/3",
  name: "Wild Wing",
  brand: "Wild Wing",
  brandWikidata: "Q8000869",
  lat: north(5.6),
  lon: CENTER.lon,
});
const pub = place({ id: "node/4", name: "Keenan Irish Pub", kind: "pub", lat: north(0.15), lon: CENTER.lon });

const wingNight: CuratedDeal = {
  id: "wild-wing-wed",
  title: "Wing night",
  details: "Wings are cheaper.",
  days: ["wed"],
  sourceUrl: "https://example.com/wild-wing",
  verified: "2026-10-01",
  match: { kind: "brand", names: ["Wild Wing"], wikidata: ["Q8000869"], countries: ["CA"] },
};
const pubSpecial: CuratedDeal = {
  id: "pub-tue",
  title: "Burger and a pint",
  details: "A burger and a pint for one price.",
  days: ["tue", "thu"],
  sourceUrl: "https://example.com/pub",
  verified: "2026-10-01",
  match: { kind: "place", name: "Keenan Irish Pub", lat: north(0.15), lon: CENTER.lon, address: "2 Queen Street" },
};

const args = (overrides: Partial<Parameters<typeof buildCuratedViews>[1]> = {}) => ({
  center: CENTER,
  radiusKm: 2,
  places: [wildWingNear, wildWingFar, wildWingOut, pub],
  country: "CA",
  now: NOW,
  ...overrides,
});

describe("normalizeName", () => {
  it("drops apostrophes of either kind, accents and punctuation, and spells out the ampersand", () => {
    expect(normalizeName("McDonald's")).toBe("mcdonalds");
    expect(normalizeName("McDonald’s")).toBe("mcdonalds");
    expect(normalizeName("Café & Bar")).toBe("cafe and bar");
    expect(normalizeName("  A&W  ")).toBe("a and w");
    expect(normalizeName("Pho Dau-Bo")).toBe("pho dau bo");
  });
});

describe("namesMatch", () => {
  it("matches names that are equal once normalised", () => {
    expect(namesMatch("Wild Wing", "WILD  WING")).toBe(true);
    expect(namesMatch("McDonald's", "McDonalds")).toBe(true);
  });

  it("matches when every word of the shorter name is in the longer one", () => {
    expect(namesMatch("Wild Wing", "Wild Wing Brampton")).toBe(true);
    expect(namesMatch("Wild Wing Brampton", "Wild Wing")).toBe(true);
  });

  it("does not match different venues", () => {
    expect(namesMatch("Wild Wing", "Wild Thing")).toBe(false);
    expect(namesMatch("Pizza Pizza", "Pizza Nova")).toBe(false);
  });

  it("never matches on words that only say what kind of venue it is", () => {
    expect(namesMatch("The Grill", "Chuck Roadhouse Bar and Grill")).toBe(false);
    expect(namesMatch("Pub", "Casa Europa Sports Bar")).toBe(false);
  });

  it("does not match empty names", () => {
    expect(namesMatch("", "Wild Wing")).toBe(false);
    expect(namesMatch("!!!", "???")).toBe(false);
  });
});

describe("placeMatchesBrand", () => {
  const match = { kind: "brand" as const, names: ["Wild Wing"], wikidata: ["Q8000869"] };

  it("trusts the Wikidata ID even when the name differs", () => {
    expect(placeMatchesBrand(place({ id: "n/1", name: "WW Brampton", lat: 0, lon: 0, brandWikidata: "Q8000869" }), match)).toBe(true);
  });

  it("falls back to the name, or to the brand tag", () => {
    expect(placeMatchesBrand(place({ id: "n/2", name: "Wild Wing", lat: 0, lon: 0 }), match)).toBe(true);
    expect(placeMatchesBrand(place({ id: "n/3", name: "Local Wings", brand: "Wild Wing", lat: 0, lon: 0 }), match)).toBe(true);
  });

  it("rejects other brands", () => {
    expect(placeMatchesBrand(place({ id: "n/4", name: "Popeyes", lat: 0, lon: 0, brandWikidata: "Q1330910" }), match)).toBe(false);
  });
});

describe("isStale", () => {
  it("is false within 90 days of the check and true after", () => {
    expect(isStale("2026-10-01", NOW)).toBe(false);
    expect(isStale("2026-07-19", NOW)).toBe(false);
    expect(isStale("2026-07-17", NOW)).toBe(true);
  });

  it("treats an unreadable date as stale", () => {
    expect(isStale("sometime", NOW)).toBe(true);
  });
});

describe("hasEnded", () => {
  it("is false until the end of the last day, and true after", () => {
    expect(hasEnded("2026-10-31", new Date("2026-10-31T23:00:00Z"))).toBe(false);
    expect(hasEnded("2026-10-31", new Date("2026-11-01T00:30:00Z"))).toBe(true);
  });

  it("never ends a deal that has no end date or an unreadable one", () => {
    expect(hasEnded(undefined, NOW)).toBe(false);
    expect(hasEnded("someday", NOW)).toBe(false);
  });
});

describe("buildCuratedViews", () => {
  it("collapses a chain to its nearest branch inside the radius, and counts the branches", () => {
    const [view, ...rest] = buildCuratedViews([wingNight], args());
    expect(rest).toHaveLength(0);
    expect(view).toMatchObject({
      key: "curated:wild-wing-wed",
      origin: "curated",
      place: "Wild Wing",
      address: "1 Main Street",
      chain: true,
      locations: 2,
      stale: false,
      verified: "2026-10-01",
    });
    expect(view.distanceKm).toBeCloseTo(0.5, 1);
    expect(view.lat).toBe(wildWingNear.lat);
  });

  it("only counts branches inside the radius", () => {
    expect(buildCuratedViews([wingNight], args({ radiusKm: 1 }))[0].locations).toBe(1);
  });

  it("leaves out a chain deal when no branch is nearby", () => {
    expect(buildCuratedViews([wingNight], args({ places: [pub] }))).toEqual([]);
    expect(buildCuratedViews([wingNight], args({ places: [wildWingOut] }))).toEqual([]);
  });

  it("keeps a country-specific chain deal out of other countries, but shows it when the country is unknown", () => {
    expect(buildCuratedViews([wingNight], args({ country: "US" }))).toEqual([]);
    expect(buildCuratedViews([wingNight], args({ country: "CA" }))).toHaveLength(1);
    expect(buildCuratedViews([wingNight], args({ country: undefined }))).toHaveLength(1);
  });

  it("shows a single-venue deal from its own coordinates, even with no OpenStreetMap data", () => {
    const [view] = buildCuratedViews([pubSpecial], args({ places: [] }));
    expect(view).toMatchObject({ place: "Keenan Irish Pub", address: "2 Queen Street" });
    expect(view.distanceKm).toBeCloseTo(0.15, 1);
    expect(view.chain).toBeUndefined();
  });

  it("drops a single-venue deal outside the radius", () => {
    const far = { ...pubSpecial, match: { ...pubSpecial.match, lat: north(9) } } as CuratedDeal;
    expect(buildCuratedViews([far], args())).toEqual([]);
  });

  it("hides a deal the day after it ends, and shows its end date until then", () => {
    const limited = { ...wingNight, until: "2026-10-31" };
    const [view] = buildCuratedViews([limited], args({ now: new Date("2026-10-31T12:00:00Z") }));
    expect(view.until).toBe("2026-10-31");
    expect(buildCuratedViews([limited], args({ now: new Date("2026-11-01T12:00:00Z") }))).toEqual([]);
  });

  it("flags a deal whose source was last checked long ago", () => {
    const old = { ...wingNight, verified: "2026-01-05" };
    expect(buildCuratedViews([old], args())[0].stale).toBe(true);
  });
});

describe("buildWebViews", () => {
  const webDeal = (fields: Partial<WebDeal> = {}): WebDeal => ({
    place: "Keenan Irish Pub",
    title: "Trivia night",
    details: "Teams of up to six.",
    days: ["thu"],
    sourceUrl: "https://example.com/trivia",
    chain: false,
    ...fields,
  });

  it("ties a web deal to the matching nearby place for a distance and an address", () => {
    const withAddress = place({ ...pub, id: "node/9", address: "2 Queen Street" });
    const [view] = buildWebViews([webDeal()], args({ places: [withAddress] }));
    expect(view).toMatchObject({ origin: "web", place: "Keenan Irish Pub", address: "2 Queen Street", lat: withAddress.lat });
    expect(view.distanceKm).toBeCloseTo(0.15, 1);
  });

  it("prefers the address the page gave", () => {
    const [view] = buildWebViews([webDeal({ address: "9 Page Street" })], args({ places: [pub] }));
    expect(view.address).toBe("9 Page Street");
  });

  it("leaves distance empty when no nearby place matches", () => {
    const [view] = buildWebViews([webDeal({ place: "Somewhere Else Entirely" })], args());
    expect(view.distanceKm).toBeUndefined();
    expect(view.lat).toBeUndefined();
  });

  it("counts several matching branches of a chain and ignores ones outside the radius", () => {
    const [view] = buildWebViews([webDeal({ place: "Wild Wing", chain: true })], args());
    expect(view.locations).toBe(2);
    expect(view.chain).toBe(true);
  });

  it("gives each deal its own key", () => {
    const views = buildWebViews([webDeal(), webDeal({ title: "Karaoke" })], args());
    expect(new Set(views.map((view) => view.key)).size).toBe(2);
  });
});

describe("dropCoveredWebViews", () => {
  const [curated] = buildCuratedViews([wingNight], args());
  const web = (placeName: string, days: DealView["days"]): DealView => ({
    key: `web:${placeName}:${days.join("")}`,
    origin: "web",
    place: placeName,
    title: "Anything",
    details: "Anything",
    days,
    sourceUrl: "https://example.com",
  });

  it("drops a web deal for a venue and day a curated deal already covers", () => {
    expect(dropCoveredWebViews([web("Wild Wing", ["wed"])], [curated])).toEqual([]);
  });

  it("keeps it when the day or the venue differs", () => {
    const kept = [web("Wild Wing", ["thu"]), web("Other Pub", ["wed"])];
    expect(dropCoveredWebViews(kept, [curated])).toEqual(kept);
  });
});

describe("coveredPlaces", () => {
  it("lists each place once, in order, using the first name of a chain", () => {
    const more = { ...wingNight, id: "wild-wing-thu", days: ["thu" as const] };
    expect(coveredPlaces([wingNight, pubSpecial, more, pubSpecial])).toEqual(["Wild Wing", "Keenan Irish Pub"]);
    expect(coveredPlaces([])).toEqual([]);
  });
});

describe("forDay and sortViews", () => {
  const view = (fields: Partial<DealView> & Pick<DealView, "key" | "place">): DealView => ({
    origin: "curated",
    title: "t",
    details: "d",
    days: ["mon"],
    sourceUrl: "https://example.com",
    ...fields,
  });

  it("filters by day, or returns everything for all", () => {
    const views = [view({ key: "a", place: "A", days: ["mon", "tue"] }), view({ key: "b", place: "B", days: ["wed"] })];
    expect(forDay(views, "tue").map((v) => v.key)).toEqual(["a"]);
    expect(forDay(views, "wed").map((v) => v.key)).toEqual(["b"]);
    expect(forDay(views, "all")).toHaveLength(2);
  });

  it("sorts nearest first, unknown distances last, curated before web at a tie, then by name", () => {
    const sorted = sortViews([
      view({ key: "none", place: "Z", origin: "web" }),
      view({ key: "far", place: "F", distanceKm: 2 }),
      view({ key: "web", place: "B", origin: "web", distanceKm: 1 }),
      view({ key: "cur-b", place: "B", distanceKm: 1 }),
      view({ key: "cur-a", place: "A", distanceKm: 1 }),
    ]);
    expect(sorted.map((v) => v.key)).toEqual(["cur-a", "cur-b", "web", "far", "none"]);
  });
});
