import { describe, expect, test } from "vitest";
import { Cartesian3, EasingFunction, type Viewer } from "cesium";
import { flyToLocation } from "./camera";

// Expected ECEF destination for Paris (lon 2.3522, lat 48.8566, alt 15000 m),
// computed with the project's own Cesium so the test tracks the WGS84 ellipsoid
// the helper actually uses. This is the camera target flyToLocation must produce
// for these coordinates.
const PARIS = Cartesian3.fromDegrees(2.3522, 48.8566, 15000);

/**
 * Exercises the real `flyToLocation` executor (frontend/src/tools/camera.ts),
 * driving it with a fake Viewer whose `camera.flyTo` we control. This validates
 * the client-side half of the `flyTo` tool-call path — argument validation,
 * Cartesian3 conversion, and the success/error result contract — without an Ion
 * token, an LLM key, or a browser: `Cartesian3.fromDegrees` is pure ellipsoid
 * math, so the executor runs fully in Node.
 */
describe("flyToLocation camera helper", () => {
  test("flies to given coordinates and resolves { success: true }", async () => {
    let destination: { x: number; y: number; z: number } | null = null;
    const fakeViewer = {
      camera: {
        flyTo: (opts: {
          destination: { x: number; y: number; z: number };
          complete: () => void;
        }) => {
          // Capture the camera target, then simulate the animation finishing.
          destination = { x: opts.destination.x, y: opts.destination.y, z: opts.destination.z };
          opts.complete();
        },
      },
    };

    const result = await flyToLocation(fakeViewer as never, {
      latitude: 48.8566,
      longitude: 2.3522,
      altitude: 15000,
    });

    expect(result).toEqual({ success: true });
    expect(destination).not.toBeNull();
    expect(destination!.x).toBeCloseTo(PARIS.x, 0);
    expect(destination!.y).toBeCloseTo(PARIS.y, 0);
    expect(destination!.z).toBeCloseTo(PARIS.z, 0);
  });

  test("applies a default altitude when none is provided", async () => {
    let destination: { x: number; y: number; z: number } | null = null;
    const fakeViewer = {
      camera: {
        flyTo: (opts: {
          destination: { x: number; y: number; z: number };
          complete: () => void;
        }) => {
          destination = { x: opts.destination.x, y: opts.destination.y, z: opts.destination.z };
          opts.complete();
        },
      },
    };

    // Altitude omitted — executor should fall back to its default (15000 m).
    const result = await flyToLocation(fakeViewer as never, {
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(result).toEqual({ success: true });
    expect(destination!.x).toBeCloseTo(PARIS.x, 0);
    expect(destination!.y).toBeCloseTo(PARIS.y, 0);
    expect(destination!.z).toBeCloseTo(PARIS.z, 0);
  });

  test("resolves { success: false, error } for out-of-range coordinates without flying", async () => {
    let flew = false;
    const fakeViewer = {
      camera: {
        flyTo: () => {
          flew = true;
        },
      },
    } as unknown as Viewer;

    const badLat = await flyToLocation(fakeViewer, { latitude: 200, longitude: 0 });
    const badLon = await flyToLocation(fakeViewer, { latitude: 0, longitude: 999 });

    expect(flew).toBe(false);
    expect(badLat.success).toBe(false);
    expect(badLon.success).toBe(false);
    expect(badLat.error).toContain("Invalid flyTo arguments");
  });

  test("resolves { success: false, error } for malformed args without flying", async () => {
    let flew = false;
    const fakeViewer = {
      camera: {
        flyTo: () => {
          flew = true;
        },
      },
    } as unknown as Viewer;

    // The model could emit a wrong shape: missing field, wrong type.
    const missing = await flyToLocation(fakeViewer, { latitude: 48.8566 });
    const empty = await flyToLocation(fakeViewer, {});
    const wrongType = await flyToLocation(fakeViewer, { latitude: "x", longitude: 2 });

    expect(flew).toBe(false);
    expect(missing.success).toBe(false);
    expect(empty.success).toBe(false);
    expect(wrongType.success).toBe(false);
    expect(missing.error).toContain("Invalid flyTo arguments");
  });

  test("forwards duration and resolves a named easingFunction to the real Cesium callback", async () => {
    let flyToOpts: { duration?: number; easingFunction?: unknown } | null = null;
    const fakeViewer = {
      camera: {
        flyTo: (opts: { duration?: number; easingFunction?: unknown; complete: () => void }) => {
          flyToOpts = { duration: opts.duration, easingFunction: opts.easingFunction };
          opts.complete();
        },
      },
    };

    const result = await flyToLocation(fakeViewer as never, {
      latitude: 48.8566,
      longitude: 2.3522,
      duration: 3,
      easingFunction: "QUADRATIC_IN_OUT",
    });

    expect(result).toEqual({ success: true });
    expect(flyToOpts!.duration).toBe(3);
    expect(flyToOpts!.easingFunction).toBe(EasingFunction.QUADRATIC_IN_OUT);
  });

  test("resolves { success: false, error } for an unknown easingFunction name without flying", async () => {
    let flew = false;
    const fakeViewer = {
      camera: {
        flyTo: () => {
          flew = true;
        },
      },
    } as unknown as Viewer;

    const result = await flyToLocation(fakeViewer, {
      latitude: 0,
      longitude: 0,
      easingFunction: "NOT_A_REAL_EASING",
    });

    expect(flew).toBe(false);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid flyTo arguments");
  });

  test("resolves { success: false } when the flight is cancelled", async () => {
    const fakeViewer = {
      camera: {
        flyTo: (opts: { cancel: () => void }) => opts.cancel(),
      },
    };

    const outcome = await flyToLocation(fakeViewer as never, {
      latitude: 51.5074,
      longitude: -0.1278,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBeTruthy();
  });
});
