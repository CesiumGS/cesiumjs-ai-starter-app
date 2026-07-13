import { z } from "zod";

/**
 * Structural input shape for the `entityRemove` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityRemove.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityRemoveInputShape = z.object({
  id: z.string(),
});

/** Validated `entityRemove` input, inferred from {@link entityRemoveInputShape}. */
export type EntityRemoveInput = z.infer<typeof entityRemoveInputShape>;
