import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraSetControllerOptionsInputShape } from "./cameraSetControllerOptions.schema.js";

/** Default natural-language description handed to the model for `cameraSetControllerOptions`. */
export const DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION = "Configure camera movement constraints and controller behaviour: enable or disable rotate/pan/zoom/tilt/look, set zoom distance limits, and toggle collision detection.";

/** Per-field model-facing `.describe()` hints for the `cameraSetControllerOptions` input schema. */
export interface CameraSetControllerOptionsFieldDescriptions {
  enableRotate?: string;
  enableTranslate?: string;
  enableZoom?: string;
  enableTilt?: string;
  enableLook?: string;
  maximumZoomDistance?: string;
  minimumZoomDistance?: string;
  enableCollisionDetection?: string;
}

/** Default **model-facing** `.describe()` hint for each `cameraSetControllerOptions` input field. */
export const DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS: Required<CameraSetControllerOptionsFieldDescriptions> = {
  enableRotate: "Allow camera rotation.",
  enableTranslate: "Allow camera panning.",
  enableZoom: "Allow zoom in/out.",
  enableTilt: "Allow pitch adjustment.",
  enableLook: "Allow free-look mode.",
  maximumZoomDistance: "Maximum zoom-out distance in metres.",
  minimumZoomDistance: "Minimum zoom-in distance in metres.",
  enableCollisionDetection: "Prevent the camera from going underground.",
};

/**
 * Builds the **model-facing** `cameraSetControllerOptions` input schema: the shared structural
 * shape ({@link cameraSetControllerOptionsInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraSetControllerOptionsInputSchema(descriptions: CameraSetControllerOptionsFieldDescriptions = {}) {
  return buildDescribedSchema(
    cameraSetControllerOptionsInputShape.shape,
    DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraSetControllerOptions` input schema, using every default field hint. */
export const defaultCameraSetControllerOptionsInputSchema = buildCameraSetControllerOptionsInputSchema();

/** Per-tool overrides for {@link createCameraSetControllerOptions}. */
export type CameraSetControllerOptionsConfig = ClientToolConfig<CameraSetControllerOptionsFieldDescriptions>;

/**
 * `cameraSetControllerOptions` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraSetControllerOptions = createToolFactory(DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION, buildCameraSetControllerOptionsInputSchema);

/** Ready-to-use `cameraSetControllerOptions` tool with default description and schema. */
export const cameraSetControllerOptions = createCameraSetControllerOptions();
