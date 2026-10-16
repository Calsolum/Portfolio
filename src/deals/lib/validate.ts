import { WEEKDAYS, type WebDeal, type WebSearchResult, type Weekday } from "../types";
import { isWeekday } from "./days";
import { normalizeName } from "./match";
import { safeHttpUrl, urlKey } from "./url";

/**
 * Everything Claude reports passes through here before it is cached or shown.
 * The model can be wrong or be steered by a web page, so the rule is: keep only
 * what is well formed, and keep a link only if the search really returned it.
 */

export const MAX_WEB_DEALS = 40;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Zero-width and control characters removed, whitespace collapsed, length capped. */
export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value
    .replace(/[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Valid weekdays only, each once, Monday first. */
export function uniqueDays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  const given = value.filter(isWeekday);
  return WEEKDAYS.filter((day) => given.includes(day));
}

/** URLs the search and fetch tools returned in a response, plus the ones its citations point at. */
export function collectSeenUrls(blocks: readonly unknown[]): string[] {
  const urls: string[] = [];
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        if (isRecord(result) && typeof result.url === "string") urls.push(result.url);
      }
    } else if (block.type === "web_fetch_tool_result" && isRecord(block.content)) {
      if (typeof block.content.url === "string") urls.push(block.content.url);
    } else if (block.type === "text" && Array.isArray(block.citations)) {
      for (const citation of block.citations) {
        if (isRecord(citation) && typeof citation.url === "string") urls.push(citation.url);
      }
    }
  }
  return urls;
}

/** Comparison key to the URL as the search returned it. */
export type SeenUrls = Map<string, string>;

export function indexSeenUrls(urls: Iterable<string>): SeenUrls {
  const seen: SeenUrls = new Map();
  for (const raw of urls) {
    const safe = safeHttpUrl(raw);
    const key = safe ? urlKey(safe) : undefined;
    if (safe && key && !seen.has(key)) seen.set(key, safe);
  }
  return seen;
}

/**
 * The page the model cited, as the search returned it, or undefined when the
 * search never returned it. There is deliberately no fallback to a page on the
 * same site: on a site like Facebook that would link one venue to another.
 */
export function resolveSourceUrl(raw: unknown, seen: SeenUrls): string | undefined {
  const key = typeof raw === "string" ? urlKey(raw) : undefined;
  return key ? seen.get(key) : undefined;
}

/** One deal in the shape the browser receives, or null if anything essential is missing. */
function parseWebDeal(row: unknown): WebDeal | null {
  if (!isRecord(row)) return null;
  const place = cleanText(row.place, 80);
  const title = cleanText(row.title, 100);
  const details = cleanText(row.details, 400);
  const sourceUrl = safeHttpUrl(row.sourceUrl);
  const days = uniqueDays(row.days);
  if (!place || !title || !details || !sourceUrl || days.length === 0) return null;

  return {
    place,
    title,
    details,
    days,
    sourceUrl,
    chain: row.chain === true,
    address: cleanText(row.address, 120),
    hours: cleanText(row.hours, 60),
    price: cleanText(row.price, 60),
  };
}

/** The input of the report_deals tool, reduced to deals that are well formed and properly sourced. */
export function sanitizeWebDeals(input: unknown, seen: SeenUrls): WebDeal[] {
  const rows = isRecord(input) ? input.deals : undefined;
  if (!Array.isArray(rows)) return [];

  const deals: WebDeal[] = [];
  const known = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const deal = parseWebDeal({ ...row, sourceUrl: resolveSourceUrl(row.source_url, seen) });
    if (!deal) continue;

    const key = `${normalizeName(deal.place)}|${normalizeName(deal.title)}|${deal.days.join(",")}`;
    if (known.has(key)) continue;
    known.add(key);
    deals.push(deal);
    if (deals.length >= MAX_WEB_DEALS) break;
  }
  return deals;
}

/** A search result from the API or from localStorage, checked again before it is trusted. */
export function parseWebResult(raw: unknown): WebSearchResult | null {
  if (!isRecord(raw) || !Array.isArray(raw.deals)) return null;
  const area = cleanText(raw.area, 120);
  const searchedAt = typeof raw.searchedAt === "string" ? raw.searchedAt : "";
  if (!area || !Number.isFinite(Date.parse(searchedAt))) return null;

  const deals = raw.deals.map(parseWebDeal).filter((deal): deal is WebDeal => deal !== null);
  return { area, searchedAt, deals };
}
