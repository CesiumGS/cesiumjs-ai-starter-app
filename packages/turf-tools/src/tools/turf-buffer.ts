import { tool, type Tool } from "ai";
import * as turf from "@turf/turf";
import type { TurfDatasetStore } from "../dataset-store.js";
import { InvalidGeoJsonError, resolveGeoJson, UnknownDatasetError } from "../resolve-geojson.js";
import { turfBufferInputSchema } from "./turf-buffer.schema.js";

export { turfBufferInputSchema } from "./turf-buffer.schema.js";

/**
 * `turf_buffer` — generates a buffer polygon around every feature in
 * `geojson` at `radius` `units` (flood/risk zones, proximity areas), and
 * stores the result under a new `dataset_id` for chaining into further tools.
 */
export function createTurfBufferTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Buffer GeoJSON features by a given radius/units, producing buffer polygons around them " +
      "(e.g. a flood zone around a river, a proximity area around a facility). Returns a new " +
      "dataset_id for the buffered result.",
    inputSchema: turfBufferInputSchema,
    execute: async ({ geojson, radius, units }) => {
      try {
        const resolved = resolveGeoJson(geojson, store, sessionId);
        const buffered = turf.buffer(resolved, radius, { units });
        if (!buffered) return { error: "turf.buffer produced no output for this input." };

        const datasetId = store.set(sessionId, buffered);
        const featureCount = buffered.type === "FeatureCollection" ? buffered.features.length : 1;
        return { dataset_id: datasetId, feature_count: featureCount };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}
