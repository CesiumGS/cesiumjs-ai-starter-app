import { z } from "zod";

/**
 * Structural input shape for the `geoJsonAdd` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `geoJsonAdd.ts` and `flyTo.schema.ts` for the convention this follows).
 *
 * `geojson` is deliberately typed loosely (`z.record`, refined to require a
 * GeoJSON `type`) rather than a fully-typed Feature/FeatureCollection schema —
 * this tool only needs to hand the object to `Cesium.GeoJsonDataSource.load`
 * unchanged, and a strict schema would reject legitimate GeoJSON this tool
 * has no reason to constrain (arbitrary per-feature `properties`, any
 * geometry type, etc.).
 */
export const geoJsonAddInputShape = z.object({
  geojson: z
    .object({ type: z.enum(["Feature", "FeatureCollection", "GeometryCollection"]) })
    .catchall(z.unknown()),
  name: z.string().optional(),
  stroke: z.string().optional(),
  fill: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  clampToGround: z.boolean().optional(),
  markerColor: z.string().optional(),
});

/** Validated `geoJsonAdd` input, inferred from {@link geoJsonAddInputShape}. */
export type GeoJsonAddInput = z.infer<typeof geoJsonAddInputShape>;
