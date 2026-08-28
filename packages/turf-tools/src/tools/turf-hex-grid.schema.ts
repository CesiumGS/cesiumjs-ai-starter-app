import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

export const turfHexGridInputSchema = z.object({
  bbox: z
    .object({
      west: z.number().min(-180).max(180),
      south: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
      north: z.number().min(-90).max(90),
    })
    .describe("Bounding box to cover with hexagons."),
  cell_side: z.number().positive().describe("Hexagon cell side length, in kilometers."),
  points_to_aggregate: geoJsonOrDatasetRefShape
    .optional()
    .describe(
      "Optional FeatureCollection of Points (or dataset_id) to aggregate into each hex cell " +
        "— e.g. for a density heatmap.",
    ),
  aggregate_property: z
    .string()
    .optional()
    .describe(
      "Optional numeric property name on each point to sum per cell (in addition to point count). " +
        "Ignored if points_to_aggregate is omitted.",
    ),
});
