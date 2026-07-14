import { z } from "zod";

/**
 * Structural input shape for the `cameraSetControllerOptions` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraSetControllerOptions.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraSetControllerOptionsInputShape = z.object({
  enableRotate: z.boolean().optional(),
  enableTranslate: z.boolean().optional(),
  enableZoom: z.boolean().optional(),
  enableTilt: z.boolean().optional(),
  enableLook: z.boolean().optional(),
  maximumZoomDistance: z.number().positive().optional(),
  minimumZoomDistance: z.number().positive().optional(),
  enableCollisionDetection: z.boolean().optional(),
});

/** Validated `cameraSetControllerOptions` input, inferred from {@link cameraSetControllerOptionsInputShape}. */
export type CameraSetControllerOptionsInput = z.infer<typeof cameraSetControllerOptionsInputShape>;
