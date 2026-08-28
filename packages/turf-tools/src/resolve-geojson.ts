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
const positionShape = z
  .array(z.number())
  .min(2)
  .max(3)
  .describe("A [longitude, latitude] pair (optionally with a 3rd altitude element).");

/**
 * A real GeoJSON geometry, discriminated on `type` with per-type `coordinates`
 * shapes — stricter than a bare `{ type: string }` so the model sees exactly
 * which `type` values are valid and what nesting `coordinates` needs for each,
 * instead of guessing. `GeometryCollection` is intentionally omitted: none of
 * this package's tools operate on one today.
 */
const geometryShape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: positionShape }),
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(positionShape).min(1) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(positionShape).min(2) }),
  z.object({
    type: z.literal("MultiLineString"),
    coordinates: z.array(z.array(positionShape).min(2)).min(1),
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(positionShape).min(4)).min(1),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(positionShape).min(4)).min(1)).min(1),
  }),
]);

const inlineFeatureShape = z
  .object({
    type: z.literal("Feature"),
    geometry: geometryShape.describe("REQUIRED: the feature's GeoJSON geometry."),
    properties: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .catchall(z.unknown())
  .describe("An inline GeoJSON Feature — geometry is required.");

const inlineFeatureCollectionShape = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z
      .array(inlineFeatureShape)
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
 * missing the data Turf actually needs, e.g. a FeatureCollection with no
 * `features` array, or a Feature with no `geometry` — which would otherwise
 * crash the underlying Turf call with an opaque error (e.g. `TypeError:
 * Cannot read properties of undefined (reading 'type')` from deep inside
 * `@turf/buffer`) instead of a clear tool `{ error }`. Tool-call input is
 * already rejected by {@link geoJsonOrDatasetRefShape} before this runs; this
 * is a defense-in-depth check for callers that invoke `resolveGeoJson`
 * directly with unvalidated data.
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
  // Only the dataset_id variant lacks a `type` field — the other two members'
  // catchall(unknown) would otherwise make a `"dataset_id" in input` check
  // widen `dataset_id` itself to `unknown` across the union.
  if (!("type" in input)) {
    const resolved = store.get(sessionId, input.dataset_id);
    if (!resolved) throw new UnknownDatasetError(input.dataset_id);
    return resolved;
  }

  if (input.type === "FeatureCollection" && !Array.isArray(input.features)) {
    throw new InvalidGeoJsonError(
      'Invalid FeatureCollection: missing or non-array "features". Provide at least one feature, ' +
        "or pass a dataset_id from a prior turf_register_dataset/tool call.",
    );
  }
  if (input.type === "Feature" && (typeof input.geometry !== "object" || input.geometry === null)) {
    throw new InvalidGeoJsonError(
      'Invalid Feature: missing "geometry". Provide a geometry object (e.g. { "type": "Point", ' +
        '"coordinates": [...] }), or pass a dataset_id from a prior turf_register_dataset/tool call.',
    );
  }
  return input as StoredGeoJson;
}
