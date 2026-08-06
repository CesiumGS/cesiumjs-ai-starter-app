import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Cartesian3, EasingFunction, Matrix4 } from "cesium";
import type { Viewer } from "cesium";
import { cameraSetViewInputShape, flyToInputShape } from "@cesium-ai/tools-schemas/schemas";
import {
  cameraGetPosition,
  cameraOrbit,
  cameraSetControllerOptions,
  cameraSetView,
  createCameraSetViewExecutor,
  createFlyToExecutor,
  flyTo,
} from "./camera.js";

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
  const extendedFlyToShape = z.object({
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

    const extendedFlyTo = createFlyToExecutor<z.infer<typeof extendedFlyToShape>>({
      shape: extendedFlyToShape,
      buildFlyToOptions: (data) => ({ duration: data.duration }),
    });

    const result = await extendedFlyTo(fakeViewer, { latitude: 0, longitude: 0, duration: 7 });

    expect(result).toEqual({ success: true });
    expect(sawDuration).toBe(7);
  });

  test("still validates against the extended shape before flying (reuses the base plumbing)", async () => {
    let flew = false;
    const fakeViewer = { camera: { flyTo: () => (flew = true) } } as unknown as Viewer;

    const extendedFlyTo = createFlyToExecutor<z.infer<typeof extendedFlyToShape>>({
      shape: extendedFlyToShape,
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

describe("cameraOrbit", () => {
  function fakeOrbitViewer() {
    const listeners: Array<() => void> = [];
    let removed = false;
    const rotateRightCalls: number[] = [];
    const viewer = {
      clock: {
        onTick: {
          addEventListener: (listener: () => void) => {
            listeners.push(listener);
            return () => {
              removed = true;
              const index = listeners.indexOf(listener);
              if (index !== -1) listeners.splice(index, 1);
            };
          },
        },
      },
      camera: {
        rotateRight: (radians: number) => rotateRightCalls.push(radians),
      },
    } as unknown as Viewer;
    return {
      viewer,
      tick: () => listeners.forEach((listener) => listener()),
      rotateRightCalls,
      wasRemoved: () => removed,
    };
  }

  test('action "start" registers a clock.onTick listener that rotates the camera clockwise by default', async () => {
    const { viewer, tick, rotateRightCalls } = fakeOrbitViewer();

    const result = await cameraOrbit(viewer, { action: "start" });
    tick();

    expect(result).toEqual({ success: true });
    expect(rotateRightCalls).toEqual([0.005]);
  });

  test('action "start" with direction "counterclockwise" flips the rotation sign', async () => {
    const { viewer, tick, rotateRightCalls } = fakeOrbitViewer();

    await cameraOrbit(viewer, { action: "start", direction: "counterclockwise", speed: 2 });
    tick();

    expect(rotateRightCalls).toEqual([-0.01]);
  });

  test('action "start" replaces a previously-running orbit instead of stacking listeners', async () => {
    const { viewer, tick, rotateRightCalls } = fakeOrbitViewer();

    await cameraOrbit(viewer, { action: "start" });
    await cameraOrbit(viewer, { action: "start", speed: 2 });
    tick();

    // Only the second listener's rotation should fire — the first was torn down.
    expect(rotateRightCalls).toEqual([0.01]);
  });

  test('action "stop" tears down the running orbit listener', async () => {
    const { viewer, wasRemoved } = fakeOrbitViewer();

    await cameraOrbit(viewer, { action: "start" });
    const result = await cameraOrbit(viewer, { action: "stop" });

    expect(result).toEqual({ success: true });
    expect(wasRemoved()).toBe(true);
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const { viewer } = fakeOrbitViewer();

    const result = await cameraOrbit(viewer, { action: "start", speed: 100 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid cameraOrbit arguments");
  });
});

describe("cameraGetPosition", () => {
  test("reads the camera's geographic position and orientation", async () => {
    const fakeViewer = {
      camera: {
        positionWC: Cartesian3.fromDegrees(2.3522, 48.8566, 1500),
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
    } as unknown as Viewer;

    const result = await cameraGetPosition(fakeViewer, {});

    expect(result.success).toBe(true);
    expect(result.longitude).toBeCloseTo(2.3522, 2);
    expect(result.latitude).toBeCloseTo(48.8566, 2);
    expect(result.height).toBeCloseTo(1500, -1);
  });
});

describe("cameraSetControllerOptions", () => {
  test("applies only the provided fields onto screenSpaceCameraController", async () => {
    const controller: Record<string, unknown> = {
      enableRotate: true,
      enableZoom: true,
      maximumZoomDistance: Infinity,
    };
    const fakeViewer = { scene: { screenSpaceCameraController: controller } } as unknown as Viewer;

    const result = await cameraSetControllerOptions(fakeViewer, {
      enableRotate: false,
      maximumZoomDistance: 5000,
    });

    expect(result).toEqual({ success: true });
    expect(controller.enableRotate).toBe(false);
    expect(controller.maximumZoomDistance).toBe(5000);
    // Untouched fields keep their prior value.
    expect(controller.enableZoom).toBe(true);
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const fakeViewer = {
      scene: { screenSpaceCameraController: {} },
    } as unknown as Viewer;

    const result = await cameraSetControllerOptions(fakeViewer, { maximumZoomDistance: -1 });

    expect(result.success).toBe(false);
  });
});

describe("createCameraSetViewExecutor", () => {
  const extendedShape = z.object({
    ...cameraSetViewInputShape.shape,
    endTransformIdentity: z.boolean().optional(),
  });

  test("passes buildSetViewOptions' extra options through to camera.setView", async () => {
    let sawEndTransform: unknown;
    const fakeViewer = {
      camera: {
        setView: (opts: { endTransform?: unknown }) => {
          sawEndTransform = opts.endTransform;
        },
      },
    } as unknown as Viewer;

    const executor = createCameraSetViewExecutor<z.infer<typeof extendedShape>>({
      shape: extendedShape,
      buildSetViewOptions: (data) =>
        data.endTransformIdentity ? { endTransform: Matrix4.IDENTITY } : {},
    });

    const result = await executor(fakeViewer, {
      destination: { longitude: 0, latitude: 0 },
      endTransformIdentity: true,
    });

    expect(result).toEqual({ success: true });
    expect(sawEndTransform).toBe(Matrix4.IDENTITY);
  });

  test("with no config, behaves identically to the default cameraSetView export", async () => {
    let destination: unknown;
    const fakeViewer = {
      camera: { setView: (opts: { destination: unknown }) => (destination = opts.destination) },
    } as unknown as Viewer;

    const executor = createCameraSetViewExecutor();
    const result = await executor(fakeViewer, {
      destination: { longitude: 2.35, latitude: 48.85 },
    });
    const defaultResult = await cameraSetView(fakeViewer, {
      destination: { longitude: 2.35, latitude: 48.85 },
    });

    expect(result).toEqual({ success: true });
    expect(defaultResult).toEqual({ success: true });
    expect(destination).toBeDefined();
  });
});
