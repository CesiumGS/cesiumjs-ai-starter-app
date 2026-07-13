import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraStopOrbitInputShape } from "./cameraStopOrbit.schema.js";

/** Default natural-language description handed to the model for `cameraStopOrbit`. */
export const DEFAULT_CAMERA_STOP_ORBIT_DESCRIPTION = "Stop any active automated camera orbit and return the camera to manual navigation.";

/** Per-field model-facing `.describe()` hints for the `cameraStopOrbit` input schema. */
export interface CameraStopOrbitFieldDescriptions {
  // No input fields.
}

/** Default **model-facing** `.describe()` hint for each `cameraStopOrbit` input field. */
export const DEFAULT_CAMERA_STOP_ORBIT_FIELD_DESCRIPTIONS: Required<CameraStopOrbitFieldDescriptions> = {
  // No input fields.
};

/**
 * Builds the **model-facing** `cameraStopOrbit` input schema: the shared structural
 * shape ({@link cameraStopOrbitInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraStopOrbitInputSchema(descriptions: CameraStopOrbitFieldDescriptions = {}) {
  return buildDescribedSchema(
    cameraStopOrbitInputShape.shape,
    DEFAULT_CAMERA_STOP_ORBIT_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraStopOrbit` input schema, using every default field hint. */
export const defaultCameraStopOrbitInputSchema = buildCameraStopOrbitInputSchema();

/** Per-tool overrides for {@link createCameraStopOrbit}. */
export type CameraStopOrbitConfig = ClientToolConfig<CameraStopOrbitFieldDescriptions>;

/**
 * `cameraStopOrbit` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraStopOrbit = createToolFactory(DEFAULT_CAMERA_STOP_ORBIT_DESCRIPTION, buildCameraStopOrbitInputSchema);

/** Ready-to-use `cameraStopOrbit` tool with default description and schema. */
export const cameraStopOrbit = createCameraStopOrbit();
