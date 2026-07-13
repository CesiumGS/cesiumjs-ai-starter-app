import { z } from "zod";

/**
 * Structural input shape for the `cameraGetPosition` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraGetPosition.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraGetPositionInputShape = z.object({
  // No input fields.
});

/** Validated `cameraGetPosition` input, inferred from {@link cameraGetPositionInputShape}. */
export type CameraGetPositionInput = z.infer<typeof cameraGetPositionInputShape>;
