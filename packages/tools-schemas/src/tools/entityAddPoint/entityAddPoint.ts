import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddPointInputShape } from "./entityAddPoint.schema.js";

/** Default natural-language description handed to the model for `entityAddPoint`. */
export const DEFAULT_ENTITY_ADD_POINT_DESCRIPTION =
  "Add a colored point marker entity at a location on the globe.";

/** Per-field model-facing `.describe()` hints for the `entityAddPoint` input schema. */
export interface EntityAddPointFieldDescriptions {
  id?: string;
  position?: string;
  color?: string;
  pixelSize?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddPoint` input field. */
export const DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS: Required<EntityAddPointFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    position: "Location of the point (longitude, latitude, height).",
    color: "Point color (CSS color name or hex code). Defaults to yellow.",
    pixelSize: "Size in pixels. Defaults to 10.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddPoint` input schema: the shared structural
 * shape ({@link entityAddPointInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddPointInputSchema(descriptions: EntityAddPointFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddPointInputShape.shape,
    DEFAULT_ENTITY_ADD_POINT_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddPoint` input schema, using every default field hint. */
export const defaultEntityAddPointInputSchema = buildEntityAddPointInputSchema();

/** Per-tool overrides for {@link createEntityAddPoint}. */
export type EntityAddPointConfig = ClientToolConfig<EntityAddPointFieldDescriptions>;

/**
 * `entityAddPoint` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddPoint = createToolFactory(
  DEFAULT_ENTITY_ADD_POINT_DESCRIPTION,
  buildEntityAddPointInputSchema,
);

/** Ready-to-use `entityAddPoint` tool with default description and schema. */
export const entityAddPoint = createEntityAddPoint();
