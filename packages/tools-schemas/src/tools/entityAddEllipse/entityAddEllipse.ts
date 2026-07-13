import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddEllipseInputShape } from "./entityAddEllipse.schema.js";

/** Default natural-language description handed to the model for `entityAddEllipse`. */
export const DEFAULT_ENTITY_ADD_ELLIPSE_DESCRIPTION = "Add an ellipse entity, useful for circular areas, zones, or coverage regions.";

/** Per-field model-facing `.describe()` hints for the `entityAddEllipse` input schema. */
export interface EntityAddEllipseFieldDescriptions {
  id?: string;
  position?: string;
  ellipse?: string;
  name?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddEllipse` input field. */
export const DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS: Required<EntityAddEllipseFieldDescriptions> = {
  id: "Unique identifier for the entity.",
  position: "Center location of the ellipse (longitude, latitude, height).",
  ellipse: "Semi-major/minor axes in metres, rotation in radians, and styling.",
  name: "Display name for the entity.",
  description: "Metadata text shown in the entity's info box.",
};

/**
 * Builds the **model-facing** `entityAddEllipse` input schema: the shared structural
 * shape ({@link entityAddEllipseInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddEllipseInputSchema(descriptions: EntityAddEllipseFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddEllipseInputShape.shape,
    DEFAULT_ENTITY_ADD_ELLIPSE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddEllipse` input schema, using every default field hint. */
export const defaultEntityAddEllipseInputSchema = buildEntityAddEllipseInputSchema();

/** Per-tool overrides for {@link createEntityAddEllipse}. */
export type EntityAddEllipseConfig = ClientToolConfig<EntityAddEllipseFieldDescriptions>;

/**
 * `entityAddEllipse` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddEllipse = createToolFactory(DEFAULT_ENTITY_ADD_ELLIPSE_DESCRIPTION, buildEntityAddEllipseInputSchema);

/** Ready-to-use `entityAddEllipse` tool with default description and schema. */
export const entityAddEllipse = createEntityAddEllipse();
