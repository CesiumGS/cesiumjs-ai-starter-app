import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { buildDescribedSchema } from "../../lib/describe-shape.js";
import { globeSetLightingInputShape } from "./globeSetLighting.schema.js";

/** Default natural-language description handed to the model for `globeSetLighting`. */
export const DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION =
  "Enable or disable realistic globe lighting effects for day/night cycles.";

/** Per-field model-facing `.describe()` hints for the `globeSetLighting` input schema. */
export interface GlobeSetLightingFieldDescriptions {
  enableLighting?: string;
  enableDynamicAtmosphere?: string;
  enableSunLighting?: string;
}

/** Default **model-facing** `.describe()` hint for each `globeSetLighting` input field. */
export const DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS: Required<GlobeSetLightingFieldDescriptions> =
  {
    enableLighting: "Enable realistic lighting effects.",
    enableDynamicAtmosphere: "Enable dynamic atmosphere lighting. Defaults to true.",
    enableSunLighting: "Enable sun-position lighting. Defaults to true.",
  };

/**
 * Builds the **model-facing** `globeSetLighting` input schema: the shared structural
 * shape ({@link globeSetLightingInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildGlobeSetLightingInputSchema(
  descriptions: GlobeSetLightingFieldDescriptions = {},
) {
  return buildDescribedSchema(
    globeSetLightingInputShape.shape,
    DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS,
    descriptions,
  );
}

/** Default model-facing `globeSetLighting` input schema, using every default field hint. */
export const defaultGlobeSetLightingInputSchema = buildGlobeSetLightingInputSchema();

/** Per-tool overrides for {@link createGlobeSetLighting}. */
export type GlobeSetLightingConfig = ClientToolConfig<GlobeSetLightingFieldDescriptions>;

/**
 * `globeSetLighting` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createGlobeSetLighting = createToolFactory(
  DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION,
  buildGlobeSetLightingInputSchema,
);

/** Ready-to-use `globeSetLighting` tool with default description and schema. */
export const globeSetLighting = createGlobeSetLighting();
