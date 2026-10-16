import { unstable_cache } from "next/cache";

import { cellId, parseCellId, type Cell } from "../lib/geo";
import type { WebSearchResult } from "../types";
import { PROMPT_VERSION, searchDeals } from "./webSearch";

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/** Searches running right now on this instance, so two visitors asking at once share one. */
const inflight = new Map<string, Promise<WebSearchResult>>();

/**
 * One search per grid cell per week, shared by everyone. A search returns
 * deals for every day of the week, so the day the visitor picks does not
 * matter. An empty result is cached too (the area really has none); an error is
 * not, because the cache only stores what the function returns.
 *
 * `beforeFreshSearch` runs only when nothing is cached, which is the one moment
 * money is about to be spent. Rate limits hang off it, so visitors reading
 * cached results are never turned away. Throwing from it cancels the search.
 *
 * This is Next.js's previous caching model (unstable_cache), because the site
 * does not use Cache Components. Moving to `use cache` means turning that on
 * site-wide.
 */
export function dealsForCell(cell: Cell, beforeFreshSearch: () => void): Promise<WebSearchResult> {
  const id = cellId(cell);
  const running = inflight.get(id);
  if (running) return running;

  const cached = unstable_cache(
    async (cellKey: string) => {
      const target = parseCellId(cellKey);
      if (!target) throw new Error("bad cell");
      beforeFreshSearch();
      return searchDeals(target);
    },
    ["deals-web", PROMPT_VERSION],
    { revalidate: WEEK_SECONDS, tags: ["deals-web"] },
  );

  const promise = cached(id).finally(() => inflight.delete(id));
  inflight.set(id, promise);
  return promise;
}
