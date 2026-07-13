import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

/**
 * Names of the CesiumJS `EasingFunction` presets this app exposes on `flyTo`,
 * mirrored 1:1 against the keys of `@cesium/engine`'s `EasingFunction` object
 * so the frontend can index into the real Cesium object with a validated name
 * (`EasingFunction[name]`) instead of a hand-kept mapping table. This file
 * never imports `cesium` itself — it's consumed by the backend too — so the
 * names are duplicated here as string literals.
 */
export const EASING_FUNCTION_NAMES = [
  "LINEAR_NONE",
  "QUADRATIC_IN",
  "QUADRATIC_OUT",
  "QUADRATIC_IN_OUT",
  "CUBIC_IN",
  "CUBIC_OUT",
  "CUBIC_IN_OUT",
  "QUARTIC_IN",
  "QUARTIC_OUT",
  "QUARTIC_IN_OUT",
  "QUINTIC_IN",
  "QUINTIC_OUT",
  "QUINTIC_IN_OUT",
  "SINUSOIDAL_IN",
  "SINUSOIDAL_OUT",
  "SINUSOIDAL_IN_OUT",
  "EXPONENTIAL_IN",
  "EXPONENTIAL_OUT",
  "EXPONENTIAL_IN_OUT",
  "CIRCULAR_IN",
  "CIRCULAR_OUT",
  "CIRCULAR_IN_OUT",
  "ELASTIC_IN",
  "ELASTIC_OUT",
  "ELASTIC_IN_OUT",
  "BACK_IN",
  "BACK_OUT",
  "BACK_IN_OUT",
  "BOUNCE_IN",
  "BOUNCE_OUT",
  "BOUNCE_IN_OUT",
] as const;

/** A valid CesiumJS `EasingFunction` preset name (see {@link EASING_FUNCTION_NAMES}). */
export type EasingFunctionName = (typeof EASING_FUNCTION_NAMES)[number];

/**
 * This app's `flyTo` structural shape — the library's base
 * {@link flyToInputShape} (lat/lon/altitude) extended with `duration` and
 * `easingFunction`, the two fields this app adds on top of the stock tool.
 * The single source of truth for the args contract, shared by both sides:
 *
 * - the **backend** layers `.describe()` hints on top of this shape and passes
 *   the result as `createCesiumTools({ flyTo: { inputSchema } })`; and
 * - the **frontend** passes this shape straight to `flyToLocation` to validate
 *   the untrusted tool-call payload before driving the live `Viewer`.
 *
 * Carries no model-facing description text on purpose (same reasoning as
 * {@link flyToInputShape}): only the structural rules live here, so the
 * frontend can import it without pulling descriptions into the client bundle.
 */
export const flyToShape = z.object({
  ...flyToInputShape.shape,
  /** Flight duration in seconds. Optional; Cesium picks a distance-based default. */
  duration: z.number().positive().optional(),
  /** Named easing preset applied to the flight. Optional; Cesium's default is used otherwise. */
  easingFunction: z.enum(EASING_FUNCTION_NAMES).optional(),
});

/** Validated `flyTo` input for this app, inferred from {@link flyToShape}. */
export type FlyToShapeInput = z.infer<typeof flyToShape>;
