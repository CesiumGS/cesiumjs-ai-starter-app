import { z } from "zod";

/**
 * Structural input shape for the `animationUpdatePath` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationUpdatePath.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationUpdatePathInputShape = z.object({
  animationId: z.string(),
  leadTime: z.number().nonnegative().optional(),
  trailTime: z.number().nonnegative().optional(),
  width: z.number().positive().optional(),
  color: z.object({ red: z.number().min(0).max(1), green: z.number().min(0).max(1), blue: z.number().min(0).max(1), alpha: z.number().min(0).max(1).optional() }).optional(),
});

/** Validated `animationUpdatePath` input, inferred from {@link animationUpdatePathInputShape}. */
export type AnimationUpdatePathInput = z.infer<typeof animationUpdatePathInputShape>;
