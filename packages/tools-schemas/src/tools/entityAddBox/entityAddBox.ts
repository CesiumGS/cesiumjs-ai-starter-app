import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddBoxInputShape } from "./entityAddBox.schema.js";

/** Default natural-language description handed to the model for `entityAddBox`. */
export const DEFAULT_ENTITY_ADD_BOX_DESCRIPTION = "Add a 3D box entity, useful for buildings, containers, or volumetric data.";

/** Per-field model-facing `.describe()` hints for the `entityAddBox` input schema. */
export interface EntityAddBoxFieldDescriptions {
  id?: string;
  position?: string;
  box?: string;
  orientation?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddBox` input field. */
export const DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS: Required<EntityAddBoxFieldDescriptions> = {
  id: "Unique identifier for the entity.",
  position: "Location of the box (longitude, latitude, height).",
  box: "Box dimensions (x, y, z in metres) and styling.",
  orientation: "Box orientation in degrees (heading, pitch, roll).",
  name: "Display name for the entity.",
  description: "Metadata text shown in the entity's info box.",
};

/**
 * Builds the **model-facing** `entityAddBox` input schema: the shared structural
 * shape ({@link entityAddBoxInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddBoxInputSchema(descriptions: EntityAddBoxFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddBoxInputShape.shape,
    DEFAULT_ENTITY_ADD_BOX_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddBox` input schema, using every default field hint. */
export const defaultEntityAddBoxInputSchema = buildEntityAddBoxInputSchema();

/** Per-tool overrides for {@link createEntityAddBox}. */
export type EntityAddBoxConfig = ClientToolConfig<EntityAddBoxFieldDescriptions>;

/**
 * `entityAddBox` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddBox = createToolFactory(DEFAULT_ENTITY_ADD_BOX_DESCRIPTION, buildEntityAddBoxInputSchema);

/** Ready-to-use `entityAddBox` tool with default description and schema. */
export const entityAddBox = createEntityAddBox();
