import { z } from "zod";

/**
 * Structural input shape for the `imageryRemove` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `imageryRemove.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const imageryRemoveInputShape = z.object({
  index: z.number().int().nonnegative().optional(),
  name: z.string().optional(),
  removeAll: z.boolean().optional(),
});

/** Validated `imageryRemove` input, inferred from {@link imageryRemoveInputShape}. */
export type ImageryRemoveInput = z.infer<typeof imageryRemoveInputShape>;
