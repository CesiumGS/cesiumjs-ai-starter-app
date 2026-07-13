import { z } from "zod";

/**
 * Structural input shape for the `entityAddWall` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddWall.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddWallInputShape = z.object({
  id: z.string().optional(),
  wall: z.object({ positions: z.array(z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() })).min(2), minimumHeights: z.array(z.number()).optional(), maximumHeights: z.array(z.number()), material: z.string().optional(), outline: z.boolean().optional(), outlineColor: z.string().optional() }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddWall` input, inferred from {@link entityAddWallInputShape}. */
export type EntityAddWallInput = z.infer<typeof entityAddWallInputShape>;
