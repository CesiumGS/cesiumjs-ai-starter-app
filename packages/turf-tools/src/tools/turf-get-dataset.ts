import { z } from "zod";
import { tool, type Tool } from "ai";
import type { TurfDatasetStore } from "../dataset-store.js";
import { TURF_TOOL_NAMES } from "../tool-names.js";

export const turfGetDatasetInputSchema = z.object({
  dataset_id: z.string().min(1).describe("A dataset_id returned by a prior Turf tool call."),
});

/**
 * `turf_get_dataset` — resolves a `dataset_id` back to its full GeoJSON. Every
 * other Turf tool deliberately returns only a `dataset_id` + small summary
 * (never the full FeatureCollection) to keep tool-call payloads/LLM context
 * small — this tool is the one place a Turf result's actual GeoJSON is meant
 * to leave the session store, so it can be passed as-is into a rendering tool
 * (e.g. `geoJsonAdd`'s `geojson` field) once the model actually needs to show
 * it on the globe.
 */
export function createTurfGetDatasetTool(store: TurfDatasetStore, sessionId: string): Tool {
  return tool({
    description:
      "Fetch the full GeoJSON for a dataset_id returned by a prior Turf tool call — e.g. to pass " +
      "into a rendering tool like geoJsonAdd. Only call this when the data actually needs to leave " +
      "the session store (to render it, or to inspect it directly); prefer chaining dataset_id " +
      "into another Turf tool instead when just running more analysis on it.",
    inputSchema: turfGetDatasetInputSchema,
    execute: async ({ dataset_id }) => {
      const resolved = store.get(sessionId, dataset_id);
      if (!resolved) {
        return {
          error: `Unknown dataset_id "${dataset_id}" (expired, or not created in this session).`,
        };
      }
      return { geojson: resolved };
    },
  });
}

export const TURF_GET_DATASET_TOOL_NAME = TURF_TOOL_NAMES.turfGetDataset;
