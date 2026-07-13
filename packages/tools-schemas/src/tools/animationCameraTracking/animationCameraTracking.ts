import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationCameraTrackingInputShape } from "./animationCameraTracking.schema.js";

/** Default natural-language description handed to the model for `animationCameraTracking`. */
export const DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION = "Make the camera follow a specific animated entity, or stop tracking to restore free camera control.";

/** Per-field model-facing `.describe()` hints for the `animationCameraTracking` input schema. */
export interface AnimationCameraTrackingFieldDescriptions {
  animationId?: string;
  track?: string;
  range?: string;
  pitch?: string;
  heading?: string;
}

/** Default **model-facing** `.describe()` hint for each `animationCameraTracking` input field. */
export const DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS: Required<AnimationCameraTrackingFieldDescriptions> = {
  animationId: "ID of the animation to track or untrack.",
  track: "true to start tracking, false to stop tracking.",
  range: "Camera distance from the entity in metres. Defaults to 1000.",
  pitch: "Camera pitch angle in degrees. Defaults to -45.",
  heading: "Camera heading angle offset in degrees. Defaults to 0.",
};

/**
 * Builds the **model-facing** `animationCameraTracking` input schema: the shared structural
 * shape ({@link animationCameraTrackingInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationCameraTrackingInputSchema(descriptions: AnimationCameraTrackingFieldDescriptions = {}) {
  return buildDescribedSchema(
    animationCameraTrackingInputShape.shape,
    DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationCameraTracking` input schema, using every default field hint. */
export const defaultAnimationCameraTrackingInputSchema = buildAnimationCameraTrackingInputSchema();

/** Per-tool overrides for {@link createAnimationCameraTracking}. */
export type AnimationCameraTrackingConfig = ClientToolConfig<AnimationCameraTrackingFieldDescriptions>;

/**
 * `animationCameraTracking` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationCameraTracking = createToolFactory(DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION, buildAnimationCameraTrackingInputSchema);

/** Ready-to-use `animationCameraTracking` tool with default description and schema. */
export const animationCameraTracking = createAnimationCameraTracking();
