import { z } from "zod";
import { tool, type Tool } from "ai";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { TurfDatasetStore } from "../dataset-store.js";
import { InvalidGeoJsonError, resolveGeoJson, UnknownDatasetError } from "../resolve-geojson.js";
import { turfAreaInputSchema, turfAreaUnitsEnum } from "./turf-area.schema.js";

export { turfAreaInputSchema } from "./turf-area.schema.js";

const SQUARE_METERS_PER_UNIT: Record<z.infer<typeof turfAreaUnitsEnum>, number> = {
  square_meters: 1,
  square_kilometers: 1_000_000,
  acres: 4046.8564224,
};

function hasPolygonGeometry(feature: Feature<Geometry>): boolean {
  return feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
}

/**
 * `turf_area` — total area of the polygon features in `geojson`. Returns an
 * explicit `{ error }` when the input has no Polygon/MultiPolygon features at
 * all (e.g. a Point-only FeatureCollection), rather than silently returning
 * `0` — indistinguishable from "a real, but zero-area, polygon".
 */
export function createTurfAreaTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Compute the total area of polygon features in a GeoJSON Feature/FeatureCollection (or " +
      "dataset_id), in the requested units.",
    inputSchema: turfAreaInputSchema,
    execute: async ({ geojson, units }) => {
      try {
        const resolved = resolveGeoJson(geojson, store, sessionId);
        const features: Feature<Geometry>[] =
          resolved.type === "FeatureCollection" ? resolved.features : [resolved];

        if (!features.some(hasPolygonGeometry)) {
          return {
            error:
              "Input contains no Polygon/MultiPolygon features, so area is undefined (not zero).",
          };
        }

        const squareMeters = turf.area(resolved as FeatureCollection<Geometry>);
        const area = squareMeters / SQUARE_METERS_PER_UNIT[units];
        return { area, units };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}
