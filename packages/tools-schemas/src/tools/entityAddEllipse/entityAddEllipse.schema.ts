import { z } from "zod";

/**
 * Structural input shape for the `entityAddEllipse` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddEllipse.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddEllipseInputShape = z.object({
  id: z.string().optional(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  ellipse: z.object({ semiMajorAxis: z.number().positive(), semiMinorAxis: z.number().positive(), material: z.string().optional(), outline: z.boolean().optional(), outlineColor: z.string().optional(), rotation: z.number().optional(), height: z.number().optional(), extrudedHeight: z.number().optional() }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddEllipse` input, inferred from {@link entityAddEllipseInputShape}. */
export type EntityAddEllipseInput = z.infer<typeof entityAddEllipseInputShape>;
