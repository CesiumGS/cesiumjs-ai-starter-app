import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraGetPositionInputShape } from "./cameraGetPosition.schema.js";

/** Default natural-language description handed to the model for `cameraGetPosition`. */
export const DEFAULT_CAMERA_GET_POSITION_DESCRIPTION =
  "Get the current camera position, orientation, and visible view rectangle. Use to answer questions about where the camera currently is.";

/** Per-field model-facing `.describe()` hints for the `cameraGetPosition` input schema. */
export interface CameraGetPositionFieldDescriptions {
  // No input fields.
}

/** Default **model-facing** `.describe()` hint for each `cameraGetPosition` input field. */
export const DEFAULT_CAMERA_GET_POSITION_FIELD_DESCRIPTIONS: Required<CameraGetPositionFieldDescriptions> =
  {
    // No input fields.
  };

/**
 * Builds the **model-facing** `cameraGetPosition` input schema: the shared structural
 * shape ({@link cameraGetPositionInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraGetPositionInputSchema(
  descriptions: CameraGetPositionFieldDescriptions = {},
) {
  return buildDescribedSchema(
    cameraGetPositionInputShape.shape,
    DEFAULT_CAMERA_GET_POSITION_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraGetPosition` input schema, using every default field hint. */
export const defaultCameraGetPositionInputSchema = buildCameraGetPositionInputSchema();

/** Per-tool overrides for {@link createCameraGetPosition}. */
export type CameraGetPositionConfig = ClientToolConfig<CameraGetPositionFieldDescriptions>;

/**
 * `cameraGetPosition` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraGetPosition = createToolFactory(
  DEFAULT_CAMERA_GET_POSITION_DESCRIPTION,
  buildCameraGetPositionInputSchema,
);

/** Ready-to-use `cameraGetPosition` tool with default description and schema. */
export const cameraGetPosition = createCameraGetPosition();
