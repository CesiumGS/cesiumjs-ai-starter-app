import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { animationCreateInputShape } from "./animationCreate.schema.js";

/** Default natural-language description handed to the model for `animationCreate`. */
export const DEFAULT_ANIMATION_CREATE_DESCRIPTION = "Create an animated 3D model entity that moves along a path defined by explicit position samples with timestamps.";

/** Per-field model-facing `.describe()` hints for the `animationCreate` input schema. */
export interface AnimationCreateFieldDescriptions {
  positionSamples?: string;
  name?: string;
  startTime?: string;
  stopTime?: string;
  interpolationAlgorithm?: string;
  showPath?: string;
  modelPreset?: string;
  modelUri?: string;
  modelScale?: string;
  loopMode?: string;
  clampToGround?: string;
  speedMultiplier?: string;
  autoPlay?: string;
  trackCamera?: string;
}

/** Default **model-facing** `.describe()` hint for each `animationCreate` input field. */
export const DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS: Required<AnimationCreateFieldDescriptions> = {
  positionSamples: "Array of position samples, each with an ISO 8601 timestamp plus longitude, latitude, and optional height.",
  name: "Human-readable name for the animation.",
  startTime: "Animation start time (ISO 8601). Defaults to the first sample's time.",
  stopTime: "Animation stop time (ISO 8601). Defaults to the last sample's time.",
  interpolationAlgorithm: "Path interpolation method. Defaults to LAGRANGE.",
  showPath: "Show the path trail visualization. Defaults to true.",
  modelPreset: "Built-in model preset. Defaults to cesium_man.",
  modelUri: "Custom glTF/glb model URI, overriding modelPreset.",
  modelScale: "Model scale factor. Defaults to 1.",
  loopMode: "Playback loop behaviour. Defaults to none.",
  clampToGround: "Clamp the entity to terrain. Defaults to false.",
  speedMultiplier: "Playback speed multiplier (0.1-100). Defaults to 10.",
  autoPlay: "Start the animation immediately after creation. Defaults to true.",
  trackCamera: "Automatically track the entity with the camera. Defaults to true.",
};

/**
 * Builds the **model-facing** `animationCreate` input schema: the shared structural
 * shape ({@link animationCreateInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildAnimationCreateInputSchema(descriptions: AnimationCreateFieldDescriptions = {}) {
  return buildDescribedSchema(
    animationCreateInputShape.shape,
    DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `animationCreate` input schema, using every default field hint. */
export const defaultAnimationCreateInputSchema = buildAnimationCreateInputSchema();

/** Per-tool overrides for {@link createAnimationCreate}. */
export type AnimationCreateConfig = ClientToolConfig<AnimationCreateFieldDescriptions>;

/**
 * `animationCreate` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createAnimationCreate = createToolFactory(DEFAULT_ANIMATION_CREATE_DESCRIPTION, buildAnimationCreateInputSchema);

/** Ready-to-use `animationCreate` tool with default description and schema. */
export const animationCreate = createAnimationCreate();
