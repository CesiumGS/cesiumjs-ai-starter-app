import { EasingFunction } from "cesium";
import { flyToShape, type FlyToShapeInput } from "@cesium-ai/sample-config";
import { createFlyToExecutor, type ToolExecutionResult } from "@cesium-ai/tools";

/**
 * Validated arguments for {@link flyToLocation}. The structural shape is the
 * shared {@link flyToShape} from `@cesium-ai/sample-config` — this app's
 * `flyTo` contract (the library's base lat/lon/altitude plus this app's
 * `duration`/`easingFunction` extension), the single source of truth used by
 * both the backend's model-facing schema (`backend/src/flyto-tool.ts`) and
 * this client-side executor, so adjusting the shape updates both sides at
 * once. It carries no model-facing description text, keeping tool
 * descriptions out of the client bundle (see AC #3 in the README). The
 * model's output is untrusted input at this boundary, so we validate it here
 * before driving the live Viewer rather than blind-casting.
 */
export type FlyToArgs = FlyToShapeInput;

/** Result posted back to the agent loop after a `flyTo` tool call runs. */
export type FlyToResult = ToolExecutionResult;

/**
 * Flies the CesiumJS camera to a geographic location.
 *
 * This is the **client-side executor** for the `flyTo` tool: the server streams
 * the tool call to the browser, the host routes it here against the live
 * `Viewer`, and the result is posted back so the model can confirm. The model
 * resolves the place the user named to coordinates; this executor just validates
 * and flies, so there's no runtime geocoder dependency.
 *
 * Built on `@cesium-ai/tools`'s `createFlyToExecutor` rather than a
 * from-scratch implementation: it reuses that factory's validation /
 * Cartesian3-conversion / promise / error-handling plumbing (identical to the
 * package's own default `flyTo`) and only extends what this app actually adds
 * on top — the accepted shape ({@link flyToShape}, lat/lon range-checked,
 * positive duration, known easing preset name) and the extra
 * `Camera.flyTo` options `duration`/`easingFunction` translate to. Resolves
 * `{ success: true }` once the camera animation completes, or
 * `{ success: false, error }` when the args are malformed or the flight is
 * cancelled (e.g. the user interacts with the globe mid-flight).
 */
export const flyToLocation = createFlyToExecutor<FlyToShapeInput>({
  shape: flyToShape,
  buildFlyToOptions: ({ duration, easingFunction }) => ({
    duration,
    easingFunction: easingFunction ? EasingFunction[easingFunction] : undefined,
  }),
});
