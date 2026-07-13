import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityRemoveInputShape } from "./entityRemove.schema.js";

/** Default natural-language description handed to the model for `entityRemove`. */
export const DEFAULT_ENTITY_REMOVE_DESCRIPTION = "Remove an entity from the viewer by its ID.";

/** Per-field model-facing `.describe()` hints for the `entityRemove` input schema. */
export interface EntityRemoveFieldDescriptions {
  id?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityRemove` input field. */
export const DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS: Required<EntityRemoveFieldDescriptions> = {
  id: "Identifier of the entity to remove.",
};

/**
 * Builds the **model-facing** `entityRemove` input schema: the shared structural
 * shape ({@link entityRemoveInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityRemoveInputSchema(descriptions: EntityRemoveFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityRemoveInputShape.shape,
    DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityRemove` input schema, using every default field hint. */
export const defaultEntityRemoveInputSchema = buildEntityRemoveInputSchema();

/** Per-tool overrides for {@link createEntityRemove}. */
export type EntityRemoveConfig = ClientToolConfig<EntityRemoveFieldDescriptions>;

/**
 * `entityRemove` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityRemove = createToolFactory(
  DEFAULT_ENTITY_REMOVE_DESCRIPTION,
  buildEntityRemoveInputSchema,
);

/** Ready-to-use `entityRemove` tool with default description and schema. */
export const entityRemove = createEntityRemove();
