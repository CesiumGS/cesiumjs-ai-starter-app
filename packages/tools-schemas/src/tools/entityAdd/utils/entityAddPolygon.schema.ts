import { z } from "zod";
import { cartographicShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `polygon` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
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

/** Validated `polygon` variant input, inferred from {@link entityAddPolygonInputShape}. */
export type EntityAddPolygonInput = z.infer<typeof entityAddPolygonInputShape>;
