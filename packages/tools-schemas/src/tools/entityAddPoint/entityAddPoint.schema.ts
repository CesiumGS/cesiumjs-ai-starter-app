import { z } from "zod";
import { cartographicShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `entityAddPoint` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddPoint.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddPointInputShape = z.object({
  id: z.string(),
  position: cartographicShape,
  color: z.string().optional(),
  pixelSize: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddPoint` input, inferred from {@link entityAddPointInputShape}. */
export type EntityAddPointInput = z.infer<typeof entityAddPointInputShape>;
