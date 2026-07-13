import { z } from "zod";

/**
 * Structural input shape for the `animationCreate` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationCreate.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationCreateInputShape = z.object({
  positionSamples: z.array(z.object({ time: z.string(), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() })).min(2),
  name: z.string().optional(),
  startTime: z.string().optional(),
  stopTime: z.string().optional(),
  interpolationAlgorithm: z.enum(["LINEAR", "LAGRANGE", "HERMITE"]).optional(),
  showPath: z.boolean().optional(),
  modelPreset: z.enum(["cesium_man", "car", "bike", "airplane"]).optional(),
  modelUri: z.string().url().optional(),
  modelScale: z.number().positive().optional(),
  loopMode: z.enum(["none", "loop", "pingpong"]).optional(),
  clampToGround: z.boolean().optional(),
  speedMultiplier: z.number().min(0.1).max(100).optional(),
  autoPlay: z.boolean().optional(),
  trackCamera: z.boolean().optional(),
});

/** Validated `animationCreate` input, inferred from {@link animationCreateInputShape}. */
export type AnimationCreateInput = z.infer<typeof animationCreateInputShape>;
