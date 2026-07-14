import { z } from "zod";
import { cartographicShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `entityAddPolygon` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddPolygon.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddPolygonInputShape = z.object({
  id: z.string(),
  positions: z.array(cartographicShape).min(3),
  material: z.string().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().nonnegative().optional(),
  height: z.number().optional(),
  extrudedHeight: z.number().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddPolygon` input, inferred from {@link entityAddPolygonInputShape}. */
export type EntityAddPolygonInput = z.infer<typeof entityAddPolygonInputShape>;
