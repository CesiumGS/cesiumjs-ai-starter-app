import { flyToShape } from "@cesium-ai/sample-config";
import { buildDescribedSchema, DEFAULT_FLY_TO_FIELD_DESCRIPTIONS } from "@cesium-ai/tools-cesium";

/** Default model-facing `.describe()` hints for this app's `flyTo` extension fields. */
const DEFAULT_FLY_TO_EXTENSION_DESCRIPTIONS = {
  ...DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
  duration: "Flight duration in seconds. Omit to let Cesium pick a distance-based default.",
  easingFunction: "Named easing curve applied to the flight. Omit for Cesium's default.",
};

/**
 * This app's **model-facing** `flyTo` input schema: the shared
 * {@link flyToShape} (lat/lon/altitude plus this app's `duration` and
 * `easingFunction` extension) decorated with `.describe()` hints for the LLM,
 * via the same {@link buildDescribedSchema} helper `@cesium-ai/tools-cesium`
 * uses for its own tools. The structural rules live once in
 * `@cesium-ai/sample-config`'s `flyToShape`, shared with the frontend's
 * `flyToLocation` validator — this module only adds the description text, so
 * it stays server-side and out of the client bundle.
 */
export const flyToInputSchema = buildDescribedSchema(
  flyToShape.shape,
  DEFAULT_FLY_TO_EXTENSION_DESCRIPTIONS,
);
