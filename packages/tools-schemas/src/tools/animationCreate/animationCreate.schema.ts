import { z } from "zod";
import { cartographicShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `animationCreate` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationCreate.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationCreateInputShape = z.object({
  positionSamples: z.array(cartographicShape.extend({ time: z.string() })).min(2),
  name: z.string().optional(),
  startTime: z.string().optional(),
  stopTime: z.string().optional(),
  interpolationAlgorithm: z.enum(["LINEAR", "LAGRANGE", "HERMITE"]).optional(),
  showPath: z.boolean().optional(),
  modelPreset: z.enum(["cesium_man", "car", "bike", "airplane"]).optional(),
  modelUri: z.string().optional(),
  modelScale: z.number().positive().optional(),
  loopMode: z.enum(["none", "loop", "pingpong"]).optional(),
  clampToGround: z.boolean().optional(),
  speedMultiplier: z.number().min(0.1).max(100).optional(),
  autoPlay: z.boolean().optional(),
  trackCamera: z.boolean().optional(),
});

/** Validated `animationCreate` input, inferred from {@link animationCreateInputShape}. */
export type AnimationCreateInput = z.infer<typeof animationCreateInputShape>;
