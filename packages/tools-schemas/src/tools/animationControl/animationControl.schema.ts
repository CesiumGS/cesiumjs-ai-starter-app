import { z } from "zod";

/**
 * Structural input shape for the `animationControl` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationControl.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationControlInputShape = z.object({
  animationId: z.string(),
  action: z.enum(["play", "pause"]),
});

/** Validated `animationControl` input, inferred from {@link animationControlInputShape}. */
export type AnimationControlInput = z.infer<typeof animationControlInputShape>;
