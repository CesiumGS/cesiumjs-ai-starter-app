import { z } from "zod";

/**
 * Structural input shape for the `entityAddModel` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddModel.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddModelInputShape = z.object({
  id: z.string(),
  position: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() }),
  uri: z.string().url(),
  scale: z.number().positive().optional(),
  heading: z.number().optional(),
  pitch: z.number().optional(),
  roll: z.number().optional(),
  minimumPixelSize: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddModel` input, inferred from {@link entityAddModelInputShape}. */
export type EntityAddModelInput = z.infer<typeof entityAddModelInputShape>;
