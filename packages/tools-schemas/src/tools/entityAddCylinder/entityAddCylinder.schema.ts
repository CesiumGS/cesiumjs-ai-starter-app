import { z } from "zod";

/**
 * Structural input shape for the `entityAddCylinder` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddCylinder.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddCylinderInputShape = z.object({
  id: z.string().optional(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  cylinder: z.object({ length: z.number().positive(), topRadius: z.number().nonnegative(), bottomRadius: z.number().nonnegative(), material: z.string().optional(), outline: z.boolean().optional(), outlineColor: z.string().optional() }),
  orientation: z.object({ heading: z.number().optional(), pitch: z.number().optional(), roll: z.number().optional() }).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddCylinder` input, inferred from {@link entityAddCylinderInputShape}. */
export type EntityAddCylinderInput = z.infer<typeof entityAddCylinderInputShape>;
