import { z } from "zod";

/**
 * Structural input shape for the `entityList` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityList.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityListInputShape = z.object({
  // No input fields.
});

/** Validated `entityList` input, inferred from {@link entityListInputShape}. */
export type EntityListInput = z.infer<typeof entityListInputShape>;
