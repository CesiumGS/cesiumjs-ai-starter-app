import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { imageryRemoveInputShape } from "./imageryRemove.schema.js";

/** Default natural-language description handed to the model for `imageryRemove`. */
export const DEFAULT_IMAGERY_REMOVE_DESCRIPTION = "Remove an imagery layer from the globe by index or name, or remove all non-base layers at once.";

/** Per-field model-facing `.describe()` hints for the `imageryRemove` input schema. */
export interface ImageryRemoveFieldDescriptions {
  index?: string;
  name?: string;
  removeAll?: string;
}

/** Default **model-facing** `.describe()` hint for each `imageryRemove` input field. */
export const DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS: Required<ImageryRemoveFieldDescriptions> = {
  index: "Index of the imagery layer to remove.",
  name: "Name of the imagery layer to remove.",
  removeAll: "Remove all non-base imagery layers.",
};

/**
 * Builds the **model-facing** `imageryRemove` input schema: the shared structural
 * shape ({@link imageryRemoveInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildImageryRemoveInputSchema(descriptions: ImageryRemoveFieldDescriptions = {}) {
  return buildDescribedSchema(
    imageryRemoveInputShape.shape,
    DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `imageryRemove` input schema, using every default field hint. */
export const defaultImageryRemoveInputSchema = buildImageryRemoveInputSchema();

/** Per-tool overrides for {@link createImageryRemove}. */
export type ImageryRemoveConfig = ClientToolConfig<ImageryRemoveFieldDescriptions>;

/**
 * `imageryRemove` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createImageryRemove = createToolFactory(DEFAULT_IMAGERY_REMOVE_DESCRIPTION, buildImageryRemoveInputSchema);

/** Ready-to-use `imageryRemove` tool with default description and schema. */
export const imageryRemove = createImageryRemove();
