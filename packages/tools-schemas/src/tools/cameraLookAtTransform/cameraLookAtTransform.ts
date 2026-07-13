import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraLookAtTransformInputShape } from "./cameraLookAtTransform.schema.js";

/** Default natural-language description handed to the model for `cameraLookAtTransform`. */
export const DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION =
  "Lock the camera to look at a fixed target point on the globe, useful for inspecting a landmark or setting up an orbit. Pair with cameraStartOrbit to begin an automated orbit around this target.";

/** Per-field model-facing `.describe()` hints for the `cameraLookAtTransform` input schema. */
export interface CameraLookAtTransformFieldDescriptions {
  target?: string;
  offset?: string;
}

/** Default **model-facing** `.describe()` hint for each `cameraLookAtTransform` input field. */
export const DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS: Required<CameraLookAtTransformFieldDescriptions> =
  {
    target: "The point on Earth the camera should look at (longitude, latitude, height).",
    offset: "Camera offset from the target: heading/pitch in degrees, range (distance) in metres.",
  };

/**
 * Builds the **model-facing** `cameraLookAtTransform` input schema: the shared structural
 * shape ({@link cameraLookAtTransformInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraLookAtTransformInputSchema(
  descriptions: CameraLookAtTransformFieldDescriptions = {},
) {
  return buildDescribedSchema(
    cameraLookAtTransformInputShape.shape,
    DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraLookAtTransform` input schema, using every default field hint. */
export const defaultCameraLookAtTransformInputSchema = buildCameraLookAtTransformInputSchema();

/** Per-tool overrides for {@link createCameraLookAtTransform}. */
export type CameraLookAtTransformConfig = ClientToolConfig<CameraLookAtTransformFieldDescriptions>;

/**
 * `cameraLookAtTransform` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraLookAtTransform = createToolFactory(
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION,
  buildCameraLookAtTransformInputSchema,
);

/** Ready-to-use `cameraLookAtTransform` tool with default description and schema. */
export const cameraLookAtTransform = createCameraLookAtTransform();
