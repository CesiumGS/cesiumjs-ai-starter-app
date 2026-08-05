import { z } from "zod";
import { cartographicShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `polyline` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddPolylineInputShape = z.object({
  id: z.string(),
  positions: z.array(cartographicShape).min(2),
  width: z.number().positive().optional(),
  material: z.string().optional(),
  clampToGround: z.boolean().optional(),
  description: z.string().optional(),
});

/** Validated `polyline` variant input, inferred from {@link entityAddPolylineInputShape}. */
export type EntityAddPolylineInput = z.infer<typeof entityAddPolylineInputShape>;
