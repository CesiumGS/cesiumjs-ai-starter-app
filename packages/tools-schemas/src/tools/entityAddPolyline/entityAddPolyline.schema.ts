import { z } from "zod";

/**
 * Structural input shape for the `entityAddPolyline` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddPolyline.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddPolylineInputShape = z.object({
  id: z.string(),
  positions: z.array(z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() })).min(2),
  width: z.number().positive().optional(),
  material: z.string().optional(),
  clampToGround: z.boolean().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddPolyline` input, inferred from {@link entityAddPolylineInputShape}. */
export type EntityAddPolylineInput = z.infer<typeof entityAddPolylineInputShape>;
