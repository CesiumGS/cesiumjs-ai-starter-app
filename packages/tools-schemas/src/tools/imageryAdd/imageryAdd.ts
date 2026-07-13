import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { imageryAddInputShape } from "./imageryAdd.schema.js";

/** Default natural-language description handed to the model for `imageryAdd`. */
export const DEFAULT_IMAGERY_ADD_DESCRIPTION = "Add a new imagery layer to the globe, overlaying map tiles, satellite imagery, or a custom tile service.";

/** Per-field model-facing `.describe()` hints for the `imageryAdd` input schema. */
export interface ImageryAddFieldDescriptions {
  type?: string;
  url?: string;
  name?: string;
  layers?: string;
  style?: string;
  format?: string;
  tileMatrixSetID?: string;
  maximumLevel?: string;
  minimumLevel?: string;
  assetId?: string;
  key?: string;
  alpha?: string;
  show?: string;
  rectangle?: string;
}

/** Default **model-facing** `.describe()` hint for each `imageryAdd` input field. */
export const DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS: Required<ImageryAddFieldDescriptions> = {
  type: "Type of imagery provider to create.",
  url: "URL of the imagery service or tile template.",
  name: "Display name for the imagery layer.",
  layers: "Comma-separated layer names (for WMS/WMTS providers).",
  style: "Style name (for WMS/WMTS providers).",
  format: "Image format, e.g. image/png (for WMS/WMTS providers).",
  tileMatrixSetID: "Tile matrix set identifier (for WMTS providers).",
  maximumLevel: "Maximum zoom level (0-30).",
  minimumLevel: "Minimum zoom level (0-30).",
  assetId: "Cesium Ion asset ID, required for IonImageryProvider.",
  key: "API key, required for BingMapsImageryProvider.",
  alpha: "Layer opacity (0 = transparent, 1 = opaque).",
  show: "Whether the layer is visible. Defaults to true.",
  rectangle: "Geographic extent restricting the imagery layer, in degrees.",
};

/**
 * Builds the **model-facing** `imageryAdd` input schema: the shared structural
 * shape ({@link imageryAddInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildImageryAddInputSchema(descriptions: ImageryAddFieldDescriptions = {}) {
  return buildDescribedSchema(
    imageryAddInputShape.shape,
    DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `imageryAdd` input schema, using every default field hint. */
export const defaultImageryAddInputSchema = buildImageryAddInputSchema();

/** Per-tool overrides for {@link createImageryAdd}. */
export type ImageryAddConfig = ClientToolConfig<ImageryAddFieldDescriptions>;

/**
 * `imageryAdd` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createImageryAdd = createToolFactory(DEFAULT_IMAGERY_ADD_DESCRIPTION, buildImageryAddInputSchema);

/** Ready-to-use `imageryAdd` tool with default description and schema. */
export const imageryAdd = createImageryAdd();
