import type { ToolSet } from "ai";
import { TURF_TOOL_NAMES, type TurfToolName } from "./tool-names.js";
import type { TurfDatasetStore } from "./dataset-store.js";
import { createTurfRegisterDatasetTool } from "./tools/turf-register-dataset.js";
import { createTurfGetDatasetTool } from "./tools/turf-get-dataset.js";
import { createTurfBufferTool } from "./tools/turf-buffer.js";
import { createTurfPointsWithinPolygonTool } from "./tools/turf-points-within-polygon.js";
import { createTurfIntersectTool } from "./tools/turf-intersect.js";
import { createTurfAreaTool } from "./tools/turf-area.js";
import { createTurfHexGridTool } from "./tools/turf-hex-grid.js";

export { TURF_TOOL_NAMES, type TurfToolName };
export {
  createTurfDatasetStore,
  type TurfDatasetStore,
  type TurfDatasetStoreOptions,
  type StoredGeoJson,
} from "./dataset-store.js";
export {
  geoJsonOrDatasetRefShape,
  resolveGeoJson,
  UnknownDatasetError,
  InvalidGeoJsonError,
  type GeoJsonOrDatasetRef,
} from "./resolve-geojson.js";
export {
  MAX_INTERSECT_FEATURE_PAIRS,
  MAX_HEX_GRID_CELLS,
  MAX_HEX_GRID_AGGREGATE_POINTS,
} from "./guardrails.js";
export {
  createTurfRegisterDatasetTool,
  turfRegisterDatasetInputSchema,
} from "./tools/turf-register-dataset.js";
export { createTurfGetDatasetTool, turfGetDatasetInputSchema } from "./tools/turf-get-dataset.js";
export { createTurfBufferTool, turfBufferInputSchema } from "./tools/turf-buffer.js";
export {
  createTurfPointsWithinPolygonTool,
  turfPointsWithinPolygonInputSchema,
} from "./tools/turf-points-within-polygon.js";
export { createTurfIntersectTool, turfIntersectInputSchema } from "./tools/turf-intersect.js";
export { createTurfAreaTool, turfAreaInputSchema } from "./tools/turf-area.js";
export { createTurfHexGridTool, turfHexGridInputSchema } from "./tools/turf-hex-grid.js";

/**
 * Builds the full Turf.js tool set (`turf_register_dataset`, `turf_get_dataset`,
 * `turf_buffer`, `turf_points_within_polygon`, `turf_intersect`, `turf_area`,
 * `turf_hex_grid`) bound to one `sessionId` against `store` — call this once
 * per request with that request's own session id (mirrors this repo's
 * `createExecuteCesiumCodeTool` per-request tool-factory pattern), never
 * once at server-startup, or every session would share the same bound id.
 */
export function createTurfTools(store: TurfDatasetStore, sessionId: string): ToolSet {
  return {
    [TURF_TOOL_NAMES.turfRegisterDataset]: createTurfRegisterDatasetTool(store, sessionId),
    [TURF_TOOL_NAMES.turfGetDataset]: createTurfGetDatasetTool(store, sessionId),
    [TURF_TOOL_NAMES.turfBuffer]: createTurfBufferTool(store, sessionId),
    [TURF_TOOL_NAMES.turfPointsWithinPolygon]: createTurfPointsWithinPolygonTool(store, sessionId),
    [TURF_TOOL_NAMES.turfIntersect]: createTurfIntersectTool(store, sessionId),
    [TURF_TOOL_NAMES.turfArea]: createTurfAreaTool(store, sessionId),
    [TURF_TOOL_NAMES.turfHexGrid]: createTurfHexGridTool(store, sessionId),
  };
}
