import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddCylinderInputShape } from "./entityAddCylinder.schema.js";

/** Default natural-language description handed to the model for `entityAddCylinder`. */
export const DEFAULT_ENTITY_ADD_CYLINDER_DESCRIPTION =
  "Add a cylinder or cone entity, useful for towers, pillars, or volumetric structures.";

/** Per-field model-facing `.describe()` hints for the `entityAddCylinder` input schema. */
export interface EntityAddCylinderFieldDescriptions {
  id?: string;
  position?: string;
  cylinder?: string;
  orientation?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddCylinder` input field. */
export const DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS: Required<EntityAddCylinderFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    position: "Location of the cylinder (longitude, latitude, height).",
    cylinder: "Length (height), top/bottom radius (differ for a cone), and styling.",
    orientation: "Cylinder orientation in degrees (heading, pitch, roll).",
    name: "Display name for the entity.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddCylinder` input schema: the shared structural
 * shape ({@link entityAddCylinderInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddCylinderInputSchema(
  descriptions: EntityAddCylinderFieldDescriptions = {},
) {
  return buildDescribedSchema(
    entityAddCylinderInputShape.shape,
    DEFAULT_ENTITY_ADD_CYLINDER_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddCylinder` input schema, using every default field hint. */
export const defaultEntityAddCylinderInputSchema = buildEntityAddCylinderInputSchema();

/** Per-tool overrides for {@link createEntityAddCylinder}. */
export type EntityAddCylinderConfig = ClientToolConfig<EntityAddCylinderFieldDescriptions>;

/**
 * `entityAddCylinder` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddCylinder = createToolFactory(
  DEFAULT_ENTITY_ADD_CYLINDER_DESCRIPTION,
  buildEntityAddCylinderInputSchema,
);

/** Ready-to-use `entityAddCylinder` tool with default description and schema. */
export const entityAddCylinder = createEntityAddCylinder();
