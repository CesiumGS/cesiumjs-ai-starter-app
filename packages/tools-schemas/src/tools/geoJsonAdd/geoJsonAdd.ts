import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { geoJsonAddInputShape } from "./geoJsonAdd.schema.js";

/** Default natural-language description handed to the model for `geoJsonAdd`. */
export const DEFAULT_GEO_JSON_ADD_DESCRIPTION =
  "Render a GeoJSON Feature or FeatureCollection on the globe as a new data source — e.g. the " +
  "result of a spatial-analysis tool (buffer, intersection, hex grid), a boundary, or a route. " +
  "Pass the actual GeoJSON object, not a URL or a dataset id from another tool.";

/** Per-field model-facing `.describe()` hints for the `geoJsonAdd` input schema. */
export interface GeoJsonAddFieldDescriptions {
  geojson?: string;
  name?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: string;
  clampToGround?: string;
  markerColor?: string;
}

/** Default **model-facing** `.describe()` hint for each `geoJsonAdd` input field. */
export const DEFAULT_GEO_JSON_ADD_FIELD_DESCRIPTIONS: Required<GeoJsonAddFieldDescriptions> = {
  geojson: "The GeoJSON Feature or FeatureCollection to render.",
  name: "Display name for the resulting data source, used later to remove it.",
  stroke: "Line/outline color for polygons and polylines, as a CSS color string.",
  fill: "Fill color for polygons, as a CSS color string.",
  strokeWidth: "Line/outline width in pixels.",
  clampToGround: "Whether to drape polygons/polylines onto terrain. Defaults to false.",
  markerColor: "Marker color for point features, as a CSS color string.",
};

/**
 * Builds the **model-facing** `geoJsonAdd` input schema: the shared structural
 * shape ({@link geoJsonAddInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildGeoJsonAddInputSchema(descriptions: GeoJsonAddFieldDescriptions = {}) {
  return buildDescribedSchema(
    geoJsonAddInputShape.shape,
    DEFAULT_GEO_JSON_ADD_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `geoJsonAdd` input schema, using every default field hint. */
export const defaultGeoJsonAddInputSchema = buildGeoJsonAddInputSchema();

/** Per-tool overrides for {@link createGeoJsonAdd}. */
export type GeoJsonAddConfig = ClientToolConfig<GeoJsonAddFieldDescriptions>;

/**
 * `geoJsonAdd` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createGeoJsonAdd = createToolFactory(
  DEFAULT_GEO_JSON_ADD_DESCRIPTION,
  buildGeoJsonAddInputSchema,
);

/** Ready-to-use `geoJsonAdd` tool with default description and schema. */
export const geoJsonAdd = createGeoJsonAdd();
