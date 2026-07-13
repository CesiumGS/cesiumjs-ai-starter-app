import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationControlInputShape } from "./animationControl.schema.js";

/** Default natural-language description handed to the model for `animationControl`. */
export const DEFAULT_ANIMATION_CONTROL_DESCRIPTION = "Play or pause a specific animation's playback.";

/** Per-field model-facing `.describe()` hints for the `animationControl` input schema. */
export interface AnimationControlFieldDescriptions {
  animationId?: string;
  action?: string;
}

/** Default **model-facing** `.describe()` hint for each `animationControl` input field. */
export const DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS: Required<AnimationControlFieldDescriptions> = {
  animationId: "ID of the animation to control.",
  action: "'play' to start or resume, 'pause' to freeze.",
};

/**
 * Builds the **model-facing** `animationControl` input schema: the shared structural
 * shape ({@link animationControlInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationControlInputSchema(descriptions: AnimationControlFieldDescriptions = {}) {
  return buildDescribedSchema(
    animationControlInputShape.shape,
    DEFAULT_ANIMATION_CONTROL_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationControl` input schema, using every default field hint. */
export const defaultAnimationControlInputSchema = buildAnimationControlInputSchema();

/** Per-tool overrides for {@link createAnimationControl}. */
export type AnimationControlConfig = ClientToolConfig<AnimationControlFieldDescriptions>;

/**
 * `animationControl` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationControl = createToolFactory(DEFAULT_ANIMATION_CONTROL_DESCRIPTION, buildAnimationControlInputSchema);

/** Ready-to-use `animationControl` tool with default description and schema. */
export const animationControl = createAnimationControl();
