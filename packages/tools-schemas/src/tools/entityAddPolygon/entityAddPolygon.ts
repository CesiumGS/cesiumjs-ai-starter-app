import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddPolygonInputShape } from "./entityAddPolygon.schema.js";

/** Default natural-language description handed to the model for `entityAddPolygon`. */
export const DEFAULT_ENTITY_ADD_POLYGON_DESCRIPTION =
  "Add a filled polygon area entity, useful for boundaries, zones, or regions.";

/** Per-field model-facing `.describe()` hints for the `entityAddPolygon` input schema. */
export interface EntityAddPolygonFieldDescriptions {
  id?: string;
  positions?: string;
  material?: string;
  outlineColor?: string;
  outlineWidth?: string;
  height?: string;
  extrudedHeight?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddPolygon` input field. */
export const DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS: Required<EntityAddPolygonFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    positions: "Array of corner positions, at least 3.",
    material: "Fill color. Defaults to semi-transparent yellow.",
    outlineColor: "Outline color. Defaults to black.",
    outlineWidth: "Outline thickness in pixels. Defaults to 2.",
    height: "Polygon altitude in metres.",
    extrudedHeight: "Extrusion height for a 3D volume.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddPolygon` input schema: the shared structural
 * shape ({@link entityAddPolygonInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddPolygonInputSchema(
  descriptions: EntityAddPolygonFieldDescriptions = {},
) {
  return buildDescribedSchema(
    entityAddPolygonInputShape.shape,
    DEFAULT_ENTITY_ADD_POLYGON_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddPolygon` input schema, using every default field hint. */
export const defaultEntityAddPolygonInputSchema = buildEntityAddPolygonInputSchema();

/** Per-tool overrides for {@link createEntityAddPolygon}. */
export type EntityAddPolygonConfig = ClientToolConfig<EntityAddPolygonFieldDescriptions>;

/**
 * `entityAddPolygon` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddPolygon = createToolFactory(
  DEFAULT_ENTITY_ADD_POLYGON_DESCRIPTION,
  buildEntityAddPolygonInputSchema,
);

/** Ready-to-use `entityAddPolygon` tool with default description and schema. */
export const entityAddPolygon = createEntityAddPolygon();
