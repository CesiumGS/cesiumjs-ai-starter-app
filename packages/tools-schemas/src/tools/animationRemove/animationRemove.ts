import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationRemoveInputShape } from "./animationRemove.schema.js";

/** Default natural-language description handed to the model for `animationRemove`. */
export const DEFAULT_ANIMATION_REMOVE_DESCRIPTION = "Remove an animated entity from the scene and stop tracking it.";

/** Per-field model-facing `.describe()` hints for the `animationRemove` input schema. */
export interface AnimationRemoveFieldDescriptions {
  animationId?: string;
}

/** Default **model-facing** `.describe()` hint for each `animationRemove` input field. */
export const DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS: Required<AnimationRemoveFieldDescriptions> = {
  animationId: "ID of the animation to remove.",
};

/**
 * Builds the **model-facing** `animationRemove` input schema: the shared structural
 * shape ({@link animationRemoveInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationRemoveInputSchema(descriptions: AnimationRemoveFieldDescriptions = {}) {
  return buildDescribedSchema(
    animationRemoveInputShape.shape,
    DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationRemove` input schema, using every default field hint. */
export const defaultAnimationRemoveInputSchema = buildAnimationRemoveInputSchema();

/** Per-tool overrides for {@link createAnimationRemove}. */
export type AnimationRemoveConfig = ClientToolConfig<AnimationRemoveFieldDescriptions>;

/**
 * `animationRemove` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationRemove = createToolFactory(DEFAULT_ANIMATION_REMOVE_DESCRIPTION, buildAnimationRemoveInputSchema);

/** Ready-to-use `animationRemove` tool with default description and schema. */
export const animationRemove = createAnimationRemove();
