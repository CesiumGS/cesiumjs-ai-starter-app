import { z } from "zod";

/**
 * Structural input shape for the `entityAddBillboard` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddBillboard.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddBillboardInputShape = z.object({
  id: z.string(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  image: z.string(),
  pixelOffset: z.object({ x: z.number(), y: z.number() }).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddBillboard` input, inferred from {@link entityAddBillboardInputShape}. */
export type EntityAddBillboardInput = z.infer<typeof entityAddBillboardInputShape>;
