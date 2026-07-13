import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraStartOrbitInputShape } from "./cameraStartOrbit.schema.js";

/** Default natural-language description handed to the model for `cameraStartOrbit`. */
export const DEFAULT_CAMERA_START_ORBIT_DESCRIPTION = "Start an automated circular orbit of the camera around the current look-at target (set via cameraLookAtTransform).";

/** Per-field model-facing `.describe()` hints for the `cameraStartOrbit` input schema. */
export interface CameraStartOrbitFieldDescriptions {
  speed?: string;
  direction?: string;
}

/** Default **model-facing** `.describe()` hint for each `cameraStartOrbit` input field. */
export const DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS: Required<CameraStartOrbitFieldDescriptions> = {
  speed: "Orbit speed multiplier (0.1-10). Defaults to 1.0.",
  direction: "Orbit direction. Defaults to clockwise.",
};

/**
 * Builds the **model-facing** `cameraStartOrbit` input schema: the shared structural
 * shape ({@link cameraStartOrbitInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraStartOrbitInputSchema(descriptions: CameraStartOrbitFieldDescriptions = {}) {
  return buildDescribedSchema(
    cameraStartOrbitInputShape.shape,
    DEFAULT_CAMERA_START_ORBIT_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraStartOrbit` input schema, using every default field hint. */
export const defaultCameraStartOrbitInputSchema = buildCameraStartOrbitInputSchema();

/** Per-tool overrides for {@link createCameraStartOrbit}. */
export type CameraStartOrbitConfig = ClientToolConfig<CameraStartOrbitFieldDescriptions>;

/**
 * `cameraStartOrbit` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraStartOrbit = createToolFactory(DEFAULT_CAMERA_START_ORBIT_DESCRIPTION, buildCameraStartOrbitInputSchema);

/** Ready-to-use `cameraStartOrbit` tool with default description and schema. */
export const cameraStartOrbit = createCameraStartOrbit();
