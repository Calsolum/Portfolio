/**
 * A sliding-window limiter held in memory. It is per server instance, so it is
 * a brake on a runaway client rather than a hard guarantee.
 */

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export interface Limiter {
  take(key: string): LimitResult;
}

export function createLimiter(options: {
  max: number;
  windowMs: number;
  now?: () => number;
  /** Oldest keys are forgotten beyond this many, so memory stays bounded. */
  maxKeys?: number;
}): Limiter {
  const { max, windowMs, now = Date.now, maxKeys = 2000 } = options;
  const hits = new Map<string, number[]>();

  return {
    take(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)) };
      }

      recent.push(t);
      // Re-insert so the Map stays ordered by last use.
      hits.delete(key);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next();
        if (!oldest.done) hits.delete(oldest.value);
      }
      return { ok: true };
    },
  };
}
