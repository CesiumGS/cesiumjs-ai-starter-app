import { z } from "zod";

/**
 * Structural input shape for the `animationListActive` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `animationListActive.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const animationListActiveInputShape = z.object({
  // No input fields.
});

/** Validated `animationListActive` input, inferred from {@link animationListActiveInputShape}. */
export type AnimationListActiveInput = z.infer<typeof animationListActiveInputShape>;
