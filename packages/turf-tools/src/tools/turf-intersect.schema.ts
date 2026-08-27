import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

export const turfIntersectInputSchema = z.object({
  features1: geoJsonOrDatasetRefShape.describe(
    "First polygon FeatureCollection (or dataset_id), e.g. a zoning layer.",
  ),
  features2: geoJsonOrDatasetRefShape.describe(
    "Second polygon FeatureCollection (or dataset_id) to overlap against, e.g. a flood-risk layer.",
  ),
});
