import { z } from "zod";
import { cartographicShape, orientationShape } from "../../lib/shared-shapes.js";

/**
 * Structural input shape for the `cameraSetView` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `cameraSetView.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const cameraSetViewInputShape = z.object({
  destination: cartographicShape,
  orientation: orientationShape.optional(),
});

/** Validated `cameraSetView` input, inferred from {@link cameraSetViewInputShape}. */
export type CameraSetViewInput = z.infer<typeof cameraSetViewInputShape>;
