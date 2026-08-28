import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

export const turfRegisterDatasetInputSchema = z.object({
  geojson: geoJsonOrDatasetRefShape.describe(
    "The GeoJSON Feature or FeatureCollection to register, or a `dataset_id` to re-register (no-op, returns the same data under a new id).",
  ),
});
