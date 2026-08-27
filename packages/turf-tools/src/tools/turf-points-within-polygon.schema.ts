import { z } from "zod";
import { geoJsonOrDatasetRefShape } from "../resolve-geojson.js";

export const turfPointsWithinPolygonInputSchema = z.object({
  points: geoJsonOrDatasetRefShape.describe(
    "A FeatureCollection of Points (or dataset_id) to test — e.g. facility locations, POIs.",
  ),
  polygons: geoJsonOrDatasetRefShape.describe(
    "A FeatureCollection of Polygons/MultiPolygons (or dataset_id) to test against — e.g. a risk zone, district boundary.",
  ),
});
