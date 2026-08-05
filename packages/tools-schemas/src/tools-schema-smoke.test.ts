import { describe, expect, test } from "vitest";
import * as tools from "./index.js";
import { CESIUM_TOOL_NAMES } from "./tool-names.js";

/**
 * Smoke test for every non-`flyTo` tool added alongside the camera / entity /
 * animation / imagery tool surface. `flyTo` already has its own dedicated
 * schema + schema-sync suites; this file exists so every *new* tool gets at
 * least one valid-input/invalid-input check without duplicating a full test
 * file per tool.
 */
const VALID: Record<string, unknown> = {
  cameraSetView: { destination: { longitude: 0, latitude: 0, height: 1000 } },
  cameraLookAtTransform: { target: { longitude: 0, latitude: 0 } },
  cameraOrbit: { action: "start", speed: 2, direction: "clockwise" },
  cameraGetPosition: {},
  cameraSetControllerOptions: { enableZoom: false, maximumZoomDistance: 20000 },
  entityAdd: {
    type: "point",
    data: { id: "p1", position: { longitude: 0, latitude: 0 }, color: "red" },
  },
  entityList: {},
  entityRemove: { id: "p1" },
  animationCreate: {
    positionSamples: [
      { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
      { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
    ],
  },
  animationRemove: { animationId: "a1" },
  animationListActive: {},
  animationUpdatePath: { animationId: "a1", width: 4 },
  animationCameraTracking: { animationId: "a1", track: true },
  clockControl: { action: "setMultiplier", multiplier: 100 },
  globeSetLighting: { enableLighting: true },
  imageryAdd: { type: "OpenStreetMapImageryProvider", url: "https://tile.openstreetmap.org" },
  imageryRemove: { removeAll: true },
  imageryList: {},
};

const INVALID: Record<string, unknown> = {
  cameraSetView: { destination: { longitude: 200, latitude: 0 } },
  cameraLookAtTransform: { target: { longitude: 0, latitude: 999 } },
  cameraOrbit: { action: "start", speed: 100 },
  cameraSetControllerOptions: { maximumZoomDistance: -5 },
  entityAdd: { type: "point", data: { position: { longitude: 0, latitude: 0 } } }, // missing id
  entityRemove: {}, // missing id
  animationCreate: {
    positionSamples: [{ time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 }],
  }, // < 2 samples
  animationRemove: {}, // missing animationId
  animationUpdatePath: { animationId: "a1", color: { red: 2, green: 0, blue: 0 } }, // red out of range
  animationCameraTracking: { animationId: "a1" }, // missing track
  clockControl: { action: "unknown" }, // invalid enum
  globeSetLighting: {}, // missing enableLighting
  imageryAdd: { type: "NotAProvider", url: "https://example.com" }, // invalid enum
  imageryList: { includeDetails: "yes" }, // wrong type
};

describe("new Cesium tool schemas", () => {
  for (const name of Object.values(CESIUM_TOOL_NAMES)) {
    if (name === "flyTo") continue; // covered by its own dedicated test suites

    test(`${name}: default schema accepts a valid example`, () => {
      const buildFn = (tools as Record<string, unknown>)[
        `build${name[0].toUpperCase()}${name.slice(1)}InputSchema`
      ] as (() => { safeParse: (v: unknown) => { success: boolean } }) | undefined;
      expect(buildFn, `missing build${name}InputSchema export`).toBeTypeOf("function");

      const schema = buildFn!();
      const result = schema.safeParse(VALID[name]);
      expect(result.success, `expected ${name} to accept ${JSON.stringify(VALID[name])}`).toBe(
        true,
      );
    });

    if (INVALID[name] !== undefined) {
      test(`${name}: default schema rejects an invalid example`, () => {
        const buildFn = (tools as Record<string, unknown>)[
          `build${name[0].toUpperCase()}${name.slice(1)}InputSchema`
        ] as (() => { safeParse: (v: unknown) => { success: boolean } }) | undefined;

        const schema = buildFn!();
        const result = schema.safeParse(INVALID[name]);
        expect(result.success, `expected ${name} to reject ${JSON.stringify(INVALID[name])}`).toBe(
          false,
        );
      });
    }
  }
});
