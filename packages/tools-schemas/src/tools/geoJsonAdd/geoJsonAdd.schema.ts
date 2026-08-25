import { z } from "zod";

/**
 * Structural input shape for the `geoJsonAdd` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `geoJsonAdd.ts` and `flyTo.schema.ts` for the convention this follows).
 *
 * `geojson` is a discriminated-by-`type` union rather than a single
 * `.catchall(z.unknown())` object: a bare `{ type: "..." } & catchall(unknown)`
 * shape serializes to JSON schema with only `type` listed under `properties`
 * (everything else — including `features`/`geometry`/`geometries` — collapses
 * into an opaque `additionalProperties: {}`), which models frequently ignore.
 * That previously let a model pass e.g. `{"type":"FeatureCollection"}` with no
 * `features` array at all, which `Cesium.GeoJsonDataSource.load` then crashes
 * on with an opaque `Cannot read properties of undefined (reading 'length')`
 * instead of a clear tool `{ error }`. Naming `features`/`geometry`/
 * `geometries` as real (still-catchall) properties fixes both the model-facing
 * schema and Zod's own validation, same fix already applied to
 * `@cesium-ai/turf-tools`' `resolve-geojson.ts`.
 */
const featureShape = z
  .object({
    type: z.literal("Feature"),
    geometry: z
      .object({ type: z.string() })
      .catchall(z.unknown())
      .describe(
        "REQUIRED: the feature's GeoJSON geometry, e.g. { type: 'Point', coordinates: [...] }.",
      ),
  })
  .catchall(z.unknown())
  .describe("A GeoJSON Feature — geometry is required.");

const featureCollectionShape = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z
      .array(z.unknown())
      .describe("REQUIRED: the array of GeoJSON Feature objects (may be empty)."),
  })
  .catchall(z.unknown())
  .describe("A GeoJSON FeatureCollection — features is required.");

const geometryCollectionShape = z
  .object({
    type: z.literal("GeometryCollection"),
    geometries: z
      .array(z.unknown())
      .describe("REQUIRED: the array of GeoJSON geometry objects (may be empty)."),
  })
  .catchall(z.unknown())
  .describe("A GeoJSON GeometryCollection — geometries is required.");

export const geoJsonAddInputShape = z.object({
  geojson: z.union([featureShape, featureCollectionShape, geometryCollectionShape]),
  name: z.string().optional(),
  stroke: z.string().optional(),
  fill: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  clampToGround: z.boolean().optional(),
  markerColor: z.string().optional(),
});

/** Validated `geoJsonAdd` input, inferred from {@link geoJsonAddInputShape}. */
export type GeoJsonAddInput = z.infer<typeof geoJsonAddInputShape>;
