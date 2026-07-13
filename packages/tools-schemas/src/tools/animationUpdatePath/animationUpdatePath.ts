import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationUpdatePathInputShape } from "./animationUpdatePath.schema.js";

/** Default natural-language description handed to the model for `animationUpdatePath`. */
export const DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION = "Update the visual appearance of an animation's path trail without recreating the animation.";

/** Per-field model-facing `.describe()` hints for the `animationUpdatePath` input schema. */
export interface AnimationUpdatePathFieldDescriptions {
  animationId?: string;
  leadTime?: string;
  trailTime?: string;
  width?: string;
  color?: string;
}

/** Default **model-facing** `.describe()` hint for each `animationUpdatePath` input field. */
export const DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS: Required<AnimationUpdatePathFieldDescriptions> = {
  animationId: "ID of the animation to update.",
  leadTime: "Seconds of path ahead of the entity to show.",
  trailTime: "Seconds of path behind the entity to show.",
  width: "Path line width in pixels.",
  color: "Path color as normalized RGBA components (0-1).",
};

/**
 * Builds the **model-facing** `animationUpdatePath` input schema: the shared structural
 * shape ({@link animationUpdatePathInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationUpdatePathInputSchema(descriptions: AnimationUpdatePathFieldDescriptions = {}) {
  return buildDescribedSchema(
    animationUpdatePathInputShape.shape,
    DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationUpdatePath` input schema, using every default field hint. */
export const defaultAnimationUpdatePathInputSchema = buildAnimationUpdatePathInputSchema();

/** Per-tool overrides for {@link createAnimationUpdatePath}. */
export type AnimationUpdatePathConfig = ClientToolConfig<AnimationUpdatePathFieldDescriptions>;

/**
 * `animationUpdatePath` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationUpdatePath = createToolFactory(DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION, buildAnimationUpdatePathInputSchema);

/** Ready-to-use `animationUpdatePath` tool with default description and schema. */
export const animationUpdatePath = createAnimationUpdatePath();
