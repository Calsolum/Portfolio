import { parseCellId, type Cell } from "../lib/geo";
import type { WebSearchResult } from "../types";
import { dealsForCell as defaultDealsForCell } from "./cached";
import { RateLimitedError, createLimiter, type Limiter } from "./limits";
import { SearchUnavailableError, type SearchFailure } from "./webSearch";

/**
 * The HTTP side of GET /api/deals/web, kept apart from the route file so it can
 * be tested. The route is a one-line wrapper.
 */

const FAILURES: Record<SearchFailure, { status: number; message: string }> = {
  not_configured: { status: 503, message: "Web search is not switched on for this site yet." },
  area: { status: 502, message: "Could not work out which area that is. Try again in a moment." },
  busy: { status: 503, message: "Web search is busy right now. Try again in a few minutes." },
  declined: { status: 502, message: "The search could not be completed for this area. Try again later." },
  truncated: { status: 502, message: "The search ran long and was cut off. Try again." },
  no_report: { status: 502, message: "The search finished without a usable answer. Try again." },
  timeout: { status: 504, message: "The search took too long. Try again in a few minutes." },
  unavailable: { status: 503, message: "Web search is paused right now. Try again later." },
};

/** Per instance, so a brake on a runaway client; the hard stop is the workspace spend limit. */
const defaultLimiters = {
  perVisitor: createLimiter({ max: 5, windowMs: 10 * 60_000 }),
  overall: createLimiter({ max: 20, windowMs: 60 * 60_000 }),
};

export interface HandlerDeps {
  dealsForCell?: (cell: Cell, beforeFreshSearch: () => void) => Promise<WebSearchResult>;
  limiters?: { perVisitor: Limiter; overall: Limiter };
  hasApiKey?: boolean;
}

const NO_STORE = { "Cache-Control": "no-store" };

function problem(status: number, error: string, message: string, headers: HeadersInit = {}): Response {
  return Response.json({ error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Vercel sets x-real-ip and x-forwarded-for itself, so a visitor cannot choose their own. */
function visitorKey(request: Request): string {
  return (
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

export async function handleWebDealsRequest(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const dealsForCell = deps.dealsForCell ?? defaultDealsForCell;
  const limiters = deps.limiters ?? defaultLimiters;
  const hasApiKey = deps.hasApiKey ?? Boolean(process.env.ANTHROPIC_API_KEY);

  // Browsers say where a request came from. Another site using visitors to spend this site's budget is refused.
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") {
    return problem(403, "forbidden", "This endpoint is only for the Daily Deals page.");
  }

  const params = new URL(request.url).searchParams;

  // The page asks once whether web search is switched on, so it can leave the button out when it is not.
  if (params.has("status")) {
    return Response.json(
      { webSearch: hasApiKey },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }

  const cell = parseCellId(params.get("cell"));
  if (!cell) return problem(400, "bad_cell", "That is not a valid search area.");

  if (!hasApiKey) return problem(503, "not_configured", FAILURES.not_configured.message);

  // Next.js refuses request.headers inside the cached search, so the address is read here, first.
  const visitor = visitorKey(request);

  try {
    const result = await dealsForCell(cell, () => {
      for (const [limiter, key] of [
        [limiters.perVisitor, visitor],
        [limiters.overall, "all"],
      ] as const) {
        const outcome = limiter.take(key);
        if (!outcome.ok) throw new RateLimitedError(outcome.retryAfterSec);
      }
    });
    return Response.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return problem(
        429,
        "rate_limited",
        "Too many new searches just now. Try again in a few minutes.",
        { "Retry-After": String(err.retryAfterSec) },
      );
    }
    if (err instanceof SearchUnavailableError) {
      const { status, message } = FAILURES[err.code];
      return problem(status, err.code, message);
    }
    console.error("[deals-web] unexpected error", err);
    return problem(FAILURES.unavailable.status, "unavailable", FAILURES.unavailable.message);
  }
}
