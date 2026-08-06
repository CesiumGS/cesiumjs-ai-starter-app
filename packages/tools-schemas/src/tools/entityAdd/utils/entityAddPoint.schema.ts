import { z } from "zod";
import { cartographicShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `point` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddPointInputShape = z.object({
  id: z.string(),
  position: cartographicShape,
  color: z.string().optional(),
  pixelSize: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `point` variant input, inferred from {@link entityAddPointInputShape}. */
export type EntityAddPointInput = z.infer<typeof entityAddPointInputShape>;
