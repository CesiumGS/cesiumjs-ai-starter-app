import { z } from "zod";

/**
 * Structural input shape for the `cameraLookAtTransform` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraLookAtTransform.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraLookAtTransformInputShape = z.object({
  target: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  offset: z.object({ heading: z.number().optional(), pitch: z.number().optional(), range: z.number().positive().optional() }).optional(),
});

/** Validated `cameraLookAtTransform` input, inferred from {@link cameraLookAtTransformInputShape}. */
export type CameraLookAtTransformInput = z.infer<typeof cameraLookAtTransformInputShape>;
