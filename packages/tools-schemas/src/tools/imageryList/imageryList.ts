import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { imageryListInputShape } from "./imageryList.schema.js";

/** Default natural-language description handed to the model for `imageryList`. */
export const DEFAULT_IMAGERY_LIST_DESCRIPTION =
  "List all imagery layers on the globe, including their visibility, opacity, and provider type.";

/** Per-field model-facing `.describe()` hints for the `imageryList` input schema. */
export interface ImageryListFieldDescriptions {
  includeDetails?: string;
}

/** Default **model-facing** `.describe()` hint for each `imageryList` input field. */
export const DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS: Required<ImageryListFieldDescriptions> = {
  includeDetails: "Include detailed provider information.",
};

/**
 * Builds the **model-facing** `imageryList` input schema: the shared structural
 * shape ({@link imageryListInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildImageryListInputSchema(descriptions: ImageryListFieldDescriptions = {}) {
  return buildDescribedSchema(
    imageryListInputShape.shape,
    DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `imageryList` input schema, using every default field hint. */
export const defaultImageryListInputSchema = buildImageryListInputSchema();

/** Per-tool overrides for {@link createImageryList}. */
export type ImageryListConfig = ClientToolConfig<ImageryListFieldDescriptions>;

/**
 * `imageryList` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createImageryList = createToolFactory(
  DEFAULT_IMAGERY_LIST_DESCRIPTION,
  buildImageryListInputSchema,
);

/** Ready-to-use `imageryList` tool with default description and schema. */
export const imageryList = createImageryList();
