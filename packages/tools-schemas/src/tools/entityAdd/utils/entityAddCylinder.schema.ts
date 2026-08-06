import { z } from "zod";
import {
  cartographicShape,
  materialOutlineShape,
  orientationShape,
} from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `cylinder` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddCylinderInputShape = z.object({
  id: z.string().optional(),
  position: cartographicShape,
  cylinder: materialOutlineShape.extend({
    length: z.number().positive(),
    topRadius: z.number().nonnegative(),
    bottomRadius: z.number().nonnegative(),
  }),
  orientation: orientationShape.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `cylinder` variant input, inferred from {@link entityAddCylinderInputShape}. */
export type EntityAddCylinderInput = z.infer<typeof entityAddCylinderInputShape>;
