import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationListActiveInputShape } from "./animationListActive.schema.js";

/** Default natural-language description handed to the model for `animationListActive`. */
export const DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION =
  "List all active animations with their current playback state and the shared clock state.";

/** Per-field model-facing `.describe()` hints for the `animationListActive` input schema. */
export interface AnimationListActiveFieldDescriptions {
  // No input fields.
}

/** Default **model-facing** `.describe()` hint for each `animationListActive` input field. */
export const DEFAULT_ANIMATION_LIST_ACTIVE_FIELD_DESCRIPTIONS: Required<AnimationListActiveFieldDescriptions> =
  {
    // No input fields.
  };

/**
 * Builds the **model-facing** `animationListActive` input schema: the shared structural
 * shape ({@link animationListActiveInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationListActiveInputSchema(
  descriptions: AnimationListActiveFieldDescriptions = {},
) {
  return buildDescribedSchema(
    animationListActiveInputShape.shape,
    DEFAULT_ANIMATION_LIST_ACTIVE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationListActive` input schema, using every default field hint. */
export const defaultAnimationListActiveInputSchema = buildAnimationListActiveInputSchema();

/** Per-tool overrides for {@link createAnimationListActive}. */
export type AnimationListActiveConfig = ClientToolConfig<AnimationListActiveFieldDescriptions>;

/**
 * `animationListActive` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationListActive = createToolFactory(
  DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION,
  buildAnimationListActiveInputSchema,
);

/** Ready-to-use `animationListActive` tool with default description and schema. */
export const animationListActive = createAnimationListActive();
