import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas/names";
import { flyTo } from "./tools/fly-to.js";
import {
  cameraGetPosition,
  cameraLookAtTransform,
  cameraSetControllerOptions,
  cameraSetView,
  cameraStartOrbit,
  cameraStopOrbit,
} from "./tools/camera.js";
import {
  entityAddBillboard,
  entityAddBox,
  entityAddCorridor,
  entityAddCylinder,
  entityAddEllipse,
  entityAddLabel,
  entityAddModel,
  entityAddPoint,
  entityAddPolygon,
  entityAddPolyline,
  entityAddRectangle,
  entityAddWall,
  entityList,
  entityRemove,
} from "./tools/entities.js";
import {
  animationCameraTracking,
  animationControl,
  animationCreate,
  animationListActive,
  animationRemove,
  animationUpdatePath,
  clockControl,
  globeSetLighting,
} from "./tools/animation.js";
import { imageryAdd, imageryList, imageryRemove } from "./tools/imagery.js";
import type { CesiumToolExecutorOverrides, CesiumToolExecutors } from "./types.js";

export type {
  ToolExecutor,
  ToolExecutionResult,
  CesiumToolExecutors,
  CesiumToolExecutorOverrides,
} from "./types.js";

export { flyTo, createFlyToExecutor } from "./tools/fly-to.js";
export type { FlyToCameraOptions, FlyToExecutorConfig } from "./tools/fly-to.js";
export {
  cameraGetPosition,
  cameraLookAtTransform,
  cameraSetControllerOptions,
  cameraSetView,
  cameraStartOrbit,
  cameraStopOrbit,
  createCameraSetViewExecutor,
} from "./tools/camera.js";
export type { CameraSetViewExecutorConfig, CameraSetViewOptions } from "./tools/camera.js";
export {
  entityAddBillboard,
  entityAddBox,
  entityAddCorridor,
  entityAddCylinder,
  entityAddEllipse,
  entityAddLabel,
  entityAddModel,
  entityAddPoint,
  entityAddPolygon,
  entityAddPolyline,
  entityAddRectangle,
  entityAddWall,
  entityList,
  entityRemove,
  createEntityAddBillboardExecutor,
  createEntityAddBoxExecutor,
  createEntityAddCorridorExecutor,
  createEntityAddCylinderExecutor,
  createEntityAddEllipseExecutor,
  createEntityAddLabelExecutor,
  createEntityAddModelExecutor,
  createEntityAddPointExecutor,
  createEntityAddPolygonExecutor,
  createEntityAddPolylineExecutor,
  createEntityAddRectangleExecutor,
  createEntityAddWallExecutor,
} from "./tools/entities.js";
export {
  createEntityAddExecutor,
  type EntityAddExecutorConfig,
} from "./utils/create-entity-add-executor.js";
export {
  animationCameraTracking,
  animationControl,
  animationCreate,
  animationListActive,
  animationRemove,
  animationUpdatePath,
  clockControl,
  globeSetLighting,
} from "./tools/animation.js";
export {
  imageryAdd,
  imageryList,
  imageryRemove,
  IMAGERY_PROVIDER_FACTORIES,
} from "./tools/imagery.js";

/**
 * Default, ready-to-use executor for every tool in `@cesium-ai/tools-schemas`'s
 * `CESIUM_TOOL_NAMES` catalogue — everything a host needs to wire this
 * package straight into a chat panel's tool-call dispatcher with zero
 * configuration. Build a customized registry with
 * {@link createCesiumToolExecutors} instead of mutating this object directly.
 */
export const DEFAULT_CESIUM_TOOL_EXECUTORS: CesiumToolExecutors = {
  [CESIUM_TOOL_NAMES.flyTo]: flyTo,
  // camera
  [CESIUM_TOOL_NAMES.cameraSetView]: cameraSetView,
  [CESIUM_TOOL_NAMES.cameraLookAtTransform]: cameraLookAtTransform,
  [CESIUM_TOOL_NAMES.cameraStartOrbit]: cameraStartOrbit,
  [CESIUM_TOOL_NAMES.cameraStopOrbit]: cameraStopOrbit,
  [CESIUM_TOOL_NAMES.cameraGetPosition]: cameraGetPosition,
  [CESIUM_TOOL_NAMES.cameraSetControllerOptions]: cameraSetControllerOptions,
  // entity
  [CESIUM_TOOL_NAMES.entityAddPoint]: entityAddPoint,
  [CESIUM_TOOL_NAMES.entityAddBillboard]: entityAddBillboard,
  [CESIUM_TOOL_NAMES.entityAddLabel]: entityAddLabel,
  [CESIUM_TOOL_NAMES.entityAddModel]: entityAddModel,
  [CESIUM_TOOL_NAMES.entityAddPolygon]: entityAddPolygon,
  [CESIUM_TOOL_NAMES.entityAddPolyline]: entityAddPolyline,
  [CESIUM_TOOL_NAMES.entityAddBox]: entityAddBox,
  [CESIUM_TOOL_NAMES.entityAddCorridor]: entityAddCorridor,
  [CESIUM_TOOL_NAMES.entityAddCylinder]: entityAddCylinder,
  [CESIUM_TOOL_NAMES.entityAddEllipse]: entityAddEllipse,
  [CESIUM_TOOL_NAMES.entityAddRectangle]: entityAddRectangle,
  [CESIUM_TOOL_NAMES.entityAddWall]: entityAddWall,
  [CESIUM_TOOL_NAMES.entityList]: entityList,
  [CESIUM_TOOL_NAMES.entityRemove]: entityRemove,
  // animation
  [CESIUM_TOOL_NAMES.animationCreate]: animationCreate,
  [CESIUM_TOOL_NAMES.animationControl]: animationControl,
  [CESIUM_TOOL_NAMES.animationRemove]: animationRemove,
  [CESIUM_TOOL_NAMES.animationListActive]: animationListActive,
  [CESIUM_TOOL_NAMES.animationUpdatePath]: animationUpdatePath,
  [CESIUM_TOOL_NAMES.animationCameraTracking]: animationCameraTracking,
  [CESIUM_TOOL_NAMES.clockControl]: clockControl,
  [CESIUM_TOOL_NAMES.globeSetLighting]: globeSetLighting,
  // imagery
  [CESIUM_TOOL_NAMES.imageryAdd]: imageryAdd,
  [CESIUM_TOOL_NAMES.imageryRemove]: imageryRemove,
  [CESIUM_TOOL_NAMES.imageryList]: imageryList,
};

/**
 * Builds a `CesiumToolExecutors` registry, applying per-tool overrides over
 * the defaults. Pass a replacement executor for any tool name to change or
 * extend its behavior — e.g. validate against an app-extended args shape
 * (this repo's own sample app does exactly this for `flyTo`, adding
 * `duration`/`easingFunction` — see the package README) — without forking the
 * rest of the registry.
 */
export function createCesiumToolExecutors(
  overrides: CesiumToolExecutorOverrides = {},
): CesiumToolExecutors {
  return { ...DEFAULT_CESIUM_TOOL_EXECUTORS, ...overrides };
}
