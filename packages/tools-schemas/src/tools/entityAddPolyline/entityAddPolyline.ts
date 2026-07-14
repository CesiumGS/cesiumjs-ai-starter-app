import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddPolylineInputShape } from "./entityAddPolyline.schema.js";

/** Default natural-language description handed to the model for `entityAddPolyline`. */
export const DEFAULT_ENTITY_ADD_POLYLINE_DESCRIPTION =
  "Add a polyline path entity connecting multiple points, useful for routes or boundaries.";

/** Per-field model-facing `.describe()` hints for the `entityAddPolyline` input schema. */
export interface EntityAddPolylineFieldDescriptions {
  id?: string;
  positions?: string;
  width?: string;
  material?: string;
  clampToGround?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddPolyline` input field. */
export const DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS: Required<EntityAddPolylineFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    positions: "Array of path positions, at least 2.",
    width: "Line width in pixels. Defaults to 3.",
    material: "Line color. Defaults to yellow.",
    clampToGround: "Follow terrain instead of flying at fixed height. Defaults to false.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddPolyline` input schema: the shared structural
 * shape ({@link entityAddPolylineInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddPolylineInputSchema(
  descriptions: EntityAddPolylineFieldDescriptions = {},
) {
  return buildDescribedSchema(
    entityAddPolylineInputShape.shape,
    DEFAULT_ENTITY_ADD_POLYLINE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddPolyline` input schema, using every default field hint. */
export const defaultEntityAddPolylineInputSchema = buildEntityAddPolylineInputSchema();

/** Per-tool overrides for {@link createEntityAddPolyline}. */
export type EntityAddPolylineConfig = ClientToolConfig<EntityAddPolylineFieldDescriptions>;

/**
 * `entityAddPolyline` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddPolyline = createToolFactory(
  DEFAULT_ENTITY_ADD_POLYLINE_DESCRIPTION,
  buildEntityAddPolylineInputSchema,
);

/** Ready-to-use `entityAddPolyline` tool with default description and schema. */
export const entityAddPolyline = createEntityAddPolyline();
