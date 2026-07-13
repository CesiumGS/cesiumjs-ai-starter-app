import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddRectangleInputShape } from "./entityAddRectangle.schema.js";

/** Default natural-language description handed to the model for `entityAddRectangle`. */
export const DEFAULT_ENTITY_ADD_RECTANGLE_DESCRIPTION =
  "Add a rectangle entity defined by geographic bounds, useful for regions or bounding boxes.";

/** Per-field model-facing `.describe()` hints for the `entityAddRectangle` input schema. */
export interface EntityAddRectangleFieldDescriptions {
  id?: string;
  rectangle?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddRectangle` input field. */
export const DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS: Required<EntityAddRectangleFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    rectangle: "Geographic bounds (north/south/east/west in degrees) and styling.",
    name: "Display name for the entity.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddRectangle` input schema: the shared structural
 * shape ({@link entityAddRectangleInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddRectangleInputSchema(
  descriptions: EntityAddRectangleFieldDescriptions = {},
) {
  return buildDescribedSchema(
    entityAddRectangleInputShape.shape,
    DEFAULT_ENTITY_ADD_RECTANGLE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddRectangle` input schema, using every default field hint. */
export const defaultEntityAddRectangleInputSchema = buildEntityAddRectangleInputSchema();

/** Per-tool overrides for {@link createEntityAddRectangle}. */
export type EntityAddRectangleConfig = ClientToolConfig<EntityAddRectangleFieldDescriptions>;

/**
 * `entityAddRectangle` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddRectangle = createToolFactory(
  DEFAULT_ENTITY_ADD_RECTANGLE_DESCRIPTION,
  buildEntityAddRectangleInputSchema,
);

/** Ready-to-use `entityAddRectangle` tool with default description and schema. */
export const entityAddRectangle = createEntityAddRectangle();
