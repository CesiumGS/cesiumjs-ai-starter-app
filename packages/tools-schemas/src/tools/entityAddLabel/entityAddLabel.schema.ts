import { z } from "zod";
import { cartographicShape, pixelOffsetShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `entityAddLabel` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddLabel.ts` and `flyTo.schema.ts` for the convention this follows).
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

/** Validated `entityAddLabel` input, inferred from {@link entityAddLabelInputShape}. */
export type EntityAddLabelInput = z.infer<typeof entityAddLabelInputShape>;
