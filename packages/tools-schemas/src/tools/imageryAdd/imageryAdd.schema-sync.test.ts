import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultImageryAddInputSchema } from "./imageryAdd.js";
import { imageryAddInputShape } from "./imageryAdd.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, types, numeric bounds, enums) on one
 * side without the other — e.g. by hardcoding constraints inside
 * `buildImageryAddInputSchema` instead of deriving them from the shared
 * `imageryAddInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "baseline valid",
    input: { type: "OpenStreetMapImageryProvider", url: "https://tile.openstreetmap.org" },
    valid: true,
  },
  {
    name: "name included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      name: "OSM",
    },
    valid: true,
  },
  {
    name: "layers included",
    input: {
      type: "WebMapServiceImageryProvider",
      url: "https://example.com/wms",
      layers: "roads",
    },
    valid: true,
  },
  {
    name: "style included",
    input: {
      type: "WebMapServiceImageryProvider",
      url: "https://example.com/wms",
      style: "default",
    },
    valid: true,
  },
  {
    name: "format included",
    input: {
      type: "WebMapServiceImageryProvider",
      url: "https://example.com/wms",
      format: "image/png",
    },
    valid: true,
  },
  {
    name: "tileMatrixSetID included",
    input: {
      type: "WebMapTileServiceImageryProvider",
      url: "https://example.com/wmts",
      tileMatrixSetID: "EPSG:3857",
    },
    valid: true,
  },
  {
    name: "maximumLevel included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      maximumLevel: 10,
    },
    valid: true,
  },
  {
    name: "minimumLevel included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      minimumLevel: 2,
    },
    valid: true,
  },
  {
    name: "assetId included",
    input: {
      type: "IonImageryProvider",
      url: "https://api.cesium.com",
      assetId: 123,
    },
    valid: true,
  },
  {
    name: "key included",
    input: {
      type: "BingMapsImageryProvider",
      url: "https://dev.virtualearth.net",
      key: "bing-key",
    },
    valid: true,
  },
  {
    name: "alpha included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      alpha: 0.5,
    },
    valid: true,
  },
  {
    name: "show included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      show: false,
    },
    valid: true,
  },
  {
    name: "rectangle included",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: -5, east: 10, north: 5 },
    },
    valid: true,
  },
  {
    name: "UrlTemplateImageryProvider enum",
    input: { type: "UrlTemplateImageryProvider", url: "https://example.com/tiles/{z}/{x}/{y}.png" },
    valid: true,
  },
  {
    name: "WebMapServiceImageryProvider enum",
    input: { type: "WebMapServiceImageryProvider", url: "https://example.com/wms" },
    valid: true,
  },
  {
    name: "WebMapTileServiceImageryProvider enum",
    input: { type: "WebMapTileServiceImageryProvider", url: "https://example.com/wmts" },
    valid: true,
  },
  {
    name: "ArcGisMapServerImageryProvider enum",
    input: { type: "ArcGisMapServerImageryProvider", url: "https://example.com/arcgis" },
    valid: true,
  },
  {
    name: "BingMapsImageryProvider enum",
    input: { type: "BingMapsImageryProvider", url: "https://dev.virtualearth.net" },
    valid: true,
  },
  {
    name: "TileMapServiceImageryProvider enum",
    input: { type: "TileMapServiceImageryProvider", url: "https://example.com/tms" },
    valid: true,
  },
  {
    name: "OpenStreetMapImageryProvider enum",
    input: { type: "OpenStreetMapImageryProvider", url: "https://tile.openstreetmap.org" },
    valid: true,
  },
  {
    name: "IonImageryProvider enum",
    input: { type: "IonImageryProvider", url: "https://api.cesium.com" },
    valid: true,
  },
  {
    name: "SingleTileImageryProvider enum",
    input: { type: "SingleTileImageryProvider", url: "https://example.com/world.png" },
    valid: true,
  },
  {
    name: "GoogleEarthEnterpriseImageryProvider enum",
    input: {
      type: "GoogleEarthEnterpriseImageryProvider",
      url: "https://example.com/google-earth",
    },
    valid: true,
  },
  {
    name: "maximumLevel lower bound 0",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      maximumLevel: 0,
    },
    valid: true,
  },
  {
    name: "maximumLevel upper bound 30",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      maximumLevel: 30,
    },
    valid: true,
  },
  {
    name: "maximumLevel below range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      maximumLevel: -0.1,
    },
    valid: false,
  },
  {
    name: "maximumLevel above range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      maximumLevel: 30.1,
    },
    valid: false,
  },
  {
    name: "minimumLevel lower bound 0",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      minimumLevel: 0,
    },
    valid: true,
  },
  {
    name: "minimumLevel upper bound 30",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      minimumLevel: 30,
    },
    valid: true,
  },
  {
    name: "minimumLevel below range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      minimumLevel: -0.1,
    },
    valid: false,
  },
  {
    name: "minimumLevel above range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      minimumLevel: 30.1,
    },
    valid: false,
  },
  {
    name: "assetId lower bound 1",
    input: {
      type: "IonImageryProvider",
      url: "https://api.cesium.com",
      assetId: 1,
    },
    valid: true,
  },
  {
    name: "assetId zero invalid",
    input: {
      type: "IonImageryProvider",
      url: "https://api.cesium.com",
      assetId: 0,
    },
    valid: false,
  },
  {
    name: "assetId non-integer invalid",
    input: {
      type: "IonImageryProvider",
      url: "https://api.cesium.com",
      assetId: 1.5,
    },
    valid: false,
  },
  {
    name: "alpha lower bound 0",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      alpha: 0,
    },
    valid: true,
  },
  {
    name: "alpha upper bound 1",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      alpha: 1,
    },
    valid: true,
  },
  {
    name: "alpha below range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      alpha: -0.01,
    },
    valid: false,
  },
  {
    name: "alpha above range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      alpha: 1.01,
    },
    valid: false,
  },
  {
    name: "rectangle west lower bound -180",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -180, south: 0, east: 10, north: 10 },
    },
    valid: true,
  },
  {
    name: "rectangle west below range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -180.0001, south: 0, east: 10, north: 10 },
    },
    valid: false,
  },
  {
    name: "rectangle east upper bound 180",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: 0, east: 180, north: 10 },
    },
    valid: true,
  },
  {
    name: "rectangle east above range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: 0, east: 180.0001, north: 10 },
    },
    valid: false,
  },
  {
    name: "rectangle south lower bound -90",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: -90, east: 10, north: 10 },
    },
    valid: true,
  },
  {
    name: "rectangle south below range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: -90.0001, east: 10, north: 10 },
    },
    valid: false,
  },
  {
    name: "rectangle north upper bound 90",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: -10, east: 10, north: 90 },
    },
    valid: true,
  },
  {
    name: "rectangle north above range",
    input: {
      type: "OpenStreetMapImageryProvider",
      url: "https://tile.openstreetmap.org",
      rectangle: { west: -10, south: -10, east: 10, north: 90.0001 },
    },
    valid: false,
  },
  { name: "invalid type enum", input: { type: "NotAProvider", url: "https://example.com" }, valid: false }, // prettier-ignore
  { name: "missing type", input: { url: "https://tile.openstreetmap.org" }, valid: false },
  { name: "missing url", input: { type: "OpenStreetMapImageryProvider" }, valid: false },
  { name: "empty object", input: {}, valid: false },
  {
    name: "wrong url type",
    input: { type: "OpenStreetMapImageryProvider", url: 123 },
    valid: false,
  },
  {
    name: "invalid url format",
    input: { type: "OpenStreetMapImageryProvider", url: "not-a-url" },
    valid: false,
  },
];

describe("imageryAdd schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultImageryAddInputSchema.safeParse(input).success;
      const frontend = imageryAddInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
