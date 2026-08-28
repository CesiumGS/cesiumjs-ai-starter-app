import { z } from "zod";

/**
 * Structural input shape for the `geoJsonRemove` tool — the single source of
 * truth for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `geoJsonRemove.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const geoJsonRemoveInputShape = z.object({
  name: z.string().optional(),
  removeAll: z.boolean().optional(),
});

/** Validated `geoJsonRemove` input, inferred from {@link geoJsonRemoveInputShape}. */
export type GeoJsonRemoveInput = z.infer<typeof geoJsonRemoveInputShape>;
