import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddBillboardInputShape } from "./entityAddBillboard.schema.js";

/** Default natural-language description handed to the model for `entityAddBillboard`. */
export const DEFAULT_ENTITY_ADD_BILLBOARD_DESCRIPTION = "Add an image/icon billboard entity that always faces the camera.";

/** Per-field model-facing `.describe()` hints for the `entityAddBillboard` input schema. */
export interface EntityAddBillboardFieldDescriptions {
  id?: string;
  position?: string;
  image?: string;
  pixelOffset?: string;
  width?: string;
  height?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddBillboard` input field. */
export const DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS: Required<EntityAddBillboardFieldDescriptions> = {
  id: "Unique identifier for the entity.",
  position: "Location of the billboard (longitude, latitude, height).",
  image: "Image URL (data URI or external URL).",
  pixelOffset: "Pixel offset from the anchor position.",
  width: "Image width in pixels.",
  height: "Image height in pixels.",
  description: "Metadata text shown in the entity's info box.",
};

/**
 * Builds the **model-facing** `entityAddBillboard` input schema: the shared structural
 * shape ({@link entityAddBillboardInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddBillboardInputSchema(descriptions: EntityAddBillboardFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddBillboardInputShape.shape,
    DEFAULT_ENTITY_ADD_BILLBOARD_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddBillboard` input schema, using every default field hint. */
export const defaultEntityAddBillboardInputSchema = buildEntityAddBillboardInputSchema();

/** Per-tool overrides for {@link createEntityAddBillboard}. */
export type EntityAddBillboardConfig = ClientToolConfig<EntityAddBillboardFieldDescriptions>;

/**
 * `entityAddBillboard` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddBillboard = createToolFactory(DEFAULT_ENTITY_ADD_BILLBOARD_DESCRIPTION, buildEntityAddBillboardInputSchema);

/** Ready-to-use `entityAddBillboard` tool with default description and schema. */
export const entityAddBillboard = createEntityAddBillboard();
