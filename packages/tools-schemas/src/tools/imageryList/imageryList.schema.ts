import { z } from "zod";

/**
 * Structural input shape for the `imageryList` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `imageryList.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const imageryListInputShape = z.object({
  includeDetails: z.boolean().optional(),
});

/** Validated `imageryList` input, inferred from {@link imageryListInputShape}. */
export type ImageryListInput = z.infer<typeof imageryListInputShape>;
