import { z } from "zod";
import { cartographicShape, pixelOffsetShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `billboard` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddBillboardInputShape = z.object({
  id: z.string(),
  position: cartographicShape,
  image: z.string(),
  pixelOffset: pixelOffsetShape.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `billboard` variant input, inferred from {@link entityAddBillboardInputShape}. */
export type EntityAddBillboardInput = z.infer<typeof entityAddBillboardInputShape>;
