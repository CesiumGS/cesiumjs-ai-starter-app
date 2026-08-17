import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas/names";
import {
  flyTo,
  cameraGetPosition,
  cameraLookAtTransform,
  cameraOrbit,
  cameraSetControllerOptions,
  cameraSetView,
} from "./tools/camera.js";
import { entityAdd, entityList, entityRemove } from "./tools/entities.js";
import {
  animationCameraTracking,
  animationCreate,
  animationListActive,
  animationRemove,
  animationUpdatePath,
  clockControl,
  globeSetLighting,
} from "./tools/animation.js";
import { imageryAdd, imageryList, imageryRemove } from "./tools/imagery.js";
import type { ToolsLogger } from "./logger.js";
import type { CesiumToolExecutorOverrides, CesiumToolExecutors, ToolExecutor } from "./types.js";

export type {
  ToolExecutor,
  ToolExecutionResult,
  CesiumToolExecutors,
  CesiumToolExecutorOverrides,
} from "./types.js";

export {
  noopToolsLogger,
  createConsoleToolsLogger,
  type ToolsLogger,
  type ToolsLogLevel,
} from "./logger.js";

export {
  createFlyToExecutor,
  type FlyToCameraOptions,
  type FlyToExecutorConfig,
  createCameraSetViewExecutor,
  type CameraSetViewExecutorConfig,
  type CameraSetViewOptions,
} from "./tools/camera.js";

export {
  flyTo,
  cameraGetPosition,
  cameraLookAtTransform,
  cameraOrbit,
  cameraSetControllerOptions,
  cameraSetView,
} from "./tools/camera.js";
export {
  entityAdd,
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
  [CESIUM_TOOL_NAMES.cameraOrbit]: cameraOrbit,
  [CESIUM_TOOL_NAMES.cameraGetPosition]: cameraGetPosition,
  [CESIUM_TOOL_NAMES.cameraSetControllerOptions]: cameraSetControllerOptions,
  // entity — entityAdd is the single model-facing entry point; the per-type
  // executors below still back its internal dispatch (see entities.ts) but are not
  // separately registered under their own CESIUM_TOOL_NAMES entry.
  [CESIUM_TOOL_NAMES.entityAdd]: entityAdd,
  [CESIUM_TOOL_NAMES.entityList]: entityList,
  [CESIUM_TOOL_NAMES.entityRemove]: entityRemove,
  // animation
  [CESIUM_TOOL_NAMES.animationCreate]: animationCreate,
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

/** Wraps an executor so its resolved `{ error }` (or a thrown rejection) is reported to `logger`. */
function withLogging(toolName: string, executor: ToolExecutor, logger: ToolsLogger): ToolExecutor {
  return async (viewer, rawArgs) => {
    try {
      const result = await executor(viewer, rawArgs);
      if (result.error) {
        logger.warn(`Tool call failed: ${toolName}`, { error: result.error });
      } else {
        // include the result payload (e.g. animationId, entities) so success logs are distinguishable per call
        const { success: _success, error: _error, ...data } = result;
        if (Object.keys(data).length > 0) {
          logger.debug(`Tool call succeeded: ${toolName}`, data);
        } else {
          logger.debug(`Tool call succeeded: ${toolName}`);
        }
      }
      return result;
    } catch (err) {
      logger.error(`Tool call threw: ${toolName}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}

/**
 * Builds a `CesiumToolExecutors` registry, applying per-tool overrides over
 * the defaults. Pass a replacement executor for any tool name to change or
 * extend its behavior — e.g. validate against an app-extended args shape
 * (this repo's own sample app does exactly this for `flyTo`, adding
 * `duration`/`easingFunction` — see the package README) — without forking the
 * rest of the registry.
 *
 * Pass `logger` (e.g. {@link createConsoleToolsLogger} or your own OTEL-wired
 * {@link ToolsLogger}) to have every executor's outcome — success, a resolved
 * `{ error }`, or a thrown rejection — reported through it. Omitted by
 * default, in which case executors are returned unwrapped (this package has
 * zero logging of its own unless you opt in) — a `noopToolsLogger` is also
 * available if you want the wrapping without the console/OTEL output.
 */
export function createCesiumToolExecutors(
  overrides: CesiumToolExecutorOverrides = {},
  logger?: ToolsLogger,
): CesiumToolExecutors {
  const merged = { ...DEFAULT_CESIUM_TOOL_EXECUTORS, ...overrides };
  if (!logger) return merged;

  return Object.fromEntries(
    Object.entries(merged).map(([toolName, executor]) => [
      toolName,
      withLogging(toolName, executor as ToolExecutor, logger),
    ]),
  ) as CesiumToolExecutors;
}
