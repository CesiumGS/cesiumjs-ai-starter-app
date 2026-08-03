import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Cartesian3, Matrix4 } from "cesium";
import type { Viewer } from "cesium";
import { cameraSetViewInputShape } from "@cesium-ai/tools-schemas/schemas";
import {
  cameraGetPosition,
  cameraSetControllerOptions,
  cameraSetView,
  createCameraSetViewExecutor,
} from "./camera.js";

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
