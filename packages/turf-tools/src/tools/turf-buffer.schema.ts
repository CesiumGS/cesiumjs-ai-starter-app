import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

const unitsEnum = z.enum(["meters", "kilometers", "miles"]);

export const turfBufferInputSchema = z.object({
  geojson: geoJsonOrDatasetRefShape.describe(
    "The Feature/FeatureCollection to buffer, or a dataset_id from a prior tool call.",
  ),
  radius: z.number().positive().describe("Buffer distance, in `units`."),
  units: unitsEnum.default("meters").describe("Unit for `radius`. Defaults to meters."),
});
