import { z } from "zod";

/**
 * Structural input shapes for the CesiumJS tools — the **single source of truth
 * for the args contract**, shared by the server tool definitions and the
 * client-side executors. Adjust a shape here and both sides update together.
 *
 * These carry NO model-facing description text: the `.describe()` hints and the
 * human-readable tool `description` (which the LLM reads, and which can reveal
 * capabilities) are layered on server-side in the per-tool modules — see
 * `flyTo.ts` and AC #3 in the README. This file imports only `zod`, never `ai`
 * or the tool registry, so the frontend can import it to validate the untrusted
 * args it receives without pulling tool *definitions* into the client bundle.
 */
export const flyToInputShape = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Camera height above the ellipsoid, in metres. Optional; defaults applied client-side. */
  altitude: z.number().positive().optional(),
});

/** Validated `flyTo` input, inferred from {@link flyToInputShape}. */
export type FlyToInput = z.infer<typeof flyToInputShape>;
