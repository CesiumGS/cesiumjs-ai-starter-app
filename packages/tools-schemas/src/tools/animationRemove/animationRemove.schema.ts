import { z } from "zod";

/**
 * Structural input shape for the `animationRemove` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationRemove.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationRemoveInputShape = z.object({
  animationId: z.string(),
});

/** Validated `animationRemove` input, inferred from {@link animationRemoveInputShape}. */
export type AnimationRemoveInput = z.infer<typeof animationRemoveInputShape>;
