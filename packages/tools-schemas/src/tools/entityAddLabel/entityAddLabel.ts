import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddLabelInputShape } from "./entityAddLabel.schema.js";

/** Default natural-language description handed to the model for `entityAddLabel`. */
export const DEFAULT_ENTITY_ADD_LABEL_DESCRIPTION = "Add a 3D text label entity at a location on the globe.";

/** Per-field model-facing `.describe()` hints for the `entityAddLabel` input schema. */
export interface EntityAddLabelFieldDescriptions {
  id?: string;
  position?: string;
  text?: string;
  font?: string;
  fillColor?: string;
  outlineColor?: string;
  outlineWidth?: string;
  pixelOffset?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddLabel` input field. */
export const DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS: Required<EntityAddLabelFieldDescriptions> = {
  id: "Unique identifier for the entity.",
  position: "Location of the label (longitude, latitude, height).",
  text: "Label text content.",
  font: "CSS font string, e.g. '24px sans-serif'.",
  fillColor: "Text fill color. Defaults to white.",
  outlineColor: "Text outline color. Defaults to black.",
  outlineWidth: "Outline thickness in pixels. Defaults to 2.",
  pixelOffset: "Pixel offset from the anchor position.",
  description: "Metadata text shown in the entity's info box.",
};

/**
 * Builds the **model-facing** `entityAddLabel` input schema: the shared structural
 * shape ({@link entityAddLabelInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddLabelInputSchema(descriptions: EntityAddLabelFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddLabelInputShape.shape,
    DEFAULT_ENTITY_ADD_LABEL_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddLabel` input schema, using every default field hint. */
export const defaultEntityAddLabelInputSchema = buildEntityAddLabelInputSchema();

/** Per-tool overrides for {@link createEntityAddLabel}. */
export type EntityAddLabelConfig = ClientToolConfig<EntityAddLabelFieldDescriptions>;

/**
 * `entityAddLabel` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddLabel = createToolFactory(DEFAULT_ENTITY_ADD_LABEL_DESCRIPTION, buildEntityAddLabelInputSchema);

/** Ready-to-use `entityAddLabel` tool with default description and schema. */
export const entityAddLabel = createEntityAddLabel();
