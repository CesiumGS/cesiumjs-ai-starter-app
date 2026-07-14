import type { Viewer } from "cesium";

/**
 * Client-side guards around sandboxed `executeCesiumCode` runs: an entity
 * count cap (bounds how much scene state a single session can accumulate) and
 * a call rate limiter (bounds how often the sandbox can be invoked at all).
 * These are defense-in-depth guardrails around LLM-generated code —
 * independent of the sandbox's own isolation (see `code-sandbox.ts`) and of
 * the backend's static verification of the generated snippet.
 */

// ---------------------------------------------------------------------------
// Entity count cap
// ---------------------------------------------------------------------------

/** Default ceiling on the number of entities a sandboxed session may add. */
export const DEFAULT_MAX_ENTITIES = 200;

export interface EntityCapOptions {
  /** Maximum number of entities the live `Viewer` may hold. */
  maxEntities: number;
}

/** Thrown by {@link assertEntityCapNotExceeded} once the cap is reached. */
export class EntityCapExceededError extends Error {
  constructor(maxEntities: number) {
    super(`Entity cap of ${maxEntities} reached; refusing to add another entity.`);
    this.name = "EntityCapExceededError";
  }
}

/**
 * Throws {@link EntityCapExceededError} once `viewer.entities.values.length`
 * has reached `options.maxEntities`. Callers should check this immediately
 * before any `viewer.entities.add(...)` call.
 */
export function assertEntityCapNotExceeded(viewer: Viewer, options: EntityCapOptions): void {
  if (viewer.entities.values.length >= options.maxEntities) {
    throw new EntityCapExceededError(options.maxEntities);
  }
}

/** Options for {@link assertCollectionCapNotExceeded}. */
export interface CollectionCapOptions {
  /** Maximum number of items the collection may hold. */
  maxCount: number;
}

/** Thrown by {@link assertCollectionCapNotExceeded} once a tracked collection's cap is reached. */
export class CollectionCapExceededError extends Error {
  constructor(kind: string, maxCount: number) {
    super(`${kind} cap of ${maxCount} reached; refusing to add another ${kind.toLowerCase()}.`);
    this.name = "CollectionCapExceededError";
  }
}

/**
 * Generic cap-check for any Cesium collection exposing a `.length` — e.g.
 * `viewer.scene.primitives` (3D Tilesets/primitives) or `viewer.dataSources`
 * (GeoJSON/KML data sources). Generalizes {@link assertEntityCapNotExceeded}
 * so the entity cap defense-in-depth guard isn't limited to
 * `viewer.entities.add`: those other two are also unbounded-growth vectors a
 * sandboxed run could otherwise use to bypass the entity cap entirely.
 */
export function assertCollectionCapNotExceeded(
  currentCount: number,
  kind: string,
  options: CollectionCapOptions,
): void {
  if (currentCount >= options.maxCount) {
    throw new CollectionCapExceededError(kind, options.maxCount);
  }
}

// ---------------------------------------------------------------------------
// Call rate limiter
// ---------------------------------------------------------------------------

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