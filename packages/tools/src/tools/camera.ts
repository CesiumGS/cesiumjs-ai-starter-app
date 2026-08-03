import {
  Cartesian3,
  Cartographic,
  HeadingPitchRange,
  Math as CesiumMath,
  Transforms,
  type Camera,
  type Viewer,
} from "cesium";
import type { z } from "zod";
import {
  cameraGetPositionInputShape,
  cameraLookAtTransformInputShape,
  cameraSetControllerOptionsInputShape,
  cameraSetViewInputShape,
  cameraStartOrbitInputShape,
  cameraStopOrbitInputShape,
  type CameraSetViewInput,
} from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { ok, fail } from "../utils/result.js";
import type { ToolExecutor } from "../types.js";

/**
 * The subset of `Camera.setView`'s options an extended executor can add on
 * top of the base ones (`destination`/`orientation` are always derived from
 * the validated args).
 */
export type CameraSetViewOptions = Omit<
  Parameters<Camera["setView"]>[0],
  "destination" | "orientation"
>;

/** Config accepted by {@link createCameraSetViewExecutor}. */
export interface CameraSetViewExecutorConfig<Args extends CameraSetViewInput = CameraSetViewInput> {
  /** Validated args shape. Defaults to the base `cameraSetViewInputShape`. */
  shape?: z.ZodType<Args>;
  /** Derives extra `Camera.setView` options (e.g. `endTransform`) from the validated args. */
  buildSetViewOptions?: (data: Args) => CameraSetViewOptions;
}

/**
 * Builds a `cameraSetView` executor, reusing the base validation/`Cartesian3`
 * conversion/error-handling plumbing and letting you extend only the
 * accepted args shape and any extra `Camera.setView` options derived from it
 * — mirrors {@link createFlyToExecutor}'s role for `flyTo`.
 */
export function createCameraSetViewExecutor<Args extends CameraSetViewInput = CameraSetViewInput>(
  config: CameraSetViewExecutorConfig<Args> = {},
): ToolExecutor {
  const shape = config.shape ?? (cameraSetViewInputShape as unknown as z.ZodType<Args>);
  const buildSetViewOptions = config.buildSetViewOptions;

  return (viewer: Viewer, rawArgs: unknown) => {
    const parsed = parseArgs(shape, rawArgs);
    if (!parsed.ok)
      return Promise.resolve(fail(`Invalid cameraSetView arguments: ${parsed.error}`));

    const { destination, orientation } = parsed.data;
    const extraOptions = buildSetViewOptions?.(parsed.data) ?? {};
    try {
      viewer.camera.setView({
        ...extraOptions,
        destination: Cartesian3.fromDegrees(
          destination.longitude,
          destination.latitude,
          destination.height ?? 0,
        ),
        orientation: orientation
          ? {
              heading: CesiumMath.toRadians(orientation.heading ?? 0),
              pitch: CesiumMath.toRadians(orientation.pitch ?? -90),
              roll: CesiumMath.toRadians(orientation.roll ?? 0),
            }
          : undefined,
      });
      return Promise.resolve(ok());
    } catch (err) {
      return Promise.resolve(fail(err instanceof Error ? err.message : String(err)));
    }
  };
}

/** Default `cameraSetView` executor — {@link createCameraSetViewExecutor} with no extension. An instant (non-animated) camera cut. */
export const cameraSetView: ToolExecutor = createCameraSetViewExecutor();

/** Default `cameraLookAtTransform` executor: orbits the camera around a fixed target. */
export const cameraLookAtTransform: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraLookAtTransformInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(fail(`Invalid cameraLookAtTransform arguments: ${parsed.error}`));
  }

  const { target, offset } = parsed.data;
  try {
    const targetCartesian = Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
      target.height ?? 0,
    );
    const transform = Transforms.eastNorthUpToFixedFrame(targetCartesian);
    viewer.camera.lookAtTransform(
      transform,
      new HeadingPitchRange(
        CesiumMath.toRadians(offset?.heading ?? 0),
        CesiumMath.toRadians(offset?.pitch ?? -45),
        offset?.range ?? 1000,
      ),
    );
    return Promise.resolve(ok());
  } catch (err) {
    return Promise.resolve(fail(err instanceof Error ? err.message : String(err)));
  }
};

/** Radians the default orbit rotates the camera per `clock.onTick` — an approximation, not physical speed. */
const ORBIT_RADIANS_PER_TICK = 0.005;

/** Per-`Viewer` unsubscribe function for the default orbit's `clock.onTick` listener. */
const orbitRemovers = new WeakMap<Viewer, () => void>();

/**
 * Default `cameraStartOrbit` executor. Cesium has no built-in continuous
 * "orbit camera" API, so this is a simple approximation: a small
 * `camera.rotateRight` nudge on every `clock.onTick`. Replace this entry (and
 * `cameraStopOrbit` below) for a more sophisticated chase-cam/orbit behavior.
 */
export const cameraStartOrbit: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraStartOrbitInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(fail(`Invalid cameraStartOrbit arguments: ${parsed.error}`));
  }

  stopOrbit(viewer);
  const speed = parsed.data.speed ?? 1;
  const sign = parsed.data.direction === "counterclockwise" ? -1 : 1;
  const remove = viewer.clock.onTick.addEventListener(() => {
    viewer.camera.rotateRight(sign * speed * ORBIT_RADIANS_PER_TICK);
  });
  orbitRemovers.set(viewer, remove);
  return Promise.resolve(ok());
};

/** Default `cameraStopOrbit` executor: stops whatever the default `cameraStartOrbit` started. */
export const cameraStopOrbit: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraStopOrbitInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(fail(`Invalid cameraStopOrbit arguments: ${parsed.error}`));
  }
  stopOrbit(viewer);
  return Promise.resolve(ok());
};

function stopOrbit(viewer: Viewer): void {
  const remove = orbitRemovers.get(viewer);
  if (remove) {
    remove();
    orbitRemovers.delete(viewer);
  }
}

/** Default `cameraGetPosition` executor: reads the camera's current geographic position/orientation. */
export const cameraGetPosition: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraGetPositionInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(fail(`Invalid cameraGetPosition arguments: ${parsed.error}`));
  }
  try {
    const cartographic = Cartographic.fromCartesian(viewer.camera.positionWC);
    return Promise.resolve(
      ok({
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        height: cartographic.height,
        heading: CesiumMath.toDegrees(viewer.camera.heading),
        pitch: CesiumMath.toDegrees(viewer.camera.pitch),
        roll: CesiumMath.toDegrees(viewer.camera.roll),
      }),
    );
  } catch (err) {
    return Promise.resolve(fail(err instanceof Error ? err.message : String(err)));
  }
};

/** Default `cameraSetControllerOptions` executor: maps each provided field onto `screenSpaceCameraController`. */
export const cameraSetControllerOptions: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraSetControllerOptionsInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(fail(`Invalid cameraSetControllerOptions arguments: ${parsed.error}`));
  }

  const controller = viewer.scene.screenSpaceCameraController;
  const options = parsed.data;
  if (options.enableRotate !== undefined) controller.enableRotate = options.enableRotate;
  if (options.enableTranslate !== undefined) controller.enableTranslate = options.enableTranslate;
  if (options.enableZoom !== undefined) controller.enableZoom = options.enableZoom;
  if (options.enableTilt !== undefined) controller.enableTilt = options.enableTilt;
  if (options.enableLook !== undefined) controller.enableLook = options.enableLook;
  if (options.enableCollisionDetection !== undefined) {
    controller.enableCollisionDetection = options.enableCollisionDetection;
  }
  if (options.maximumZoomDistance !== undefined) {
    controller.maximumZoomDistance = options.maximumZoomDistance;
  }
  if (options.minimumZoomDistance !== undefined) {
    controller.minimumZoomDistance = options.minimumZoomDistance;
  }
  return Promise.resolve(ok());
};
