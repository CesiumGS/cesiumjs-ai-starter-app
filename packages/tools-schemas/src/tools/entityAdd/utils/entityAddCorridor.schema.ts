import { z } from "zod";
import { cartographicShape, materialOutlineShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `corridor` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddCorridorInputShape = z.object({
  id: z.string().optional(),
  corridor: materialOutlineShape.extend({
    positions: z.array(cartographicShape).min(2),
    width: z.number().positive(),
    cornerType: z.enum(["ROUNDED", "MITERED", "BEVELED"]).optional(),
    height: z.number().optional(),
    extrudedHeight: z.number().optional(),
  }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `corridor` variant input, inferred from {@link entityAddCorridorInputShape}. */
export type EntityAddCorridorInput = z.infer<typeof entityAddCorridorInputShape>;
