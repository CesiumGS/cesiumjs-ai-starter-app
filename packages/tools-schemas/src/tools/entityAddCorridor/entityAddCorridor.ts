import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddCorridorInputShape } from "./entityAddCorridor.schema.js";

/** Default natural-language description handed to the model for `entityAddCorridor`. */
export const DEFAULT_ENTITY_ADD_CORRIDOR_DESCRIPTION =
  "Add a corridor entity along a path with a fixed width, useful for roads, pipelines, or routes.";

/** Per-field model-facing `.describe()` hints for the `entityAddCorridor` input schema. */
export interface EntityAddCorridorFieldDescriptions {
  id?: string;
  corridor?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddCorridor` input field. */
export const DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS: Required<EntityAddCorridorFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    corridor: "Path positions, width in metres, corner style, and fill/outline styling.",
    name: "Display name for the entity.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddCorridor` input schema: the shared structural
 * shape ({@link entityAddCorridorInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddCorridorInputSchema(
  descriptions: EntityAddCorridorFieldDescriptions = {},
) {
  return buildDescribedSchema(
    entityAddCorridorInputShape.shape,
    DEFAULT_ENTITY_ADD_CORRIDOR_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddCorridor` input schema, using every default field hint. */
export const defaultEntityAddCorridorInputSchema = buildEntityAddCorridorInputSchema();

/** Per-tool overrides for {@link createEntityAddCorridor}. */
export type EntityAddCorridorConfig = ClientToolConfig<EntityAddCorridorFieldDescriptions>;

/**
 * `entityAddCorridor` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddCorridor = createToolFactory(
  DEFAULT_ENTITY_ADD_CORRIDOR_DESCRIPTION,
  buildEntityAddCorridorInputSchema,
);

/** Ready-to-use `entityAddCorridor` tool with default description and schema. */
export const entityAddCorridor = createEntityAddCorridor();
