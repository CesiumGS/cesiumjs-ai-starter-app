import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { z } from "zod";
import { entityAddInputShape, entityAddTypeValues } from "./entityAdd.schema.js";

/** Default natural-language description handed to the model for `entityAdd`. */
export const DEFAULT_ENTITY_ADD_DESCRIPTION =
  "Add a Cesium entity. Choose the entity `type` and provide matching `data` for that type.";

/** Per-field model-facing `.describe()` hints for the generic `entityAdd` input schema. */
export interface EntityAddFieldDescriptions {
  type?: string;
  data?: string;
}

/** Default `.describe()` hint for each top-level `entityAdd` field. */
export const DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS: Required<EntityAddFieldDescriptions> = {
  // Listed from entityAddTypeValues so it can't drift from the actual supported types.
  type: `Entity kind to add: ${entityAddTypeValues.join(", ")}.`,
  data: "Payload for the selected type. This must match that type's existing entityAdd* input shape.",
};

/**
 * Builds the model-facing `entityAdd` input schema with top-level field
 * descriptions. Structural validation remains delegated to
 * {@link entityAddInputShape}.
 */
export function buildEntityAddInputSchema(descriptions: EntityAddFieldDescriptions = {}) {
  const typeDescription = descriptions.type ?? DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS.type;
  const dataDescription = descriptions.data ?? DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS.data;

  const describedOptions = entityAddInputShape.options.map((option) =>
    option.extend({
      type: option.shape.type.describe(typeDescription),
      data: option.shape.data.describe(dataDescription),
    }),
  );

  const [first, ...rest] = describedOptions;
  if (!first) {
    throw new Error("entityAddInputShape has no variants.");
  }

  return z.discriminatedUnion("type", [first, ...rest]);
}

/** Default model-facing `entityAdd` schema, using every default field hint. */
export const defaultEntityAddInputSchema = buildEntityAddInputSchema();

/** Per-tool overrides for {@link createEntityAdd}. */
export type EntityAddConfig = ClientToolConfig<EntityAddFieldDescriptions>;

/**
 * `entityAdd` — additive client-side tool that composes all existing
 * `entityAdd*` payload contracts under one discriminated input.
 */
export const createEntityAdd = createToolFactory(
  DEFAULT_ENTITY_ADD_DESCRIPTION,
  buildEntityAddInputSchema,
);

/** Ready-to-use `entityAdd` tool with default description and schema. */
export const entityAdd = createEntityAdd();
