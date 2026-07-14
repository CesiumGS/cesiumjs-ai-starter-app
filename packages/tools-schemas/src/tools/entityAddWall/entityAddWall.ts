import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddWallInputShape } from "./entityAddWall.schema.js";

/** Default natural-language description handed to the model for `entityAddWall`. */
export const DEFAULT_ENTITY_ADD_WALL_DESCRIPTION =
  "Add a vertical wall entity from a series of positions, useful for barriers or fences.";

/** Per-field model-facing `.describe()` hints for the `entityAddWall` input schema. */
export interface EntityAddWallFieldDescriptions {
  id?: string;
  wall?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddWall` input field. */
export const DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS: Required<EntityAddWallFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    wall: "Path positions plus minimum/maximum heights along the wall, and styling.",
    name: "Display name for the entity.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddWall` input schema: the shared structural
 * shape ({@link entityAddWallInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddWallInputSchema(descriptions: EntityAddWallFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddWallInputShape.shape,
    DEFAULT_ENTITY_ADD_WALL_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddWall` input schema, using every default field hint. */
export const defaultEntityAddWallInputSchema = buildEntityAddWallInputSchema();

/** Per-tool overrides for {@link createEntityAddWall}. */
export type EntityAddWallConfig = ClientToolConfig<EntityAddWallFieldDescriptions>;

/**
 * `entityAddWall` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddWall = createToolFactory(
  DEFAULT_ENTITY_ADD_WALL_DESCRIPTION,
  buildEntityAddWallInputSchema,
);

/** Ready-to-use `entityAddWall` tool with default description and schema. */
export const entityAddWall = createEntityAddWall();
