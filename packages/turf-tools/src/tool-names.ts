/** Canonical identifiers for every Turf.js spatial-analysis tool this package exports. */
export const TURF_TOOL_NAMES = {
  turfRegisterDataset: "turf_register_dataset",
  turfGetDataset: "turf_get_dataset",
  turfBuffer: "turf_buffer",
  turfPointsWithinPolygon: "turf_points_within_polygon",
  turfIntersect: "turf_intersect",
  turfArea: "turf_area",
  turfHexGrid: "turf_hex_grid",
} as const;

export type TurfToolName = (typeof TURF_TOOL_NAMES)[keyof typeof TURF_TOOL_NAMES];
