import { describe, expect, it } from "vitest";

import { createLimiter } from "../server/limits";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => void (now += ms) };
}

describe("createLimiter", () => {
  it("allows up to max hits inside the window, then refuses with a retry time", () => {
    const time = clock();
    const limiter = createLimiter({ max: 3, windowMs: 60_000, now: time.now });
    expect(limiter.take("a")).toEqual({ ok: true });
    time.advance(10_000);
    expect(limiter.take("a")).toEqual({ ok: true });
    time.advance(10_000);
    expect(limiter.take("a")).toEqual({ ok: true });
    time.advance(10_000);
    // The first hit was 30 s ago, so it frees up in 30 s.
    expect(limiter.take("a")).toEqual({ ok: false, retryAfterSec: 30 });
  });

  it("lets hits through again once the window has slid past them", () => {
    const time = clock();
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: time.now });
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(false);
    time.advance(1001);
    expect(limiter.take("a").ok).toBe(true);
  });

  it("does not count refused attempts against the caller", () => {
    const time = clock();
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: time.now });
    limiter.take("a");
    for (let i = 0; i < 5; i += 1) limiter.take("a");
    time.advance(1001);
    expect(limiter.take("a").ok).toBe(true);
  });

  it("keeps keys apart", () => {
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: clock().now });
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("b").ok).toBe(true);
    expect(limiter.take("a").ok).toBe(false);
  });

  it("always reports a retry time of at least a second", () => {
    const time = clock();
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: time.now });
    limiter.take("a");
    time.advance(999);
    expect(limiter.take("a")).toEqual({ ok: false, retryAfterSec: 1 });
  });

  it("forgets the oldest keys beyond maxKeys, so memory stays bounded", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000, now: clock().now, maxKeys: 2 });
    limiter.take("a");
    limiter.take("b");
    limiter.take("c");
    // "a" was forgotten, so it gets a fresh allowance; "c" is still remembered.
    expect(limiter.take("a").ok).toBe(true);
    expect(limiter.take("c").ok).toBe(false);
  });
});
