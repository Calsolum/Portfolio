import { describe, expect, it } from "vitest";

import {
  MAX_WEB_DEALS,
  cleanText,
  collectSeenUrls,
  indexSeenUrls,
  parseWebResult,
  resolveSourceUrl,
  sanitizeWebDeals,
  uniqueDays,
} from "../lib/validate";

const SEEN = indexSeenUrls([
  "https://www.wildwing.ca/specials",
  "https://example.com/pubs/keenan#menu",
  "https://example.com/blog/best-wing-nights?utm_source=newsletter",
]);

const rawDeal = (fields: Record<string, unknown> = {}) => ({
  place: "Wild Wing",
  address: "",
  title: "Wing Wednesday",
  details: "Wings for less after 4 pm.",
  days: ["wed"],
  hours: "",
  price: "",
  source_url: "https://wildwing.ca/specials",
  chain: true,
  ...fields,
});

describe("cleanText", () => {
  it("removes zero-width and control characters and collapses whitespace", () => {
    expect(cleanText("  Wing​  night\u0007\n\tdeal  ", 100)).toBe("Wing night deal");
  });

  it("caps the length with an ellipsis", () => {
    const capped = cleanText("a".repeat(50), 10);
    expect(capped).toBe(`${"a".repeat(9)}…`);
    expect(capped).toHaveLength(10);
  });

  it("is undefined for empty or non-string input", () => {
    expect(cleanText("   ", 10)).toBeUndefined();
    expect(cleanText("​", 10)).toBeUndefined();
    expect(cleanText(42, 10)).toBeUndefined();
    expect(cleanText(null, 10)).toBeUndefined();
  });
});

describe("uniqueDays", () => {
  it("keeps valid days once each, in week order", () => {
    expect(uniqueDays(["fri", "mon", "fri", "funday", 3, "Wed"])).toEqual(["mon", "fri"]);
  });

  it("is empty for anything that is not a list", () => {
    expect(uniqueDays("mon")).toEqual([]);
    expect(uniqueDays(undefined)).toEqual([]);
  });
});

describe("collectSeenUrls", () => {
  it("collects search results, fetched pages and citations, and ignores everything else", () => {
    const urls = collectSeenUrls([
      { type: "text", text: "hello" },
      { type: "server_tool_use", name: "web_search", input: { query: "x" } },
      {
        type: "web_search_tool_result",
        content: [
          { type: "web_search_result", url: "https://a.example/one", title: "One" },
          { type: "web_search_result", url: "https://a.example/two", title: "Two" },
        ],
      },
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
      { type: "web_fetch_tool_result", content: { type: "web_fetch_result", url: "https://b.example/page" } },
      { type: "web_fetch_tool_result", content: { type: "web_fetch_tool_result_error", error_code: "url_not_accessible" } },
      { type: "text", text: "cited", citations: [{ type: "web_search_result_location", url: "https://c.example/cited" }] },
      { type: "tool_use", name: "report_deals", input: { deals: [{ source_url: "https://invented.example/" }] } },
      null,
      "junk",
    ]);
    expect(urls).toEqual([
      "https://a.example/one",
      "https://a.example/two",
      "https://b.example/page",
      "https://c.example/cited",
    ]);
  });
});

describe("resolveSourceUrl", () => {
  it("accepts a URL the search returned, tolerating www, a trailing slash, a fragment and tracking parameters", () => {
    expect(resolveSourceUrl("https://wildwing.ca/specials/", SEEN)).toBe("https://www.wildwing.ca/specials");
    expect(resolveSourceUrl("http://example.com/pubs/keenan", SEEN)).toBe("https://example.com/pubs/keenan");
    expect(resolveSourceUrl("https://example.com/blog/best-wing-nights", SEEN)).toBe(
      "https://example.com/blog/best-wing-nights?utm_source=newsletter",
    );
  });

  it("rejects a page the search never returned, even on a site it did return", () => {
    expect(resolveSourceUrl("https://wildwing.ca/invented-page", SEEN)).toBeUndefined();
    expect(resolveSourceUrl("https://invented.example/specials", SEEN)).toBeUndefined();
  });

  it("rejects unsafe or non-string input", () => {
    expect(resolveSourceUrl("javascript:alert(1)", SEEN)).toBeUndefined();
    expect(resolveSourceUrl(undefined, SEEN)).toBeUndefined();
    expect(resolveSourceUrl(7, SEEN)).toBeUndefined();
  });
});

describe("sanitizeWebDeals", () => {
  it("keeps a well-formed, properly sourced deal and drops empty optional fields", () => {
    const [deal, ...rest] = sanitizeWebDeals({ deals: [rawDeal()] }, SEEN);
    expect(rest).toHaveLength(0);
    expect(deal).toEqual({
      place: "Wild Wing",
      title: "Wing Wednesday",
      details: "Wings for less after 4 pm.",
      days: ["wed"],
      sourceUrl: "https://www.wildwing.ca/specials",
      chain: true,
      address: undefined,
      hours: undefined,
      price: undefined,
    });
  });

  it("keeps optional details when present", () => {
    const [deal] = sanitizeWebDeals(
      { deals: [rawDeal({ address: " 1 Main St ", hours: "4 pm to close", price: "$0.50 each" })] },
      SEEN,
    );
    expect(deal).toMatchObject({ address: "1 Main St", hours: "4 pm to close", price: "$0.50 each" });
  });

  it("drops deals whose source the search never returned", () => {
    expect(sanitizeWebDeals({ deals: [rawDeal({ source_url: "https://invented.example/x" })] }, SEEN)).toEqual([]);
  });

  it("drops deals with no valid weekday or a missing essential field", () => {
    const bad = [
      rawDeal({ days: [] }),
      rawDeal({ days: ["someday"] }),
      rawDeal({ place: "" }),
      rawDeal({ title: undefined }),
      rawDeal({ details: "   " }),
      "not an object",
      null,
    ];
    expect(sanitizeWebDeals({ deals: bad }, SEEN)).toEqual([]);
  });

  it("removes duplicates of the same venue, deal and days", () => {
    const deals = sanitizeWebDeals({ deals: [rawDeal(), rawDeal({ place: "WILD WING" }), rawDeal({ days: ["thu"] })] }, SEEN);
    expect(deals.map((deal) => deal.days)).toEqual([["wed"], ["thu"]]);
  });

  it("treats chain as true only for the boolean true", () => {
    const [deal] = sanitizeWebDeals({ deals: [rawDeal({ chain: "yes" })] }, SEEN);
    expect(deal.chain).toBe(false);
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_WEB_DEALS + 20 }, (_, i) => rawDeal({ title: `Deal ${i}` }));
    expect(sanitizeWebDeals({ deals: many }, SEEN)).toHaveLength(MAX_WEB_DEALS);
  });

  it("returns nothing for input that is not the expected shape", () => {
    for (const input of [null, undefined, "x", 3, {}, { deals: "nope" }, []]) {
      expect(sanitizeWebDeals(input, SEEN)).toEqual([]);
    }
  });
});

describe("parseWebResult", () => {
  const good = {
    area: "Downtown Brampton, Brampton, Ontario",
    searchedAt: "2026-10-16T14:00:00.000Z",
    deals: [
      {
        place: "Wild Wing",
        title: "Wing Wednesday",
        details: "Wings for less.",
        days: ["wed"],
        sourceUrl: "https://www.wildwing.ca/specials",
        chain: true,
      },
    ],
  };

  it("accepts a valid result", () => {
    expect(parseWebResult(good)).toMatchObject({ area: good.area, searchedAt: good.searchedAt });
    expect(parseWebResult(good)?.deals).toHaveLength(1);
  });

  it("drops individual deals that fail the checks again, such as one with an unsafe link", () => {
    const tampered = { ...good, deals: [...good.deals, { ...good.deals[0], sourceUrl: "javascript:alert(1)" }] };
    expect(parseWebResult(tampered)?.deals).toHaveLength(1);
  });

  it("rejects results with a missing area, a bad date or no deal list", () => {
    expect(parseWebResult({ ...good, area: "" })).toBeNull();
    expect(parseWebResult({ ...good, searchedAt: "yesterday" })).toBeNull();
    expect(parseWebResult({ ...good, deals: undefined })).toBeNull();
    expect(parseWebResult(null)).toBeNull();
    expect(parseWebResult("x")).toBeNull();
  });
});
