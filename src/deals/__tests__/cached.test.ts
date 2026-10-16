import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WebSearchResult } from "../types";

const mocks = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  searchDeals: vi.fn(),
}));

// A stand-in for Next's data cache: one shared store, keyed by the key parts and the arguments.
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...args: never[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      if (mocks.store.has(key)) return mocks.store.get(key);
      const value = await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
      mocks.store.set(key, value);
      return value;
    },
}));

vi.mock("../server/webSearch", () => ({
  PROMPT_VERSION: "test",
  searchDeals: mocks.searchDeals,
}));

import { dealsForCell } from "../server/cached";

const result = (area: string): WebSearchResult => ({ area, searchedAt: "2026-10-16T14:00:00.000Z", deals: [] });
const CELL = { lat: 2673, lon: 2004 };

beforeEach(() => {
  mocks.store.clear();
  mocks.searchDeals.mockReset();
});

describe("dealsForCell", () => {
  it("runs the guard and the search once, then serves the cached result without either", async () => {
    mocks.searchDeals.mockResolvedValue(result("Brampton"));
    const guard = vi.fn();

    expect(await dealsForCell(CELL, guard)).toEqual(result("Brampton"));
    expect(await dealsForCell(CELL, guard)).toEqual(result("Brampton"));

    expect(guard).toHaveBeenCalledTimes(1);
    expect(mocks.searchDeals).toHaveBeenCalledTimes(1);
    expect(mocks.searchDeals).toHaveBeenCalledWith(CELL);
  });

  it("shares one search between visitors who ask at the same moment", async () => {
    let finish: (value: WebSearchResult) => void = () => {};
    mocks.searchDeals.mockReturnValue(new Promise<WebSearchResult>((resolve) => (finish = resolve)));
    const guard = vi.fn();

    const first = dealsForCell(CELL, guard);
    const second = dealsForCell(CELL, guard);
    finish(result("Brampton"));

    expect(await first).toEqual(result("Brampton"));
    expect(await second).toEqual(result("Brampton"));
    expect(mocks.searchDeals).toHaveBeenCalledTimes(1);
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it("does not search, or cache anything, when the guard turns the visitor away", async () => {
    const turnedAway = new Error("rate limited");
    await expect(
      dealsForCell(CELL, () => {
        throw turnedAway;
      }),
    ).rejects.toBe(turnedAway);
    expect(mocks.searchDeals).not.toHaveBeenCalled();

    mocks.searchDeals.mockResolvedValue(result("Brampton"));
    expect(await dealsForCell(CELL, () => {})).toEqual(result("Brampton"));
    expect(mocks.searchDeals).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed search, so the next visitor tries again", async () => {
    mocks.searchDeals.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(result("Brampton"));

    await expect(dealsForCell(CELL, () => {})).rejects.toThrow("down");
    expect(await dealsForCell(CELL, () => {})).toEqual(result("Brampton"));
    expect(mocks.searchDeals).toHaveBeenCalledTimes(2);
  });

  it("searches each grid cell separately", async () => {
    mocks.searchDeals.mockImplementation(async (cell: { lat: number }) => result(`cell ${cell.lat}`));

    expect((await dealsForCell({ lat: 1, lon: 1 }, () => {})).area).toBe("cell 1");
    expect((await dealsForCell({ lat: 2, lon: 1 }, () => {})).area).toBe("cell 2");
    expect(mocks.searchDeals).toHaveBeenCalledTimes(2);
  });
});
