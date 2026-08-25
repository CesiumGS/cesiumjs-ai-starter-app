import { z } from "zod";
import { tool, type Tool } from "ai";
import * as turf from "@turf/turf";
import type { FeatureCollection, Point, Polygon, MultiPolygon } from "geojson";
import type { TurfDatasetStore } from "../dataset-store.js";
import {
  geoJsonOrDatasetRefShape,
  InvalidGeoJsonError,
  resolveGeoJson,
  UnknownDatasetError,
} from "../resolve-geojson.js";

export const turfPointsWithinPolygonInputSchema = z.object({
  points: geoJsonOrDatasetRefShape.describe(
    "A FeatureCollection of Points (or dataset_id) to test — e.g. facility locations, POIs.",
  ),
  polygons: geoJsonOrDatasetRefShape.describe(
    "A FeatureCollection of Polygons/MultiPolygons (or dataset_id) to test against — e.g. a risk zone, district boundary.",
  ),
});

/**
 * `turf_points_within_polygon` — finds which points fall inside the given
 * polygon(s) (count facilities in a risk zone, POIs in a district). Stores
 * the matching points as a new dataset and also returns the count directly,
 * since it's cheap and often the only thing the model/user actually needs.
 */
export function createTurfPointsWithinPolygonTool(
  store: TurfDatasetStore,
  sessionId: string,
): Tool {
  return tool({
    description:
      "Find which points in a FeatureCollection fall inside a set of polygons (e.g. count " +
      "facilities within a risk zone, or POIs within a district boundary). Returns the matching " +
      "point count and a new dataset_id for the matching points themselves.",
    inputSchema: turfPointsWithinPolygonInputSchema,
    execute: async ({ points, polygons }) => {
      try {
        const resolvedPoints = resolveGeoJson(points, store, sessionId) as FeatureCollection<Point>;
        const resolvedPolygons = resolveGeoJson(polygons, store, sessionId) as FeatureCollection<
          Polygon | MultiPolygon
        >;

        const within = turf.pointsWithinPolygon(resolvedPoints, resolvedPolygons);
        const datasetId = store.set(sessionId, within);
        return { dataset_id: datasetId, point_count: within.features.length };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}
