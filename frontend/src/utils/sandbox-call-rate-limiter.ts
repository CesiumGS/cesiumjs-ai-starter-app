/**
 * Client-side call rate limiter for sandboxed `executeCesiumCode` invocations. Independent of
 * `@cesium-ai/codegen-sandbox` (which never calls this itself — see that package's
 * `runCesiumCodeInSandbox`): it has no dependency on `cesium`/`quickjs-emscripten`, and only this
 * app's `ChatPanel` calls it, immediately before running a verified snippet through the sandbox.
 * Defense-in-depth against a runaway/adversarial model calling the sandbox too often — independent
 * of whether any individual generated snippet is itself safe.
 */

/** Default rate limit applied to sandboxed `executeCesiumCode` invocations. */
export const DEFAULT_RATE_LIMIT: RateLimiterOptions = { maxCalls: 10, windowMs: 60_000 };

export interface RateLimiterOptions {
  /** Max calls allowed within `windowMs`. */
  maxCalls: number;
  /** Sliding window length, in milliseconds. */
  windowMs: number;
}

/** Thrown by {@link SandboxCallRateLimiter.checkAndRecord} when over budget. */
export class RateLimitExceededError extends Error {
  constructor(maxCalls: number, windowMs: number) {
    super(
      `Rate limit of ${maxCalls} sandbox executions per ${windowMs}ms exceeded. Try again shortly.`,
    );
    this.name = "RateLimitExceededError";
  }
}

/**
 * Simple sliding-window call rate limiter, framework-free. Kept as a class
 * (rather than a module-level singleton) so a caller — e.g. `ChatPanel` — can
 * own one instance per mounted component/session, and so tests can construct
 * a fresh instance per case and drive it with fake timers.
 *
 * Implementation: a plain array of call timestamps, pruned to the current
 * window on every call. Fine for the call volumes this guard is meant for
 * (a handful of sandboxed executions per minute); no need for a token bucket
 * or anything fancier.
 */
export class SandboxCallRateLimiter {
  private readonly maxCalls: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];

  constructor(options: RateLimiterOptions) {
    this.maxCalls = options.maxCalls;
    this.windowMs = options.windowMs;
  }

  /**
   * Prunes timestamps outside the current window, then either throws
   * {@link RateLimitExceededError} (if `maxCalls` was already reached within
   * the window) or records `now` as a new call and returns.
   */
  checkAndRecord(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.timestamps = this.timestamps.filter((ts) => ts > windowStart);

    if (this.timestamps.length >= this.maxCalls) {
      throw new RateLimitExceededError(this.maxCalls, this.windowMs);
    }

    this.timestamps.push(now);
  }
}
