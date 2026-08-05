import { z } from "zod";
import { cartographicShape } from "../../../lib/shared-shapes.js";

/**
 * Structural input shape for the `model` variant of the `entityAdd` tool —
 * the single source of truth for its args contract, shared by the server
 * tool definition and any client-side executor.
 */
export const entityAddModelInputShape = z.object({
  id: z.string(),
  position: cartographicShape,
  uri: z.string().url(),
  scale: z.number().positive().optional(),
  heading: z.number().optional(),
  pitch: z.number().optional(),
  roll: z.number().optional(),
  minimumPixelSize: z.number().positive().optional(),
  description: z.string().optional(),
});

/** Validated `model` variant input, inferred from {@link entityAddModelInputShape}. */
export type EntityAddModelInput = z.infer<typeof entityAddModelInputShape>;
