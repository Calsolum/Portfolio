/**
 * The limiter moved to src/lib/limits.ts so other pages can use it. It is
 * re-exported here so Deals keeps importing from "./limits". The in-memory
 * limits are only a brake; the hard stop on spending is the monthly limit set
 * on the Anthropic workspace.
 */
export { createLimiter, type LimitResult, type Limiter } from "../../lib/limits";

/** Thrown from inside a search that a limiter has turned away. */
export class RateLimitedError extends Error {
  constructor(readonly retryAfterSec: number) {
    super("rate limited");
    this.name = "RateLimitedError";
  }
}
