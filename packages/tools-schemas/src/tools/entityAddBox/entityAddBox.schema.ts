import { z } from "zod";
import {
  cartographicShape,
  materialOutlineShape,
  orientationShape,
} from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `entityAddBox` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddBox.ts` and `flyTo.schema.ts` for the convention this follows).
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

/** Validated `entityAddBox` input, inferred from {@link entityAddBoxInputShape}. */
export type EntityAddBoxInput = z.infer<typeof entityAddBoxInputShape>;
