import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

export const turfAreaUnitsEnum = z.enum(["square_meters", "square_kilometers", "acres"]);

export const turfAreaInputSchema = z.object({
  geojson: geoJsonOrDatasetRefShape.describe(
    "The polygon Feature/FeatureCollection (or dataset_id) to measure.",
  ),
  units: turfAreaUnitsEnum.default("square_meters").describe("Unit for the returned area."),
});
