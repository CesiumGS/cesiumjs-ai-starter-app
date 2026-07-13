import { z } from "zod";

/**
 * Structural input shape for the `entityAddBox` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddBox.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddBoxInputShape = z.object({
  id: z.string().optional(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  box: z.object({ dimensions: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }), material: z.string().optional(), outline: z.boolean().optional(), outlineColor: z.string().optional() }),
  orientation: z.object({ heading: z.number().optional(), pitch: z.number().optional(), roll: z.number().optional() }).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddBox` input, inferred from {@link entityAddBoxInputShape}. */
export type EntityAddBoxInput = z.infer<typeof entityAddBoxInputShape>;
