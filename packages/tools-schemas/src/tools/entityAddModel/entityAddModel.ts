import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { entityAddModelInputShape } from "./entityAddModel.schema.js";

/** Default natural-language description handed to the model for `entityAddModel`. */
export const DEFAULT_ENTITY_ADD_MODEL_DESCRIPTION =
  "Add a 3D model (GLTF/GLB) entity at a location on the globe. The `uri` must be a valid URL — ask the user for their model URL or use a publicly available model.";

/** Per-field model-facing `.describe()` hints for the `entityAddModel` input schema. */
export interface EntityAddModelFieldDescriptions {
  id?: string;
  position?: string;
  uri?: string;
  scale?: string;
  heading?: string;
  pitch?: string;
  roll?: string;
  minimumPixelSize?: string;
  description?: string;
}

/** Default **model-facing** `.describe()` hint for each `entityAddModel` input field. */
export const DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS: Required<EntityAddModelFieldDescriptions> =
  {
    id: "Unique identifier for the entity.",
    position: "Location of the model (longitude, latitude, height).",
    uri: "Model file URL (.gltf or .glb).",
    scale: "Uniform size multiplier. Defaults to 1.0.",
    heading: "Rotation around the Z-axis in degrees.",
    pitch: "Rotation around the Y-axis in degrees.",
    roll: "Rotation around the X-axis in degrees.",
    minimumPixelSize: "Minimum on-screen size in pixels. Defaults to 64.",
    description: "Metadata text shown in the entity's info box.",
  };

/**
 * Builds the **model-facing** `entityAddModel` input schema: the shared structural
 * shape ({@link entityAddModelInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildEntityAddModelInputSchema(descriptions: EntityAddModelFieldDescriptions = {}) {
  return buildDescribedSchema(
    entityAddModelInputShape.shape,
    DEFAULT_ENTITY_ADD_MODEL_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `entityAddModel` input schema, using every default field hint. */
export const defaultEntityAddModelInputSchema = buildEntityAddModelInputSchema();

/** Per-tool overrides for {@link createEntityAddModel}. */
export type EntityAddModelConfig = ClientToolConfig<EntityAddModelFieldDescriptions>;

/**
 * `entityAddModel` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createEntityAddModel = createToolFactory(
  DEFAULT_ENTITY_ADD_MODEL_DESCRIPTION,
  buildEntityAddModelInputSchema,
);

/** Ready-to-use `entityAddModel` tool with default description and schema. */
export const entityAddModel = createEntityAddModel();
