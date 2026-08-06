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
  cameraOrbitInputShape,
  cameraSetControllerOptionsInputShape,
  cameraSetViewInputShape,
  flyToInputShape,
  type CameraSetViewInput,
  type FlyToInput,
} from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { success, failure } from "../utils/result.js";
import type { ToolExecutor } from "../types.js";

/** Camera height above the ellipsoid, in metres, used when the model omits one. */
const DEFAULT_ALTITUDE = 15000;

/**
 * The subset of `Camera.flyTo`'s options an extended executor can add on top
 * of the base ones (`destination` is always derived from
 * `latitude`/`longitude`/`altitude`; `complete`/`cancel` always resolve the
 * `ToolExecutionResult` — neither can be overridden here).
 */
export type FlyToCameraOptions = Omit<
  Parameters<Camera["flyTo"]>[0],
  "destination" | "complete" | "cancel"
>;

/** Config accepted by {@link createFlyToExecutor}. */
export interface FlyToExecutorConfig<Args extends FlyToInput = FlyToInput> {
  /**
   * Validated args shape. Defaults to the base {@link flyToInputShape}
   * (latitude/longitude/altitude only) — pass an extended shape (one that
   * still infers every base field, e.g. this repo's own `flyToShape` adding
   * `duration`/`easingFunction`) to accept extra fields.
   */
  shape?: z.ZodType<Args>;
  /**
   * Derives extra `Camera.flyTo` options (e.g. `duration`, `easingFunction`)
   * from the validated args. Called after the base executor has already
   * validated `rawArgs` against `shape` — anything returned here is merged
   * in alongside the base `destination`/`complete`/`cancel`.
   */
  buildFlyToOptions?: (data: Args) => FlyToCameraOptions;
}

/**
 * Builds a `flyTo` executor, reusing the base validation / Cartesian3
 * conversion / promise / error-handling plumbing and letting you extend only
 * what actually differs: the accepted args shape and any extra
 * `Camera.flyTo` options derived from it. Prefer this over hand-writing a
 * whole new executor when you only need extra fields on top of the stock
 * `flyTo` contract (e.g. this repo's own `duration`/`easingFunction`,
 * `frontend/src/tools/camera.ts`) — see the package README's "Extending
 * flyTo" section for the full worked example.
 */
export function createFlyToExecutor<Args extends FlyToInput = FlyToInput>(
  config: FlyToExecutorConfig<Args> = {},
): ToolExecutor {
  const shape = config.shape ?? (flyToInputShape as unknown as z.ZodType<Args>);
  const buildFlyToOptions = config.buildFlyToOptions;

  return (viewer: Viewer, rawArgs: unknown) => {
    const parsed = parseArgs(shape, rawArgs);
    if (!parsed.ok) return Promise.resolve(failure(`Invalid flyTo arguments: ${parsed.error}`));

    const { latitude, longitude, altitude } = parsed.data;
    const extraOptions = buildFlyToOptions?.(parsed.data) ?? {};

    return new Promise((resolve) => {
      try {
        viewer.camera.flyTo({
          ...extraOptions,
          destination: Cartesian3.fromDegrees(longitude, latitude, altitude ?? DEFAULT_ALTITUDE),
          complete: () => resolve(success()),
          cancel: () => resolve(failure("Camera flight was cancelled before completing.")),
        });
      } catch (err) {
        resolve(failure(err instanceof Error ? err.message : String(err)));
      }
    });
  };
}

/**
 * Default `flyTo` executor — {@link createFlyToExecutor} with no extension.
 *
 * This is deliberately the **base** contract only (no `duration`/
 * `easingFunction`). An app that extends `flyToInputShape` (e.g. this repo's
 * own sample app) should call {@link createFlyToExecutor} itself with its own
 * extended `shape`/`buildFlyToOptions` rather than trying to configure this
 * one — see the package README's "Extending flyTo" section.
 */
export const flyTo: ToolExecutor = createFlyToExecutor();

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
      return Promise.resolve(failure(`Invalid cameraSetView arguments: ${parsed.error}`));

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
      return Promise.resolve(success());
    } catch (err) {
      return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
    }
  };
}

/** Default `cameraSetView` executor — {@link createCameraSetViewExecutor} with no extension. An instant (non-animated) camera cut. */
export const cameraSetView: ToolExecutor = createCameraSetViewExecutor();

/** Default `cameraLookAtTransform` executor: orbits the camera around a fixed target. */
export const cameraLookAtTransform: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraLookAtTransformInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(failure(`Invalid cameraLookAtTransform arguments: ${parsed.error}`));
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
    return Promise.resolve(success());
  } catch (err) {
    return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
  }
};

/** Radians the default orbit rotates the camera per `clock.onTick` — an approximation, not physical speed. */
const ORBIT_RADIANS_PER_TICK = 0.005;

/** Per-`Viewer` unsubscribe function for the default orbit's `clock.onTick` listener. */
const orbitRemovers = new WeakMap<Viewer, () => void>();

/**
 * Default `cameraOrbit` executor. Cesium has no built-in continuous "orbit
 * camera" API, so `action: "start"` is a simple approximation: a small
 * `camera.rotateRight` nudge on every `clock.onTick`. `action: "stop"` just
 * tears down that listener. Replace this entry for a more sophisticated
 * chase-cam/orbit behavior.
 */
export const cameraOrbit: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraOrbitInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(failure(`Invalid cameraOrbit arguments: ${parsed.error}`));
  }

  stopOrbit(viewer);
  if (parsed.data.action === "stop") {
    return Promise.resolve(success());
  }

  const speed = parsed.data.speed ?? 1;
  const sign = parsed.data.direction === "counterclockwise" ? -1 : 1;
  const remove = viewer.clock.onTick.addEventListener(() => {
    viewer.camera.rotateRight(sign * speed * ORBIT_RADIANS_PER_TICK);
  });
  orbitRemovers.set(viewer, remove);
  return Promise.resolve(success());
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
    return Promise.resolve(failure(`Invalid cameraGetPosition arguments: ${parsed.error}`));
  }
  try {
    const cartographic = Cartographic.fromCartesian(viewer.camera.positionWC);
    return Promise.resolve(
      success({
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        height: cartographic.height,
        heading: CesiumMath.toDegrees(viewer.camera.heading),
        pitch: CesiumMath.toDegrees(viewer.camera.pitch),
        roll: CesiumMath.toDegrees(viewer.camera.roll),
      }),
    );
  } catch (err) {
    return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
  }
};

/** Default `cameraSetControllerOptions` executor: maps each provided field onto `screenSpaceCameraController`. */
export const cameraSetControllerOptions: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(cameraSetControllerOptionsInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(
      failure(`Invalid cameraSetControllerOptions arguments: ${parsed.error}`),
    );
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
  return Promise.resolve(success());
};
