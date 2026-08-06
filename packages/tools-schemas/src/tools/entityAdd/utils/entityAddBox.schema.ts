import { z } from "zod";
import {
  cartographicShape,
  materialOutlineShape,
  orientationShape,
} from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `box` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddBoxInputShape = z.object({
  id: z.string().optional(),
  position: cartographicShape,
  box: materialOutlineShape.extend({
    dimensions: z.object({
      x: z.number().positive(),
      y: z.number().positive(),
      z: z.number().positive(),
    }),
  }),
  orientation: orientationShape.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `box` variant input, inferred from {@link entityAddBoxInputShape}. */
export type EntityAddBoxInput = z.infer<typeof entityAddBoxInputShape>;
