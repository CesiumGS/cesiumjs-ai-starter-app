import { z } from "zod";

/**
 * Structural input shape for the `cameraStartOrbit` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraStartOrbit.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraStartOrbitInputShape = z.object({
  speed: z.number().min(0.1).max(10).optional(),
  direction: z.enum(["clockwise", "counterclockwise"]).optional(),
});

/** Validated `cameraStartOrbit` input, inferred from {@link cameraStartOrbitInputShape}. */
export type CameraStartOrbitInput = z.infer<typeof cameraStartOrbitInputShape>;
