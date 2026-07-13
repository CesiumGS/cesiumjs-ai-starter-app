import { z } from "zod";

/**
 * Structural input shape for the `cameraSetView` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraSetView.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraSetViewInputShape = z.object({
  destination: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  orientation: z.object({ heading: z.number().optional(), pitch: z.number().optional(), roll: z.number().optional() }).optional(),
});

/** Validated `cameraSetView` input, inferred from {@link cameraSetViewInputShape}. */
export type CameraSetViewInput = z.infer<typeof cameraSetViewInputShape>;
