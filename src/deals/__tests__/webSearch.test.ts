import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cellOf } from "../lib/geo";
import {
  MODEL,
  SearchUnavailableError,
  buildUserPrompt,
  estimateCostUsd,
  searchDeals,
  type SearchFailure,
} from "../server/webSearch";
import { WEEKDAYS } from "../types";

const CELL = cellOf({ lat: 43.6858, lon: -79.7599 });
const NOW = new Date("2026-10-16T14:00:00.000Z");

const USAGE = {
  input_tokens: 1000,
  output_tokens: 500,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  server_tool_use: { web_search_requests: 3, web_fetch_requests: 1 },
};

const searchResults = {
  type: "web_search_tool_result",
  tool_use_id: "srvtoolu_1",
  content: [
    { type: "web_search_result", url: "https://www.wildwingrestaurants.com/specials/", title: "Specials", encrypted_content: "x", page_age: null },
  ],
};

const dealFrom = (fields: Record<string, unknown> = {}) => ({
  place: "Wild Wing",
  address: "",
  title: "Single orders",
  details: "Wings with fries and a dip.",
  days: ["tue"],
  hours: "",
  price: "$12",
  source_url: "https://wildwingrestaurants.com/specials",
  chain: true,
  ...fields,
});

const report = (deals: unknown[]) => ({ type: "tool_use", id: "toolu_1", name: "report_deals", input: { deals } });

const reply = (content: unknown[], stop_reason = "tool_use") => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: MODEL,
  content,
  stop_reason,
  usage: USAGE,
});

/* eslint-disable @typescript-eslint/no-explicit-any -- the fake client records whatever request body it is given */
/** A client whose n-th request plays the n-th step (the last step repeats). */
function fakeClient(...steps: unknown[]) {
  const requests: Array<{ body: Record<string, any>; options: unknown }> = [];
  const client = {
    beta: {
      messages: {
        stream: (body: Record<string, any>, options: unknown) => {
          requests.push({ body: structuredClone(body), options });
          const step = steps[Math.min(requests.length - 1, steps.length - 1)];
          return {
            finalMessage: async () => {
              if (step instanceof Error) throw step;
              return step;
            },
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const nominatim = (status = 200): typeof fetch =>
  (async () =>
    new Response(
      JSON.stringify({
        display_name: "Downtown Brampton, Brampton, Peel Region, Ontario, Canada",
        address: {
          suburb: "Downtown Brampton",
          city: "Brampton",
          state: "Ontario",
          country: "Canada",
          country_code: "ca",
        },
      }),
      { status },
    )) as typeof fetch;

/** An SDK error of the right class without having to build a real response. */
const sdkError = <T extends object>(ErrorClass: { prototype: T }, status: number, message: string) =>
  Object.assign(Object.create(ErrorClass.prototype), { status, message }) as Error;

const run = (client: Anthropic, fetchImpl: typeof fetch = nominatim()) =>
  searchDeals(CELL, { client, fetchImpl, now: () => NOW });

const failureOf = async (promise: Promise<unknown>): Promise<SearchFailure | undefined> => {
  try {
    await promise;
  } catch (err) {
    return err instanceof SearchUnavailableError ? err.code : undefined;
  }
  return undefined;
};

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("searchDeals: the request", () => {
  it("asks Opus 5.5 to search and fetch, then report through a strict tool, with fallbacks on", async () => {
    const { client, requests } = fakeClient(reply([searchResults, report([dealFrom()])]));
    await run(client);

    const { body, options } = requests[0];
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(body.betas).toContain("server-side-fallback-2026-07-01");
    expect(body.output_config).toEqual({ effort: "medium" });
    // Opus 5.5 rejects both a forced tool_choice and any explicit thinking setting.
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("thinking");
    expect(options).toHaveProperty("signal");

    const [search, fetchTool, reportTool] = body.tools;
    expect(search).toMatchObject({
      type: "web_search_20260318",
      name: "web_search",
      max_uses: 6,
      user_location: { type: "approximate", city: "Brampton", region: "Ontario", country: "CA" },
    });
    // The nested results must stay in the response; they are how links get checked.
    expect(search).not.toHaveProperty("response_inclusion");
    expect(fetchTool).toMatchObject({ type: "web_fetch_20260318", name: "web_fetch", max_uses: 3 });
    expect(reportTool).toMatchObject({ name: "report_deals", strict: true });
  });

  it("gives the report tool a closed schema that only allows real weekdays", async () => {
    const { client, requests } = fakeClient(reply([report([])]));
    await run(client);

    const schema = requests[0].body.tools[2].input_schema;
    expect(schema.additionalProperties).toBe(false);
    const item = schema.properties.deals.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.properties.days.items.enum).toEqual([...WEEKDAYS]);
  });

  it("describes the area, the radius and the date in the prompt", async () => {
    const { client, requests } = fakeClient(reply([report([])]));
    await run(client);

    const prompt = requests[0].body.messages[0];
    expect(prompt.role).toBe("user");
    expect(prompt.content).toContain("Downtown Brampton, Brampton, Ontario, Canada");
    expect(prompt.content).toContain("5 km");
    expect(prompt.content).toContain("2026-10-16");
  });

  it("builds the prompt from the area, centre and date", () => {
    const text = buildUserPrompt(
      { label: "Brampton, Ontario", countryName: "Canada" },
      { lat: 43.675, lon: -79.775 },
      NOW,
    );
    expect(text).toBe(
      [
        "Area: Brampton, Ontario, Canada.",
        "Cover roughly a 5 km radius around latitude 43.675, longitude -79.775.",
        "Today is 2026-10-16.",
        "Find recurring weekday food specials in this area.",
      ].join("\n"),
    );
  });
});

describe("searchDeals: the result", () => {
  it("keeps deals whose source the search returned and drops the rest", async () => {
    const { client } = fakeClient(
      reply([
        searchResults,
        report([dealFrom(), dealFrom({ place: "Invented Pub", source_url: "https://invented.example/specials" })]),
      ]),
    );
    const result = await run(client);

    expect(result.area).toBe("Downtown Brampton, Brampton, Ontario");
    expect(result.searchedAt).toBe("2026-10-16T14:00:00.000Z");
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0]).toMatchObject({
      place: "Wild Wing",
      days: ["tue"],
      sourceUrl: "https://www.wildwingrestaurants.com/specials/",
    });
  });

  it("accepts a source that only a fetch or a citation returned", async () => {
    const fetched = {
      type: "web_fetch_tool_result",
      tool_use_id: "srvtoolu_2",
      content: { type: "web_fetch_result", url: "https://tracks.example/specials", retrieved_at: null },
    };
    const cited = { type: "text", text: "x", citations: [{ type: "web_search_result_location", url: "https://cited.example/page" }] };
    const { client } = fakeClient(
      reply([
        fetched,
        cited,
        report([
          dealFrom({ place: "Tracks", source_url: "https://tracks.example/specials" }),
          dealFrom({ place: "Cited Pub", source_url: "https://cited.example/page" }),
        ]),
      ]),
    );
    expect((await run(client)).deals.map((deal) => deal.place)).toEqual(["Tracks", "Cited Pub"]);
  });

  it("resumes a paused turn with the paused content and counts every request", async () => {
    const { client, requests } = fakeClient(
      reply([searchResults], "pause_turn"),
      reply([report([dealFrom()])]),
    );
    const result = await run(client);

    expect(requests).toHaveLength(2);
    const second = requests[1].body.messages;
    expect(second).toHaveLength(2);
    expect(second[1]).toEqual({ role: "assistant", content: [searchResults] });
    // The link was returned during the first, paused request but cited in the second.
    expect(result.deals).toHaveLength(1);

    const logged = JSON.parse(String(vi.mocked(console.info).mock.calls[0][1]));
    expect(logged).toMatchObject({ turns: 2, searches: 6, fetches: 2, inputTokens: 2000, dealsKept: 1 });
  });

  it("logs a cost estimate", async () => {
    const { client } = fakeClient(reply([searchResults, report([dealFrom()])]));
    await run(client);
    const logged = JSON.parse(String(vi.mocked(console.info).mock.calls[0][1]));
    // 1,000 in at $4/M + 500 out at $20/M + 3 searches at $0.01
    expect(logged.estimatedUsd).toBeCloseTo(0.044, 3);
  });

  it("returns an empty list, not an error, when the model reports nothing", async () => {
    const { client } = fakeClient(reply([report([])]));
    expect((await run(client)).deals).toEqual([]);
  });
});

describe("searchDeals: recovering", () => {
  it("retries without a location when the API rejects the country", async () => {
    const rejected = sdkError(Anthropic.BadRequestError, 400, "user_location.country: unsupported country code");
    const { client, requests } = fakeClient(rejected, reply([searchResults, report([dealFrom()])]));
    const result = await run(client);

    expect(requests).toHaveLength(2);
    expect(requests[0].body.tools[0]).toHaveProperty("user_location");
    expect(requests[1].body.tools[0]).not.toHaveProperty("user_location");
    expect(result.deals).toHaveLength(1);
  });

  it("does not retry for other bad requests", async () => {
    const { client, requests } = fakeClient(sdkError(Anthropic.BadRequestError, 400, "Your credit balance is too low"));
    expect(await failureOf(run(client))).toBe("unavailable");
    expect(requests).toHaveLength(1);
  });
});

describe("searchDeals: failing cleanly", () => {
  it("fails with no_report when the model never calls the report tool", async () => {
    const { client } = fakeClient(reply([{ type: "text", text: "I found nothing." }], "end_turn"));
    expect(await failureOf(run(client))).toBe("no_report");
  });

  it("fails with declined on a refusal and truncated on max_tokens", async () => {
    expect(await failureOf(run(fakeClient(reply([], "refusal")).client))).toBe("declined");
    expect(await failureOf(run(fakeClient(reply([report([dealFrom()])], "max_tokens")).client))).toBe("truncated");
  });

  it("maps API errors to failures a visitor can be told about", async () => {
    const cases: Array<[Error, SearchFailure]> = [
      [sdkError(Anthropic.AuthenticationError, 401, "invalid x-api-key"), "not_configured"],
      [sdkError(Anthropic.PermissionDeniedError, 403, "forbidden"), "not_configured"],
      [sdkError(Anthropic.RateLimitError, 429, "slow down"), "busy"],
      [sdkError(Anthropic.InternalServerError, 500, "boom"), "unavailable"],
      [Object.assign(new Error("The operation timed out"), { name: "TimeoutError" }), "timeout"],
      [new Error("socket hang up"), "unavailable"],
    ];
    for (const [error, code] of cases) {
      expect(await failureOf(run(fakeClient(error).client)), error.message).toBe(code);
    }
  });

  it("gives up after resuming a paused turn a few times", async () => {
    const { client, requests } = fakeClient(reply([searchResults], "pause_turn"));
    expect(await failureOf(run(client))).toBe("timeout");
    expect(requests).toHaveLength(4);
  });

  it("fails with area, without spending anything, when the area cannot be named", async () => {
    const { client, requests } = fakeClient(reply([report([])]));
    expect(await failureOf(run(client, nominatim(500)))).toBe("area");
    expect(requests).toHaveLength(0);
  });
});

describe("estimateCostUsd", () => {
  it("prices tokens per million and searches at a cent each", () => {
    const base = { turns: 1, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, fetches: 0 };
    expect(estimateCostUsd({ ...base, input: 1_000_000 })).toBeCloseTo(4, 6);
    expect(estimateCostUsd({ ...base, output: 1_000_000 })).toBeCloseTo(20, 6);
    expect(estimateCostUsd({ ...base, searches: 100 })).toBeCloseTo(1, 6);
  });
});
