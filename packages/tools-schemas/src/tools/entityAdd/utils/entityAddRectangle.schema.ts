import { z } from "zod";
import { materialOutlineShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `rectangle` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddRectangleInputShape = z.object({
  id: z.string().optional(),
  rectangle: materialOutlineShape.extend({
    coordinates: z.object({
      north: z.number().min(-90).max(90),
      south: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
      west: z.number().min(-180).max(180),
    }),
    height: z.number().optional(),
    extrudedHeight: z.number().optional(),
  }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `rectangle` variant input, inferred from {@link entityAddRectangleInputShape}. */
export type EntityAddRectangleInput = z.infer<typeof entityAddRectangleInputShape>;
