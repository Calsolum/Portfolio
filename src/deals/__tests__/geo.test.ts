import { describe, expect, it } from "vitest";

import {
  CELL_DEG,
  cellCenter,
  cellId,
  cellOf,
  directionsUrl,
  formatDistance,
  haversineKm,
  isValidCoords,
  mapSearchUrl,
  parseCellId,
  roundCoords,
} from "../lib/geo";

const BRAMPTON = { lat: 43.6858, lon: -79.7599 };
const TORONTO = { lat: 43.6532, lon: -79.3832 };

describe("haversineKm", () => {
  it("is zero for the same point and symmetric otherwise", () => {
    expect(haversineKm(BRAMPTON, BRAMPTON)).toBe(0);
    expect(haversineKm(BRAMPTON, TORONTO)).toBeCloseTo(haversineKm(TORONTO, BRAMPTON), 9);
  });

  it("puts Brampton about 30 km from downtown Toronto", () => {
    const km = haversineKm(BRAMPTON, TORONTO);
    expect(km).toBeGreaterThan(29);
    expect(km).toBeLessThan(32);
  });

  it("measures a degree of latitude as about 111 km", () => {
    expect(haversineKm({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })).toBeCloseTo(111.2, 0);
  });
});

describe("roundCoords", () => {
  it("rounds to three decimals by default, about 110 m", () => {
    expect(roundCoords({ lat: 43.68587, lon: -79.75993 })).toEqual({ lat: 43.686, lon: -79.76 });
  });
});

describe("isValidCoords", () => {
  it("accepts real positions and rejects the rest", () => {
    expect(isValidCoords(BRAMPTON)).toBe(true);
    expect(isValidCoords({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidCoords({ lat: 0, lon: -181 })).toBe(false);
    expect(isValidCoords({ lat: Number.NaN, lon: 0 })).toBe(false);
  });
});

describe("grid cells", () => {
  it("puts Brampton in a stable cell whose centre is within half a cell", () => {
    const cell = cellOf(BRAMPTON);
    expect(cellId(cell)).toBe("2673:2004");
    const centre = cellCenter(cell);
    expect(Math.abs(centre.lat - BRAMPTON.lat)).toBeLessThanOrEqual(CELL_DEG / 2);
    expect(Math.abs(centre.lon - BRAMPTON.lon)).toBeLessThanOrEqual(CELL_DEG / 2);
  });

  it("gives nearby points the same cell and far points a different one", () => {
    expect(cellId(cellOf({ lat: 43.6862, lon: -79.7604 }))).toBe(cellId(cellOf(BRAMPTON)));
    expect(cellId(cellOf(TORONTO))).not.toBe(cellId(cellOf(BRAMPTON)));
  });

  it("clamps the poles and the date line into the grid", () => {
    expect(cellOf({ lat: 90, lon: 180 })).toEqual({ lat: 3599, lon: 7199 });
    expect(cellOf({ lat: -90, lon: -180 })).toEqual({ lat: 0, lon: 0 });
  });

  it("round-trips through parseCellId", () => {
    const cell = cellOf(BRAMPTON);
    expect(parseCellId(cellId(cell))).toEqual(cell);
  });

  it("accepts only two integers inside the grid", () => {
    expect(parseCellId("0:0")).toEqual({ lat: 0, lon: 0 });
    expect(parseCellId("3599:7199")).toEqual({ lat: 3599, lon: 7199 });
    for (const bad of [null, undefined, "", "abc", "1:2:3", "-1:5", "3600:0", "0:7200", " 12:34", "12.5:3", "1e3:4", "12345:1"]) {
      expect(parseCellId(bad)).toBeNull();
    }
  });
});

describe("links and labels", () => {
  it("builds a directions link from coordinates", () => {
    expect(directionsUrl({ lat: 43.7, lon: -79.8 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=43.7,-79.8",
    );
  });

  it("encodes a map search", () => {
    expect(mapSearchUrl("Wild Wing & Co, Brampton")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Wild%20Wing%20%26%20Co%2C%20Brampton",
    );
  });

  it("formats distances", () => {
    expect(formatDistance(0.02)).toBe("50 m");
    expect(formatDistance(0.43)).toBe("450 m");
    expect(formatDistance(0.99)).toBe("1.0 km");
    expect(formatDistance(1.44)).toBe("1.4 km");
  });
});
