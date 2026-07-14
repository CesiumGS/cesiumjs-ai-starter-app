import { z } from "zod";

/**
 * Structural input shape for the `animationCameraTracking` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationCameraTracking.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationCameraTrackingInputShape = z.object({
  animationId: z.string(),
  track: z.boolean(),
  range: z.number().positive().optional(),
  pitch: z.number().optional(),
  heading: z.number().optional(),
});

/** Validated `animationCameraTracking` input, inferred from {@link animationCameraTrackingInputShape}. */
export type AnimationCameraTrackingInput = z.infer<typeof animationCameraTrackingInputShape>;
