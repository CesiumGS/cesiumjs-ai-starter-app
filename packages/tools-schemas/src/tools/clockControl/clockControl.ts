import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { clockControlInputShape } from "./clockControl.schema.js";

/** Default natural-language description handed to the model for `clockControl`. */
export const DEFAULT_CLOCK_CONTROL_DESCRIPTION = "Configure the global animation clock shared by all animations: full setup, jumping to a time, or changing playback speed.";

/** Per-field model-facing `.describe()` hints for the `clockControl` input schema. */
export interface ClockControlFieldDescriptions {
  action?: string;
  clock?: string;
  currentTime?: string;
  multiplier?: string;
}

/** Default **model-facing** `.describe()` hint for each `clockControl` input field. */
export const DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS: Required<ClockControlFieldDescriptions> = {
  action: "Which clock operation to perform.",
  clock: "Full clock configuration, required when action is 'configure'.",
  currentTime: "ISO 8601 time to jump to, required when action is 'setTime'.",
  multiplier: "Time rate multiplier, required when action is 'setMultiplier'.",
};

/**
 * Builds the **model-facing** `clockControl` input schema: the shared structural
 * shape ({@link clockControlInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildClockControlInputSchema(descriptions: ClockControlFieldDescriptions = {}) {
  return buildDescribedSchema(
    clockControlInputShape.shape,
    DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `clockControl` input schema, using every default field hint. */
export const defaultClockControlInputSchema = buildClockControlInputSchema();

/** Per-tool overrides for {@link createClockControl}. */
export type ClockControlConfig = ClientToolConfig<ClockControlFieldDescriptions>;

/**
 * `clockControl` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createClockControl = createToolFactory(DEFAULT_CLOCK_CONTROL_DESCRIPTION, buildClockControlInputSchema);

/** Ready-to-use `clockControl` tool with default description and schema. */
export const clockControl = createClockControl();
