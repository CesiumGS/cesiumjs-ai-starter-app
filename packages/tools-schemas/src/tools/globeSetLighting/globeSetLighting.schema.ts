import { z } from "zod";

/**
 * Structural input shape for the `globeSetLighting` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `globeSetLighting.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const globeSetLightingInputShape = z.object({
  enableLighting: z.boolean(),
  enableDynamicAtmosphere: z.boolean().optional(),
  enableSunLighting: z.boolean().optional(),
});

/** Validated `globeSetLighting` input, inferred from {@link globeSetLightingInputShape}. */
export type GlobeSetLightingInput = z.infer<typeof globeSetLightingInputShape>;
