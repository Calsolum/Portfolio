import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Cell } from "../lib/geo";
import { handleWebDealsRequest, type HandlerDeps } from "../server/handler";
import { createLimiter } from "../server/limits";
import { SearchUnavailableError, type SearchFailure } from "../server/webSearch";
import type { WebSearchResult } from "../types";

const RESULT: WebSearchResult = {
  area: "Downtown Brampton, Brampton, Ontario",
  searchedAt: "2026-10-16T14:00:00.000Z",
  deals: [
    {
      place: "Wild Wing",
      title: "Single orders",
      details: "Wings with fries and a dip.",
      days: ["tue"],
      sourceUrl: "https://www.wildwingrestaurants.com/specials/",
      chain: true,
    },
  ],
};

const get = (query = "cell=2673:2004", headers: Record<string, string> = {}) =>
  new Request(`https://example.com/api/deals/web?${query}`, { headers });

/** Deps whose search is the given function, with the real guard callback passed through. */
function deps(
  search: (cell: Cell, guard: () => void) => Promise<WebSearchResult> = async (_cell, guard) => {
    guard();
    return RESULT;
  },
  overrides: Partial<HandlerDeps> = {},
): HandlerDeps & { dealsForCell: ReturnType<typeof vi.fn> } {
  return {
    dealsForCell: vi.fn(search),
    limiters: { perVisitor: createLimiter({ max: 2, windowMs: 60_000 }), overall: createLimiter({ max: 50, windowMs: 60_000 }) },
    hasApiKey: true,
    ...overrides,
  } as HandlerDeps & { dealsForCell: ReturnType<typeof vi.fn> };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("handleWebDealsRequest: refusing early", () => {
  it("refuses requests that another site triggered, and allows the page itself", async () => {
    for (const site of ["cross-site", "same-site"]) {
      const d = deps();
      const res = await handleWebDealsRequest(get("cell=2673:2004", { "sec-fetch-site": site }), d);
      expect(res.status).toBe(403);
      expect(d.dealsForCell).not.toHaveBeenCalled();
    }
    for (const site of ["same-origin", "none"]) {
      const res = await handleWebDealsRequest(get("cell=2673:2004", { "sec-fetch-site": site }), deps());
      expect(res.status).toBe(200);
    }
    // curl and other non-browser clients send no header at all.
    expect((await handleWebDealsRequest(get(), deps())).status).toBe(200);
  });

  it("returns 400 for a missing or malformed cell, without searching", async () => {
    for (const query of ["", "cell=", "cell=abc", "cell=1:2:3", "cell=99999:1", "cell=-1:2", "area=Brampton"]) {
      const d = deps();
      const res = await handleWebDealsRequest(get(query), d);
      expect(res.status, query).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe("bad_cell");
      expect(d.dealsForCell).not.toHaveBeenCalled();
    }
  });

  it("returns 503 not_configured, without searching, when there is no API key", async () => {
    const d = deps(undefined, { hasApiKey: false });
    const res = await handleWebDealsRequest(get(), d);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("not_configured");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(d.dealsForCell).not.toHaveBeenCalled();
  });
});

describe("handleWebDealsRequest: the status question", () => {
  it("says whether web search is switched on, briefly cacheable, without searching or counting a limit", async () => {
    for (const hasApiKey of [true, false]) {
      const d = deps(undefined, { hasApiKey });
      const res = await handleWebDealsRequest(get("status=1"), d);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ webSearch: hasApiKey });
      expect(res.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
      expect(d.dealsForCell).not.toHaveBeenCalled();
    }
  });

  it("is refused for another site, like the search itself", async () => {
    const res = await handleWebDealsRequest(get("status=1", { "sec-fetch-site": "cross-site" }), deps());
    expect(res.status).toBe(403);
  });
});

describe("handleWebDealsRequest: a search", () => {
  it("returns the result with edge-cache headers, and passes the parsed cell on", async () => {
    const d = deps();
    const res = await handleWebDealsRequest(get("cell=2673:2004"), d);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(d.dealsForCell.mock.calls[0][0]).toEqual({ lat: 2673, lon: 2004 });
  });

  it("limits each visitor, by the address the platform reports, and says when to retry", async () => {
    const d = deps();
    const ask = (headers: Record<string, string>) => handleWebDealsRequest(get("cell=2673:2004", headers), d);

    expect((await ask({ "x-real-ip": "203.0.113.5" })).status).toBe(200);
    expect((await ask({ "x-real-ip": "203.0.113.5" })).status).toBe(200);
    const refused = await ask({ "x-real-ip": "203.0.113.5" });
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(((await refused.json()) as { error: string }).error).toBe("rate_limited");

    // Someone else is unaffected, and so is a forwarded-for address.
    expect((await ask({ "x-real-ip": "203.0.113.6" })).status).toBe(200);
    expect((await ask({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" })).status).toBe(200);
  });

  it("reads the request headers before the cached search starts, never inside it", async () => {
    // Next.js throws if request.headers is read inside an unstable_cache scope, which a
    // fake search cannot reproduce, so this watches for the read directly.
    const request = get("cell=2673:2004", { "x-real-ip": "203.0.113.9" });
    const headers = request.headers;
    let insideCache = false;
    let readInside = false;
    Object.defineProperty(request, "headers", {
      get() {
        if (insideCache) readInside = true;
        return headers;
      },
    });

    const d = deps(async (_cell, guard) => {
      insideCache = true;
      guard();
      insideCache = false;
      return RESULT;
    });
    expect((await handleWebDealsRequest(request, d)).status).toBe(200);
    expect(readInside).toBe(false);
  });

  it("limits the whole site as well", async () => {
    const d = deps(undefined, {
      limiters: { perVisitor: createLimiter({ max: 99, windowMs: 60_000 }), overall: createLimiter({ max: 1, windowMs: 60_000 }) },
    });
    expect((await handleWebDealsRequest(get(), d)).status).toBe(200);
    expect((await handleWebDealsRequest(get(), d)).status).toBe(429);
  });

  it("maps each search failure to a status and a message a visitor can read", async () => {
    const expected: Record<SearchFailure, number> = {
      not_configured: 503,
      area: 502,
      busy: 503,
      declined: 502,
      truncated: 502,
      no_report: 502,
      timeout: 504,
      unavailable: 503,
    };
    for (const [code, status] of Object.entries(expected) as Array<[SearchFailure, number]>) {
      const res = await handleWebDealsRequest(
        get(),
        deps(async () => {
          throw new SearchUnavailableError(code, "internal detail that must not leak");
        }),
      );
      const body = (await res.json()) as { error: string; message: string };
      expect(res.status, code).toBe(status);
      expect(body.error, code).toBe(code);
      expect(body.message, code).not.toMatch(/internal detail/);
      expect(body.message.length, code).toBeGreaterThan(10);
      expect(res.headers.get("cache-control"), code).toBe("no-store");
    }
  });

  it("treats an unexpected error as unavailable and logs it", async () => {
    const res = await handleWebDealsRequest(
      get(),
      deps(async () => {
        throw new Error("something odd");
      }),
    );
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe("unavailable");
    expect(console.error).toHaveBeenCalled();
  });
});
