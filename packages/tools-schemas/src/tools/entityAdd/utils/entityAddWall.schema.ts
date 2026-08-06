import { z } from "zod";
import { cartographicShape, materialOutlineShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `wall` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddWallInputShape = z.object({
  id: z.string().optional(),
  wall: materialOutlineShape.extend({
    positions: z.array(cartographicShape).min(2),
    minimumHeights: z.array(z.number()).optional(),
    maximumHeights: z.array(z.number()),
  }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `wall` variant input, inferred from {@link entityAddWallInputShape}. */
export type EntityAddWallInput = z.infer<typeof entityAddWallInputShape>;
