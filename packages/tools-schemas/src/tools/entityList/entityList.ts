import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityListInputShape } from "./entityList.schema.js";

/** Default natural-language description handed to the model for `entityList`. */
export const DEFAULT_ENTITY_LIST_DESCRIPTION =
  "List all entities currently in the Cesium viewer, with their type and position.";

/** Per-field model-facing `.describe()` hints for the `entityList` input schema. */
export interface EntityListFieldDescriptions {
  // No input fields.
}

/** Default **model-facing** `.describe()` hint for each `entityList` input field. */
export const DEFAULT_ENTITY_LIST_FIELD_DESCRIPTIONS: Required<EntityListFieldDescriptions> = {
  // No input fields.
};

/**
 * Builds the **model-facing** `entityList` input schema: the shared structural
 * shape ({@link entityListInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityListInputSchema(descriptions: EntityListFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityListInputShape.shape,
    DEFAULT_ENTITY_LIST_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityList` input schema, using every default field hint. */
export const defaultEntityListInputSchema = buildEntityListInputSchema();

/** Per-tool overrides for {@link createEntityList}. */
export type EntityListConfig = ClientToolConfig<EntityListFieldDescriptions>;

/**
 * `entityList` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityList = createToolFactory(
  DEFAULT_ENTITY_LIST_DESCRIPTION,
  buildEntityListInputSchema,
);

/** Ready-to-use `entityList` tool with default description and schema. */
export const entityList = createEntityList();
