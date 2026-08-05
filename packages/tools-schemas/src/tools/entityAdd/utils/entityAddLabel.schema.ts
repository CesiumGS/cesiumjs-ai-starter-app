import { z } from "zod";
import { cartographicShape, pixelOffsetShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `label` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddLabelInputShape = z.object({
  id: z.string(),
  position: cartographicShape,
  text: z.string(),
  font: z.string().optional(),
  fillColor: z.string().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().nonnegative().optional(),
  pixelOffset: pixelOffsetShape.optional(),
  description: z.string().optional(),
});

/** Validated `label` variant input, inferred from {@link entityAddLabelInputShape}. */
export type EntityAddLabelInput = z.infer<typeof entityAddLabelInputShape>;
