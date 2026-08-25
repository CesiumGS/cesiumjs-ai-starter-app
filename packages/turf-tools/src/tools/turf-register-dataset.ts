import { z } from "zod";
import { tool, type Tool } from "ai";
import type { TurfDatasetStore } from "../dataset-store.js";
import {
  geoJsonOrDatasetRefShape,
  InvalidGeoJsonError,
  resolveGeoJson,
  UnknownDatasetError,
} from "../resolve-geojson.js";
import { TURF_TOOL_NAMES } from "../tool-names.js";

const inputShape = z.object({
  geojson: geoJsonOrDatasetRefShape.describe(
    "The GeoJSON Feature or FeatureCollection to register, or a `dataset_id` to re-register (no-op, returns the same data under a new id).",
  ),
});

export const turfRegisterDatasetInputSchema = z.object(inputShape.shape);

/**
 * `turf_register_dataset` — stores a GeoJSON Feature/FeatureCollection in this
 * session's dataset store and returns its `dataset_id`. This is the entry
 * point into the `dataset_id` indirection pattern every other Turf tool in
 * this package follows: once data has an id, later tool calls pass the id
 * instead of round-tripping the full GeoJSON through tool-call args/LLM
 * context.
 *
 * A dedicated GeoJSON-loading tool (attach a Feature/FeatureCollection to the
 * live Viewer) is tracked separately — see this package's README — this tool
 * only manages the server-side dataset store, independent of any rendering.
 */
export function createTurfRegisterDatasetTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Register a GeoJSON Feature or FeatureCollection so later Turf.js analysis tools " +
      "(turf_buffer, turf_points_within_polygon, turf_intersect, turf_area, turf_hex_grid) can " +
      "reference it by dataset_id instead of repeating the full GeoJSON.",
    inputSchema: turfRegisterDatasetInputSchema,
    execute: async ({ geojson }) => {
      try {
        const resolved = resolveGeoJson(geojson, store, sessionId);
        const datasetId = store.set(sessionId, resolved);
        return { dataset_id: datasetId };
      } catch (err) {
        if (err instanceof UnknownDatasetError || err instanceof InvalidGeoJsonError) {
          return { error: err.message };
        }
        throw err;
      }
    },
  });
}

export const TURF_REGISTER_DATASET_TOOL_NAME = TURF_TOOL_NAMES.turfRegisterDataset;
