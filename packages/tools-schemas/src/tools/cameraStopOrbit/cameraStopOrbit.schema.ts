import { z } from "zod";

/**
 * Structural input shape for the `cameraStopOrbit` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraStopOrbit.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraStopOrbitInputShape = z.object({
  // No input fields.
});

/** Validated `cameraStopOrbit` input, inferred from {@link cameraStopOrbitInputShape}. */
export type CameraStopOrbitInput = z.infer<typeof cameraStopOrbitInputShape>;
