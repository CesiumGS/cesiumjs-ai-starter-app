import { z } from "zod";

/**
 * Structural input shape for the `imageryAdd` tool — the single source of truth
 * for its args contract, shared by the server tool definition and any
 * client-side executor. Carries no model-facing description text (see
 * `imageryAdd.ts` and `flyTo.schema.ts` for the convention this follows).
 */
export const imageryAddInputShape = z.object({
  type: z.enum([
    "UrlTemplateImageryProvider",
    "WebMapServiceImageryProvider",
    "WebMapTileServiceImageryProvider",
    "ArcGisMapServerImageryProvider",
    "BingMapsImageryProvider",
    "TileMapServiceImageryProvider",
    "OpenStreetMapImageryProvider",
    "IonImageryProvider",
    "SingleTileImageryProvider",
    "GoogleEarthEnterpriseImageryProvider",
  ]),
  url: z.string().url(),
  name: z.string().optional(),
  layers: z.string().optional(),
  style: z.string().optional(),
  format: z.string().optional(),
  tileMatrixSetID: z.string().optional(),
  maximumLevel: z.number().min(0).max(30).optional(),
  minimumLevel: z.number().min(0).max(30).optional(),
  assetId: z.number().int().positive().optional(),
  key: z.string().optional(),
  alpha: z.number().min(0).max(1).optional(),
  show: z.boolean().optional(),
  rectangle: z
    .object({
      west: z.number().min(-180).max(180),
      south: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
      north: z.number().min(-90).max(90),
    })
    .optional(),
});

/** Validated `imageryAdd` input, inferred from {@link imageryAddInputShape}. */
export type ImageryAddInput = z.infer<typeof imageryAddInputShape>;
