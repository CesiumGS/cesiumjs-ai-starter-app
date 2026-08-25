import { z } from "zod";
import type { StoredGeoJson, TurfDatasetStore } from "./dataset-store.js";

/**
 * A tool input field accepting **either** an inline GeoJSON Feature/
 * FeatureCollection **or** a `dataset_id` referencing a previously stored
 * dataset (returned by `turf_register_dataset` or a prior Turf tool call).
 *
 * Every Turf tool in this package uses this shape for its GeoJSON-shaped
 * inputs rather than a bare GeoJSON schema — per this repo's `dataset_id`
 * indirection convention, raw GeoJSON should never round-trip through
 * tool-call arguments/LLM context once it already has an id; only small
 * inline features are expected to ever take the raw-GeoJSON branch (e.g. a
 * user-drawn point).
 */
/**
 * `type`/`geometry`/`features` are declared as named, non-catchall properties
 * (rather than folding everything into `.catchall(z.unknown())`) so the JSON
 * schema handed to the model actually lists `geometry`/`features` as expected
 * fields — a bare `{ type: "Feature" } & catchall(unknown)` schema serializes
 * with only `type` under `properties` (everything else falls under an opaque
 * `additionalProperties: {}`), which models frequently ignore, causing them
 * to send `{"type":"Feature"}` with no `geometry` at all.
 */
const inlineFeatureShape = z
  .object({
    type: z.literal("Feature"),
    geometry: z
      .object({ type: z.string() })
      .catchall(z.unknown())
      .describe("REQUIRED: the feature's GeoJSON geometry, e.g. { type: 'Point', coordinates: [...] }."),
    properties: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .catchall(z.unknown())
  .describe("An inline GeoJSON Feature — geometry is required.");

const inlineFeatureCollectionShape = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z
      .array(z.unknown())
      .min(1)
      .describe("REQUIRED: a non-empty array of GeoJSON Feature objects."),
  })
  .catchall(z.unknown())
  .describe("An inline GeoJSON FeatureCollection — features is required.");

export const geoJsonOrDatasetRefShape = z.union([
  z.object({ dataset_id: z.string().min(1) }),
  inlineFeatureShape,
  inlineFeatureCollectionShape,
]);

export type GeoJsonOrDatasetRef = z.infer<typeof geoJsonOrDatasetRefShape>;

/** Thrown by {@link resolveGeoJson} when a `dataset_id` doesn't resolve for this session. */
export class UnknownDatasetError extends Error {
  constructor(datasetId: string) {
    super(`Unknown dataset_id "${datasetId}" (expired, or not created in this session).`);
    this.name = "UnknownDatasetError";
  }
}

/**
 * Thrown by {@link resolveGeoJson} when an inline Feature/FeatureCollection is
 * structurally valid per {@link geoJsonOrDatasetRefShape} (schema only checks
 * `type`) but missing the data Turf actually needs, e.g. a FeatureCollection
 * with no `features` array, or a Feature with no `geometry` — which would
 * otherwise crash the underlying Turf call with an opaque error (e.g.
 * `TypeError: Cannot read properties of undefined (reading 'type')` from deep
 * inside `@turf/buffer`) instead of a clear tool `{ error }`.
 */
export class InvalidGeoJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGeoJsonError";
  }
}

/**
 * Resolves a {@link GeoJsonOrDatasetRef} tool input to real GeoJSON: passes an
 * inline Feature/FeatureCollection straight through, or looks up a
 * `dataset_id` in `store` scoped to `sessionId`. Throws
 * {@link UnknownDatasetError} if the id doesn't resolve, or
 * {@link InvalidGeoJsonError} if an inline FeatureCollection has no `features`
 * array or an inline Feature has no `geometry` — callers should catch both
 * and report them as a tool `{ error }` result rather than let them propagate
 * as an unhandled rejection.
 */
export function resolveGeoJson(
  input: GeoJsonOrDatasetRef,
  store: TurfDatasetStore,
  sessionId: string,
): StoredGeoJson {
  const datasetId = (input as { dataset_id?: unknown }).dataset_id;
  if (typeof datasetId === "string") {
    const resolved = store.get(sessionId, datasetId);
    if (!resolved) throw new UnknownDatasetError(datasetId);
    return resolved;
  }

  const inline = input as {
    type: "Feature" | "FeatureCollection";
    features?: unknown;
    geometry?: unknown;
  };
  if (inline.type === "FeatureCollection" && !Array.isArray(inline.features)) {
    throw new InvalidGeoJsonError(
      'Invalid FeatureCollection: missing or non-array "features". Provide at least one feature, ' +
        "or pass a dataset_id from a prior turf_register_dataset/tool call.",
    );
  }
  if (
    inline.type === "Feature" &&
    (typeof inline.geometry !== "object" || inline.geometry === null)
  ) {
    throw new InvalidGeoJsonError(
      'Invalid Feature: missing "geometry". Provide a geometry object (e.g. { "type": "Point", ' +
        '"coordinates": [...] }), or pass a dataset_id from a prior turf_register_dataset/tool call.',
    );
  }
  return input as unknown as StoredGeoJson;
}
