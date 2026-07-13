import { z } from "zod";
import { cartographicShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `entityAddPolyline` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddPolyline.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddPolylineInputShape = z.object({
  id: z.string(),
  positions: z.array(cartographicShape).min(2),
  width: z.number().positive().optional(),
  material: z.string().optional(),
  clampToGround: z.boolean().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddPolyline` input, inferred from {@link entityAddPolylineInputShape}. */
export type EntityAddPolylineInput = z.infer<typeof entityAddPolylineInputShape>;
