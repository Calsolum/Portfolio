import { describe, expect, it } from "vitest";

import { CURATED_DEALS } from "../data/curated";
import { WEEKDAYS } from "../types";
import { haversineKm } from "../lib/geo";
import { buildCuratedViews, namesMatch, placeMatchesBrand } from "../lib/match";
import { parsePlaces } from "../lib/osm";
import { safeHttpUrl } from "../lib/url";
import fixture from "./fixtures/overpass-brampton.json";

const DOWNTOWN_BRAMPTON = { lat: 43.6858, lon: -79.7599 };
const places = parsePlaces(fixture, DOWNTOWN_BRAMPTON);

describe("curated deals: data integrity", () => {
  it("has a useful number of deals", () => {
    expect(CURATED_DEALS.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every deal a unique, kebab-case ID", () => {
    const ids = CURATED_DEALS.map((deal) => deal.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has readable text on every deal", () => {
    for (const deal of CURATED_DEALS) {
      expect(deal.title.trim(), deal.id).not.toBe("");
      expect(deal.title.length, deal.id).toBeLessThanOrEqual(60);
      expect(deal.details.trim(), deal.id).not.toBe("");
      expect(deal.details.length, deal.id).toBeLessThanOrEqual(300);
      for (const text of [deal.title, deal.details, deal.hours, deal.price, deal.conditions]) {
        expect(text ?? "", deal.id).not.toMatch(/todo|tbd|lorem|\s{2,}/i);
      }
    }
  });

  it("ties every deal to valid weekdays, once each, in week order", () => {
    for (const deal of CURATED_DEALS) {
      expect(deal.days.length, deal.id).toBeGreaterThan(0);
      const ordered = WEEKDAYS.filter((day) => deal.days.includes(day));
      expect(deal.days, deal.id).toEqual(ordered);
    }
  });

  it("cites an https page for every deal", () => {
    for (const deal of CURATED_DEALS) {
      const safe = safeHttpUrl(deal.sourceUrl);
      expect(safe, deal.id).toBeDefined();
      expect(safe, deal.id).toMatch(/^https:\/\//);
    }
  });

  it("dates every check, and never in the future", () => {
    for (const deal of CURATED_DEALS) {
      expect(deal.verified, deal.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const checked = Date.parse(`${deal.verified}T00:00:00Z`);
      expect(Number.isFinite(checked), deal.id).toBe(true);
      expect(checked, deal.id).toBeLessThanOrEqual(Date.now() + 86_400_000);
    }
  });

  it("gives any end date as a real day on or after the check", () => {
    for (const deal of CURATED_DEALS) {
      if (deal.until === undefined) continue;
      expect(deal.until, deal.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const end = Date.parse(`${deal.until}T00:00:00Z`);
      expect(Number.isFinite(end), deal.id).toBe(true);
      expect(end, deal.id).toBeGreaterThanOrEqual(Date.parse(`${deal.verified}T00:00:00Z`));
    }
  });

  it("describes chains with usable names, real Wikidata IDs and two-letter country codes", () => {
    for (const deal of CURATED_DEALS) {
      if (deal.match.kind !== "brand") continue;
      expect(deal.match.names.length, deal.id).toBeGreaterThan(0);
      for (const name of deal.match.names) expect(namesMatch(name, name), `${deal.id}: ${name}`).toBe(true);
      for (const id of deal.match.wikidata ?? []) expect(id, deal.id).toMatch(/^Q\d+$/);
      for (const country of deal.match.countries ?? []) expect(country, deal.id).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("pins single venues to real coordinates and a well-formed OpenStreetMap ID", () => {
    for (const deal of CURATED_DEALS) {
      if (deal.match.kind !== "place") continue;
      expect(Math.abs(deal.match.lat), deal.id).toBeLessThanOrEqual(90);
      expect(Math.abs(deal.match.lon), deal.id).toBeLessThanOrEqual(180);
      if (deal.match.osm) expect(deal.match.osm, deal.id).toMatch(/^(node|way|relation)\/\d+$/);
    }
  });

  it("keeps the same venue at the same position in every one of its deals", () => {
    const seen = new Map<string, string>();
    for (const deal of CURATED_DEALS) {
      if (deal.match.kind !== "place") continue;
      const here = `${deal.match.lat},${deal.match.lon},${deal.match.address}`;
      const before = seen.get(deal.match.name);
      if (before) expect(here, deal.id).toBe(before);
      seen.set(deal.match.name, here);
    }
  });
});

describe("curated deals against real Brampton OpenStreetMap data", () => {
  it("agrees with OpenStreetMap about where each pinned venue is", () => {
    for (const deal of CURATED_DEALS) {
      const { match } = deal;
      if (match.kind !== "place" || !match.osm) continue;
      const osmId = match.osm;
      const osm = places.find((place) => place.id === osmId);
      expect(osm, `${deal.id}: ${osmId} is in the fixture`).toBeDefined();
      expect(haversineKm(osm!, match), deal.id).toBeLessThan(0.05);
    }
  });

  it("recognises Wild Wing by its Wikidata ID", () => {
    const wildWing = places.find((place) => place.name === "Wild Wing")!;
    const deal = CURATED_DEALS.find((d) => d.id === "wild-wing-tuesday-single-orders")!;
    expect(deal.match.kind).toBe("brand");
    if (deal.match.kind === "brand") expect(placeMatchesBrand(wildWing, deal.match)).toBe(true);
  });

  const viewsFor = (radiusKm: number, country = "CA") =>
    buildCuratedViews(CURATED_DEALS, {
      center: DOWNTOWN_BRAMPTON,
      radiusKm,
      places,
      country,
      now: new Date("2026-10-20T12:00:00Z"),
    });

  it("shows nearby chain and pub deals within 2 km of downtown, and nothing from chains with no branch nearby", () => {
    const ids = viewsFor(2).map((view) => view.key.replace("curated:", ""));
    expect(ids).toContain("wild-wing-tuesday-single-orders");
    expect(ids).toContain("chucks-roadhouse-wednesday-rib-day");
    expect(ids).toContain("tracks-brampton-monday-wing-night");
    expect(ids.some((id) => id.startsWith("boston-pizza"))).toBe(false);
  });

  it("adds Keenan's Irish Pub, about 2.2 km away, when the radius grows to 3 km", () => {
    expect(viewsFor(2).some((view) => view.place === "Keenan's Irish Pub")).toBe(false);
    expect(viewsFor(3).filter((view) => view.place === "Keenan's Irish Pub")).toHaveLength(5);
  });

  it("keeps Canadian chain deals out of the United States", () => {
    expect(viewsFor(3, "US").filter((view) => view.chain)).toEqual([]);
  });

  it("treats freshly checked deals as current", () => {
    expect(viewsFor(3).every((view) => view.stale === false)).toBe(true);
  });
});
