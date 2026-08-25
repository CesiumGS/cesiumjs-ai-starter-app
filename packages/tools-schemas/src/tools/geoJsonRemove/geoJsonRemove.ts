import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { geoJsonRemoveInputShape } from "./geoJsonRemove.schema.js";

/** Default natural-language description handed to the model for `geoJsonRemove`. */
export const DEFAULT_GEO_JSON_REMOVE_DESCRIPTION =
  "Remove a previously added GeoJSON data source from the globe by name, or remove all of them at once.";

/** Per-field model-facing `.describe()` hints for the `geoJsonRemove` input schema. */
export interface GeoJsonRemoveFieldDescriptions {
  name?: string;
  removeAll?: string;
}

/** Default **model-facing** `.describe()` hint for each `geoJsonRemove` input field. */
export const DEFAULT_GEO_JSON_REMOVE_FIELD_DESCRIPTIONS: Required<GeoJsonRemoveFieldDescriptions> =
  {
    name: "Name of the GeoJSON data source to remove, as given to geoJsonAdd.",
    removeAll: "Remove every GeoJSON data source added by geoJsonAdd.",
  };

/**
 * Builds the **model-facing** `geoJsonRemove` input schema: the shared structural
 * shape ({@link geoJsonRemoveInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildGeoJsonRemoveInputSchema(descriptions: GeoJsonRemoveFieldDescriptions = {}) {
  return buildDescribedSchema(
    geoJsonRemoveInputShape.shape,
    DEFAULT_GEO_JSON_REMOVE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `geoJsonRemove` input schema, using every default field hint. */
export const defaultGeoJsonRemoveInputSchema = buildGeoJsonRemoveInputSchema();

/** Per-tool overrides for {@link createGeoJsonRemove}. */
export type GeoJsonRemoveConfig = ClientToolConfig<GeoJsonRemoveFieldDescriptions>;

/**
 * `geoJsonRemove` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createGeoJsonRemove = createToolFactory(
  DEFAULT_GEO_JSON_REMOVE_DESCRIPTION,
  buildGeoJsonRemoveInputSchema,
);

/** Ready-to-use `geoJsonRemove` tool with default description and schema. */
export const geoJsonRemove = createGeoJsonRemove();
