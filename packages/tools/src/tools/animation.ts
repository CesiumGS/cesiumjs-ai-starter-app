import {
  Cartesian3,
  Color,
  ClockRange,
  ColorMaterialProperty,
  ConstantProperty,
  HermitePolynomialApproximation,
  JulianDate,
  LagrangePolynomialApproximation,
  LinearApproximation,
  PathGraphics,
  SampledPositionProperty,
  TimeInterval,
  TimeIntervalCollection,
  VelocityOrientationProperty,
} from "cesium";
import {
  animationCameraTrackingInputShape,
  animationCreateInputShape,
  animationListActiveInputShape,
  animationRemoveInputShape,
  animationUpdatePathInputShape,
  clockControlInputShape,
  globeSetLightingInputShape,
} from "@cesium-ai/tools-schemas/schemas";
import { parseArgs } from "../utils/validate.js";
import { success, failure } from "../utils/result.js";
import { generateEntityId, rgbaToColor } from "../utils/cesium-values.js";
import {
  isKnownAnimation,
  listAnimationIds,
  registerAnimation,
  unregisterAnimation,
} from "../utils/animation-registry.js";
import type { ToolExecutor } from "../types.js";

const INTERPOLATION_ALGORITHMS = {
  LINEAR: LinearApproximation,
  LAGRANGE: LagrangePolynomialApproximation,
  HERMITE: HermitePolynomialApproximation,
} as const;

/**
 * Default `animationCreate` executor: builds a `SampledPositionProperty` from
 * the given time-tagged position samples and attaches it to a new entity
 * (a `model` if `modelUri` is given, otherwise a plain colored point), plus a
 * `path` trail. Returns `{ animationId }` — the id every other `animation*`
 * tool references.
 *
 * Known limitations of this default, both easy override points (replace this
 * executor, or add the missing mapping and call the real Cesium APIs
 * yourself): `modelPreset` (a named preset like `"car"`) isn't resolved to a
 * real asset URI — pass `modelUri` directly, or override this executor with
 * your own preset-name-to-URI mapping. `clampToGround` and `loopMode:
 * "pingpong"` aren't applied (Cesium's `Clock` has no built-in ping-pong).
 */
export const animationCreate: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(animationCreateInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid animationCreate arguments: ${parsed.error}`));

  const {
    positionSamples,
    name,
    startTime,
    stopTime,
    interpolationAlgorithm,
    showPath,
    pathLeadTime,
    pathTrailTime,
    pathWidth,
    pathColor,
    modelUri,
    modelScale,
    loopMode,
    speedMultiplier,
    autoPlay,
    trackCamera,
  } = parsed.data;

  try {
    const property = new SampledPositionProperty();
    property.setInterpolationOptions({
      interpolationAlgorithm: INTERPOLATION_ALGORITHMS[interpolationAlgorithm ?? "LINEAR"],
      interpolationDegree: interpolationAlgorithm === "LAGRANGE" ? 5 : 2,
    });
    for (const sample of positionSamples) {
      property.addSample(
        JulianDate.fromIso8601(sample.time),
        Cartesian3.fromDegrees(sample.longitude, sample.latitude, sample.height ?? 0),
      );
    }

    const animationId = generateEntityId("animation");
    const availability =
      startTime && stopTime
        ? new TimeIntervalCollection([
            new TimeInterval({
              start: JulianDate.fromIso8601(startTime),
              stop: JulianDate.fromIso8601(stopTime),
            }),
          ])
        : undefined;

    viewer.entities.add({
      id: animationId,
      name,
      availability,
      position: property,
      orientation: new VelocityOrientationProperty(property),
      path:
        showPath === false
          ? undefined
          : {
              leadTime: pathLeadTime ?? 10,
              trailTime: pathTrailTime ?? 10,
              width: pathWidth ?? 2,
              material: pathColor ? rgbaToColor(pathColor) : undefined,
            },
      model: modelUri ? { uri: modelUri, scale: modelScale ?? 1, minimumPixelSize: 32 } : undefined,
      point: modelUri ? undefined : { pixelSize: 12, color: Color.YELLOW },
    });
    registerAnimation(viewer, animationId);

    if (loopMode) {
      viewer.clock.clockRange = loopMode === "loop" ? ClockRange.LOOP_STOP : ClockRange.CLAMPED;
    }
    if (speedMultiplier !== undefined) viewer.clock.multiplier = speedMultiplier;
    if (autoPlay !== false) viewer.clock.shouldAnimate = true;
    if (trackCamera) viewer.trackedEntity = viewer.entities.getById(animationId);

    return Promise.resolve(success({ animationId }));
  } catch (err) {
    return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
  }
};

/** Default `animationRemove` executor. */
export const animationRemove: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(animationRemoveInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid animationRemove arguments: ${parsed.error}`));
  const { animationId } = parsed.data;
  if (!isKnownAnimation(viewer, animationId)) {
    return Promise.resolve(failure(`Unknown animationId "${animationId}".`));
  }
  if (viewer.trackedEntity?.id === animationId) viewer.trackedEntity = undefined;
  const removed = viewer.entities.removeById(animationId);
  unregisterAnimation(viewer, animationId);
  return Promise.resolve(
    removed ? success() : failure(`No entity found for animationId "${animationId}".`),
  );
};

/** Default `animationListActive` executor: lists every id `animationCreate` registered. */
export const animationListActive: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(animationListActiveInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(failure(`Invalid animationListActive arguments: ${parsed.error}`));
  }
  const animations = listAnimationIds(viewer)
    .map((animationId) => viewer.entities.getById(animationId))
    .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined)
    .map((entity) => ({ animationId: entity.id, name: entity.name ?? undefined }));
  return Promise.resolve(success({ animations }));
};

/** Default `animationUpdatePath` executor: adjusts the trail graphics of an existing animation entity. */
export const animationUpdatePath: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(animationUpdatePathInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(failure(`Invalid animationUpdatePath arguments: ${parsed.error}`));
  }
  const { animationId, leadTime, trailTime, width, color } = parsed.data;
  if (!isKnownAnimation(viewer, animationId)) {
    return Promise.resolve(failure(`Unknown animationId "${animationId}".`));
  }
  const entity = viewer.entities.getById(animationId);
  if (!entity) return Promise.resolve(failure(`No entity found for animationId "${animationId}".`));

  try {
    entity.path ??= new PathGraphics();
    if (leadTime !== undefined) entity.path.leadTime = new ConstantProperty(leadTime);
    if (trailTime !== undefined) entity.path.trailTime = new ConstantProperty(trailTime);
    if (width !== undefined) entity.path.width = new ConstantProperty(width);
    if (color) {
      entity.path.material = new ColorMaterialProperty(rgbaToColor(color));
    }
    return Promise.resolve(success());
  } catch (err) {
    return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
  }
};

/**
 * Default `animationCameraTracking` executor: toggles `viewer.trackedEntity`.
 * `range`/`pitch`/`heading` aren't applied by this default — once
 * `trackedEntity` is set, Cesium drives the camera itself every frame, so a
 * custom chase-cam offset needs overriding this executor.
 */
export const animationCameraTracking: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(animationCameraTrackingInputShape, rawArgs);
  if (!parsed.ok) {
    return Promise.resolve(failure(`Invalid animationCameraTracking arguments: ${parsed.error}`));
  }
  const { animationId, track } = parsed.data;
  if (!isKnownAnimation(viewer, animationId)) {
    return Promise.resolve(failure(`Unknown animationId "${animationId}".`));
  }
  const entity = viewer.entities.getById(animationId);
  if (!entity) return Promise.resolve(failure(`No entity found for animationId "${animationId}".`));

  viewer.trackedEntity = track ? entity : undefined;
  return Promise.resolve(success());
};

/** Default `clockControl` executor. */
export const clockControl: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(clockControlInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid clockControl arguments: ${parsed.error}`));
  const { action, clock, currentTime, multiplier } = parsed.data;

  try {
    if (action === "configure" && clock) {
      if (clock.startTime !== undefined)
        viewer.clock.startTime = JulianDate.fromIso8601(clock.startTime);
      if (clock.stopTime !== undefined)
        viewer.clock.stopTime = JulianDate.fromIso8601(clock.stopTime);
      if (clock.currentTime !== undefined) {
        viewer.clock.currentTime = JulianDate.fromIso8601(clock.currentTime);
      }
      if (clock.clockRange !== undefined) viewer.clock.clockRange = ClockRange[clock.clockRange];
      if (clock.multiplier !== undefined) viewer.clock.multiplier = clock.multiplier;
      if (clock.shouldAnimate !== undefined) viewer.clock.shouldAnimate = clock.shouldAnimate;
    }
    if (action === "setTime" && currentTime !== undefined) {
      viewer.clock.currentTime = JulianDate.fromIso8601(currentTime);
    }
    if (action === "setMultiplier" && multiplier !== undefined) {
      viewer.clock.multiplier = multiplier;
    }
    return Promise.resolve(success());
  } catch (err) {
    return Promise.resolve(failure(err instanceof Error ? err.message : String(err)));
  }
};

/** Default `globeSetLighting` executor. */
export const globeSetLighting: ToolExecutor = (viewer, rawArgs) => {
  const parsed = parseArgs(globeSetLightingInputShape, rawArgs);
  if (!parsed.ok)
    return Promise.resolve(failure(`Invalid globeSetLighting arguments: ${parsed.error}`));
  const { enableLighting, enableDynamicAtmosphere, enableSunLighting } = parsed.data;
  const globe = viewer.scene.globe;
  globe.enableLighting = enableLighting;
  if (enableDynamicAtmosphere !== undefined)
    globe.dynamicAtmosphereLighting = enableDynamicAtmosphere;
  if (enableSunLighting !== undefined) globe.dynamicAtmosphereLightingFromSun = enableSunLighting;
  return Promise.resolve(success());
};
