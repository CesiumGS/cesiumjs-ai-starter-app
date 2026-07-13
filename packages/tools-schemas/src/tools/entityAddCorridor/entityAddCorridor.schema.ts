import { z } from "zod";

/**
 * Structural input shape for the `entityAddCorridor` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `entityAddCorridor.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const entityAddCorridorInputShape = z.object({
  id: z.string().optional(),
  corridor: z.object({ positions: z.array(z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), height: z.number().optional() })).min(2), width: z.number().positive(), material: z.string().optional(), outline: z.boolean().optional(), outlineColor: z.string().optional(), cornerType: z.enum(["ROUNDED", "MITERED", "BEVELED"]).optional(), height: z.number().optional(), extrudedHeight: z.number().optional() }),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** Validated `entityAddCorridor` input, inferred from {@link entityAddCorridorInputShape}. */
export type EntityAddCorridorInput = z.infer<typeof entityAddCorridorInputShape>;
