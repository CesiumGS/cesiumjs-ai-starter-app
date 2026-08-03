import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Cartesian3, EasingFunction, type Viewer } from "cesium";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";
import { createFlyToExecutor, flyTo } from "./fly-to.js";

// Same expected ECEF destination the frontend's own `flyToLocation` test uses
// (Paris, lon 2.3522, lat 48.8566, alt 15000 m) — computed with this
// package's own Cesium so the test tracks the WGS84 ellipsoid the executor
// actually uses.
const PARIS = Cartesian3.fromDegrees(2.3522, 48.8566, 15000);

describe("default flyTo executor", () => {
  test("flies to given coordinates and resolves { success: true }", async () => {
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
    } as unknown as Viewer;

    const result = await flyTo(fakeViewer, {
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
    } as unknown as Viewer;

    const result = await flyTo(fakeViewer, { latitude: 48.8566, longitude: 2.3522 });

    expect(result).toEqual({ success: true });
    expect(destination!.x).toBeCloseTo(PARIS.x, 0);
  });

  test("resolves { success: false, error } for out-of-range coordinates without flying", async () => {
    let flew = false;
    const fakeViewer = { camera: { flyTo: () => (flew = true) } } as unknown as Viewer;

    const result = await flyTo(fakeViewer, { latitude: 200, longitude: 0 });

    expect(flew).toBe(false);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid flyTo arguments");
  });

  test("resolves { success: false, error } when the flight is cancelled", async () => {
    const fakeViewer = {
      camera: {
        flyTo: (opts: { cancel: () => void }) => opts.cancel(),
      },
    } as unknown as Viewer;

    const result = await flyTo(fakeViewer, { latitude: 0, longitude: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("cancelled");
  });

  test("this package's default flyTo has no duration/easingFunction support (extension point)", async () => {
    let sawDuration: unknown;
    let sawEasing: unknown;
    const fakeViewer = {
      camera: {
        flyTo: (opts: { duration?: unknown; easingFunction?: unknown; complete: () => void }) => {
          sawDuration = opts.duration;
          sawEasing = opts.easingFunction;
          opts.complete();
        },
      },
    } as unknown as Viewer;

    // The model could try to pass extra fields — they're simply ignored by the base
    // shape, demonstrating why a host that wants `duration`/`easingFunction` (like this
    // repo's own sample app, see README) should extend via `createFlyToExecutor`
    // instead of configuring this default directly.
    await flyTo(fakeViewer, {
      latitude: 0,
      longitude: 0,
      duration: 5,
      easingFunction: EasingFunction.LINEAR_NONE,
    });

    expect(sawDuration).toBeUndefined();
    expect(sawEasing).toBeUndefined();
  });
});

describe("createFlyToExecutor", () => {
  const extendedShape = z.object({
    ...flyToInputShape.shape,
    duration: z.number().positive().optional(),
  });

  test("passes buildFlyToOptions' extra options through to camera.flyTo", async () => {
    let sawDuration: unknown;
    const fakeViewer = {
      camera: {
        flyTo: (opts: { duration?: unknown; complete: () => void }) => {
          sawDuration = opts.duration;
          opts.complete();
        },
      },
    } as unknown as Viewer;

    const extendedFlyTo = createFlyToExecutor<z.infer<typeof extendedShape>>({
      shape: extendedShape,
      buildFlyToOptions: (data) => ({ duration: data.duration }),
    });

    const result = await extendedFlyTo(fakeViewer, { latitude: 0, longitude: 0, duration: 7 });

    expect(result).toEqual({ success: true });
    expect(sawDuration).toBe(7);
  });

  test("still validates against the extended shape before flying (reuses the base plumbing)", async () => {
    let flew = false;
    const fakeViewer = { camera: { flyTo: () => (flew = true) } } as unknown as Viewer;

    const extendedFlyTo = createFlyToExecutor<z.infer<typeof extendedShape>>({
      shape: extendedShape,
      buildFlyToOptions: (data) => ({ duration: data.duration }),
    });

    const result = await extendedFlyTo(fakeViewer, { latitude: 0, longitude: 0, duration: -1 });

    expect(flew).toBe(false);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid flyTo arguments");
  });

  test("with no config, behaves identically to the default flyTo export", async () => {
    const executor = createFlyToExecutor();
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
    } as unknown as Viewer;

    const result = await executor(fakeViewer, {
      latitude: 48.8566,
      longitude: 2.3522,
      altitude: 15000,
    });

    expect(result).toEqual({ success: true });
    expect(destination!.x).toBeCloseTo(PARIS.x, 0);
  });
});
