import type { Viewer } from "cesium";

/**
 * Client-side guards around sandboxed `executeCesiumCode` runs: a shared
 * per-collection item cap for entities, primitives, imagery layers, and data
 * sources. Defense-in-depth around
 * LLM-generated code — independent of the sandbox's own isolation (see
 * `code-sandbox.ts`) and of the backend's static verification of the
 * generated snippet.
 *
 * The call-rate limiter that used to live here moved out to this app's
 * `frontend/src/utils/sandbox-call-rate-limiter.ts` — unlike these caps, it's
 * never invoked internally by this package (`runCesiumCodeInSandbox` never
 * calls it), has no dependency on `cesium`/`quickjs-emscripten`, and only its
 * one consumer (`ChatPanel`) ever used it, so it didn't need to live in this
 * package.
 */

// ---------------------------------------------------------------------------
// Scene collection caps
// ---------------------------------------------------------------------------

/** Default ceiling applied independently to each guarded scene collection. */
export const DEFAULT_MAX_ITEMS_PER_COLLECTION = 200;

export interface SceneCollectionCapOptions {
  /** Maximum items allowed in each guarded collection. */
  maxItemsPerCollection?: number;
}

/** Thrown by {@link assertEntityCapNotExceeded} once the cap is reached. */
export class EntityCapExceededError extends Error {
  constructor(maxItemsPerCollection: number) {
    super(`Entity cap of ${maxItemsPerCollection} reached; refusing to add another entity.`);
    this.name = "EntityCapExceededError";
  }
}

/**
 * Throws {@link EntityCapExceededError} once `viewer.entities.values.length`
 * has reached `options.maxItemsPerCollection` (or
 * {@link DEFAULT_MAX_ITEMS_PER_COLLECTION} if
 * omitted). Callers should check this immediately before any
 * `viewer.entities.add(...)` call.
 */
export function assertEntityCapNotExceeded(
  viewer: Viewer,
  options: SceneCollectionCapOptions = {},
): void {
  const maxItems = options.maxItemsPerCollection ?? DEFAULT_MAX_ITEMS_PER_COLLECTION;
  if (viewer.entities.values.length >= maxItems) {
    throw new EntityCapExceededError(maxItems);
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
