import { tool, type Tool } from "ai";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { TurfDatasetStore } from "../dataset-store.js";
import { InvalidGeoJsonError, resolveGeoJson, UnknownDatasetError } from "../resolve-geojson.js";
import { findDisallowedGeometryTypes } from "../geometry-checks.js";
import { MAX_INTERSECT_FEATURE_PAIRS } from "../guardrails.js";
import { turfIntersectInputSchema } from "./turf-intersect.schema.js";

export { turfIntersectInputSchema } from "./turf-intersect.schema.js";

function asPolygonFeatures(value: unknown): Feature<Polygon | MultiPolygon>[] {
  const collection = value as
    FeatureCollection<Polygon | MultiPolygon> | Feature<Polygon | MultiPolygon>;
  return collection.type === "FeatureCollection" ? collection.features : [collection];
}

/**
 * `turf_intersect` — computes the overlap between every polygon in
 * `features1` and every polygon in `features2` (e.g. "which zoning parcels
 * overlap the flood-risk zone").
 *
 * This is an O(n·m) nested loop, one `turf.intersect` call per feature pair —
 * fine for small inputs, but a request with two large layers could run
 * effectively unbounded work. This guards `features1.length * features2.length`
 * against {@link MAX_INTERSECT_FEATURE_PAIRS} up front and rejects with a
 * clear error instead of silently hanging.
 */
export function createTurfIntersectTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Compute polygon overlap between two GeoJSON polygon layers (e.g. zoning parcels vs. a " +
      "flood-risk zone). Returns a new dataset_id for the overlapping regions found, and how " +
      "many pairs overlapped.",
    inputSchema: turfIntersectInputSchema,
    execute: async ({ features1, features2 }) => {
      try {
        const resolved1 = asPolygonFeatures(resolveGeoJson(features1, store, sessionId));
        const resolved2 = asPolygonFeatures(resolveGeoJson(features2, store, sessionId));

        const badTypes1 = findDisallowedGeometryTypes(resolved1, ["Polygon", "MultiPolygon"]);
        if (badTypes1.length > 0) {
          return {
            error: `features1 must contain only Polygon/MultiPolygon features; found: ${badTypes1.join(", ")}.`,
          };
        }
        const badTypes2 = findDisallowedGeometryTypes(resolved2, ["Polygon", "MultiPolygon"]);
        if (badTypes2.length > 0) {
          return {
            error: `features2 must contain only Polygon/MultiPolygon features; found: ${badTypes2.join(", ")}.`,
          };
        }

        const pairCount = resolved1.length * resolved2.length;
        if (pairCount > MAX_INTERSECT_FEATURE_PAIRS) {
          return {
            error:
              `turf_intersect input is too large: ${resolved1.length} x ${resolved2.length} = ` +
              `${pairCount} feature pairs exceeds the ${MAX_INTERSECT_FEATURE_PAIRS} pair limit. ` +
              "Narrow either input (e.g. filter or tile it) before retrying.",
          };
        }

        const intersections: Feature<Polygon | MultiPolygon>[] = [];
        for (const a of resolved1) {
          for (const b of resolved2) {
            const result = turf.intersect(turf.featureCollection([a, b]));
            if (result) intersections.push(result);
          }
        }

        const datasetId = store.set(sessionId, turf.featureCollection(intersections));
        return { dataset_id: datasetId, overlap_count: intersections.length };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}
