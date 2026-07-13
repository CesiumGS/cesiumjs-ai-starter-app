import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { cameraSetViewInputShape } from "./cameraSetView.schema.js";

/** Default natural-language description handed to the model for `cameraSetView`. */
export const DEFAULT_CAMERA_SET_VIEW_DESCRIPTION =
  "Instantly set the 3D globe camera's position and orientation with no animated flight — a hard cut rather than a smooth flight (see flyTo for an animated transition). Use when the user wants to jump directly to a view.";

/** Per-field model-facing `.describe()` hints for the `cameraSetView` input schema. */
export interface CameraSetViewFieldDescriptions {
  destination?: string;
  orientation?: string;
}

/** Default **model-facing** `.describe()` hint for each `cameraSetView` input field. */
export const DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS: Required<CameraSetViewFieldDescriptions> =
  {
    destination: "Target camera position (longitude, latitude, height).",
    orientation:
      "Camera orientation in degrees (heading, pitch, roll). Omit to keep Cesium's default look-down orientation.",
  };

/**
 * Builds the **model-facing** `cameraSetView` input schema: the shared structural
 * shape ({@link cameraSetViewInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraSetViewInputSchema(descriptions: CameraSetViewFieldDescriptions = {}) {
  return buildDescribedSchema(
    cameraSetViewInputShape.shape,
    DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `cameraSetView` input schema, using every default field hint. */
export const defaultCameraSetViewInputSchema = buildCameraSetViewInputSchema();

/** Per-tool overrides for {@link createCameraSetView}. */
export type CameraSetViewConfig = ClientToolConfig<CameraSetViewFieldDescriptions>;

/**
 * `cameraSetView` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraSetView = createToolFactory(
  DEFAULT_CAMERA_SET_VIEW_DESCRIPTION,
  buildCameraSetViewInputSchema,
);

/** Ready-to-use `cameraSetView` tool with default description and schema. */
export const cameraSetView = createCameraSetView();
