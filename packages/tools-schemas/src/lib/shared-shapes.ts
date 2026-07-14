import { z } from "zod";

/**
 * Reusable structural zod fragments shared across multiple tools' input
 * shapes (e.g. every `entityAdd*` tool takes a geographic position). Extracted
 * here so a change to shared bounds/fields (like the lon/lat range) only needs
 * to happen once. These carry no `.describe()` text — see the per-tool
 * `<toolName>.ts` module for the model-facing hints layered on top.
 */

/** A geographic position: longitude/latitude in degrees, optional height in metres. */
export const cartographicShape = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  height: z.number().optional(),
});

/** Heading/pitch/roll orientation, in degrees, all optional. */
export const orientationShape = z.object({
  heading: z.number().optional(),
  pitch: z.number().optional(),
  roll: z.number().optional(),
});

/** A 2D pixel offset, e.g. for billboard/label screen-space positioning. */
export const pixelOffsetShape = z.object({
  x: z.number(),
  y: z.number(),
});

/** The material/outline styling fields shared by the filled-shape entity tools. */
export const materialOutlineShape = z.object({
  material: z.string().optional(),
  outline: z.boolean().optional(),
  outlineColor: z.string().optional(),
});
