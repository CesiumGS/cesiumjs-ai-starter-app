import { z } from "zod";

/**
 * Structural input shape for the `entityAddLabel` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddLabel.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddLabelInputShape = z.object({
  id: z.string(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  text: z.string(),
  font: z.string().optional(),
  fillColor: z.string().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().nonnegative().optional(),
  pixelOffset: z.object({ x: z.number(), y: z.number() }).optional(),
  description: z.string().optional(),
});

/** Validated `entityAddLabel` input, inferred from {@link entityAddLabelInputShape}. */
export type EntityAddLabelInput = z.infer<typeof entityAddLabelInputShape>;
