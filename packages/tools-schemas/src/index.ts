import type { ToolSet } from "ai";
import { createFlyTo, type FlyToConfig } from "./tools/flyTo/flyTo.js";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "./tool-names.js";
import {
  createCameraSetView,
  type CameraSetViewConfig,
} from "./tools/cameraSetView/cameraSetView.js";
import {
  createCameraLookAtTransform,
  type CameraLookAtTransformConfig,
} from "./tools/cameraLookAtTransform/cameraLookAtTransform.js";
import { createCameraOrbit, type CameraOrbitConfig } from "./tools/cameraOrbit/cameraOrbit.js";
import {
  createCameraGetPosition,
  type CameraGetPositionConfig,
} from "./tools/cameraGetPosition/cameraGetPosition.js";
import {
  createCameraSetControllerOptions,
  type CameraSetControllerOptionsConfig,
} from "./tools/cameraSetControllerOptions/cameraSetControllerOptions.js";
import { createEntityAdd, type EntityAddConfig } from "./tools/entityAdd/entityAdd.js";
import { createEntityList, type EntityListConfig } from "./tools/entityList/entityList.js";
import { createEntityRemove, type EntityRemoveConfig } from "./tools/entityRemove/entityRemove.js";
import {
  createAnimationCreate,
  type AnimationCreateConfig,
} from "./tools/animationCreate/animationCreate.js";
import {
  createAnimationRemove,
  type AnimationRemoveConfig,
} from "./tools/animationRemove/animationRemove.js";
import {
  createAnimationListActive,
  type AnimationListActiveConfig,
} from "./tools/animationListActive/animationListActive.js";
import {
  createAnimationUpdatePath,
  type AnimationUpdatePathConfig,
} from "./tools/animationUpdatePath/animationUpdatePath.js";
import {
  createAnimationCameraTracking,
  type AnimationCameraTrackingConfig,
} from "./tools/animationCameraTracking/animationCameraTracking.js";
import { createClockControl, type ClockControlConfig } from "./tools/clockControl/clockControl.js";
import {
  createGlobeSetLighting,
  type GlobeSetLightingConfig,
} from "./tools/globeSetLighting/globeSetLighting.js";
import { createImageryAdd, type ImageryAddConfig } from "./tools/imageryAdd/imageryAdd.js";
import {
  createImageryRemove,
  type ImageryRemoveConfig,
} from "./tools/imageryRemove/imageryRemove.js";
import { createImageryList, type ImageryListConfig } from "./tools/imageryList/imageryList.js";

export { createFlyTo, type FlyToConfig };
export { flyTo } from "./tools/flyTo/flyTo.js";
export {
  DEFAULT_FLY_TO_DESCRIPTION,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
  buildFlyToInputSchema,
  defaultFlyToInputSchema,
  type FlyToFieldDescriptions,
} from "./tools/flyTo/flyTo.js";
export { CESIUM_TOOL_NAMES, type CesiumToolName } from "./tool-names.js";
export { flyToInputShape, type FlyToInput } from "./schemas.js";
export { CESIUM_TOOL_DEFINITIONS, type CesiumToolDefinition } from "./tool-definitions.js";
export {
  createCameraSetView,
  cameraSetView,
  type CameraSetViewConfig,
} from "./tools/cameraSetView/cameraSetView.js";
export {
  DEFAULT_CAMERA_SET_VIEW_DESCRIPTION,
  DEFAULT_CAMERA_SET_VIEW_FIELD_DESCRIPTIONS,
  buildCameraSetViewInputSchema,
  defaultCameraSetViewInputSchema,
  type CameraSetViewFieldDescriptions,
} from "./tools/cameraSetView/cameraSetView.js";
export {
  createCameraLookAtTransform,
  cameraLookAtTransform,
  type CameraLookAtTransformConfig,
} from "./tools/cameraLookAtTransform/cameraLookAtTransform.js";
export {
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION,
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_FIELD_DESCRIPTIONS,
  buildCameraLookAtTransformInputSchema,
  defaultCameraLookAtTransformInputSchema,
  type CameraLookAtTransformFieldDescriptions,
} from "./tools/cameraLookAtTransform/cameraLookAtTransform.js";
export {
  createCameraOrbit,
  cameraOrbit,
  type CameraOrbitConfig,
} from "./tools/cameraOrbit/cameraOrbit.js";
export {
  DEFAULT_CAMERA_ORBIT_DESCRIPTION,
  DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS,
  buildCameraOrbitInputSchema,
  defaultCameraOrbitInputSchema,
  type CameraOrbitFieldDescriptions,
} from "./tools/cameraOrbit/cameraOrbit.js";
export {
  createCameraGetPosition,
  cameraGetPosition,
  type CameraGetPositionConfig,
} from "./tools/cameraGetPosition/cameraGetPosition.js";
export {
  DEFAULT_CAMERA_GET_POSITION_DESCRIPTION,
  DEFAULT_CAMERA_GET_POSITION_FIELD_DESCRIPTIONS,
  buildCameraGetPositionInputSchema,
  defaultCameraGetPositionInputSchema,
  type CameraGetPositionFieldDescriptions,
} from "./tools/cameraGetPosition/cameraGetPosition.js";
export {
  createCameraSetControllerOptions,
  cameraSetControllerOptions,
  type CameraSetControllerOptionsConfig,
} from "./tools/cameraSetControllerOptions/cameraSetControllerOptions.js";
export {
  DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION,
  DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_FIELD_DESCRIPTIONS,
  buildCameraSetControllerOptionsInputSchema,
  defaultCameraSetControllerOptionsInputSchema,
  type CameraSetControllerOptionsFieldDescriptions,
} from "./tools/cameraSetControllerOptions/cameraSetControllerOptions.js";
export { createEntityAdd, entityAdd, type EntityAddConfig } from "./tools/entityAdd/entityAdd.js";
export {
  DEFAULT_ENTITY_ADD_DESCRIPTION,
  DEFAULT_ENTITY_ADD_FIELD_DESCRIPTIONS,
  buildEntityAddInputSchema,
  defaultEntityAddInputSchema,
  type EntityAddFieldDescriptions,
} from "./tools/entityAdd/entityAdd.js";
export {
  createEntityList,
  entityList,
  type EntityListConfig,
} from "./tools/entityList/entityList.js";
export {
  DEFAULT_ENTITY_LIST_DESCRIPTION,
  DEFAULT_ENTITY_LIST_FIELD_DESCRIPTIONS,
  buildEntityListInputSchema,
  defaultEntityListInputSchema,
  type EntityListFieldDescriptions,
} from "./tools/entityList/entityList.js";
export {
  createEntityRemove,
  entityRemove,
  type EntityRemoveConfig,
} from "./tools/entityRemove/entityRemove.js";
export {
  DEFAULT_ENTITY_REMOVE_DESCRIPTION,
  DEFAULT_ENTITY_REMOVE_FIELD_DESCRIPTIONS,
  buildEntityRemoveInputSchema,
  defaultEntityRemoveInputSchema,
  type EntityRemoveFieldDescriptions,
} from "./tools/entityRemove/entityRemove.js";
export {
  createAnimationCreate,
  animationCreate,
  type AnimationCreateConfig,
} from "./tools/animationCreate/animationCreate.js";
export {
  DEFAULT_ANIMATION_CREATE_DESCRIPTION,
  DEFAULT_ANIMATION_CREATE_FIELD_DESCRIPTIONS,
  buildAnimationCreateInputSchema,
  defaultAnimationCreateInputSchema,
  type AnimationCreateFieldDescriptions,
} from "./tools/animationCreate/animationCreate.js";
export {
  createAnimationRemove,
  animationRemove,
  type AnimationRemoveConfig,
} from "./tools/animationRemove/animationRemove.js";
export {
  DEFAULT_ANIMATION_REMOVE_DESCRIPTION,
  DEFAULT_ANIMATION_REMOVE_FIELD_DESCRIPTIONS,
  buildAnimationRemoveInputSchema,
  defaultAnimationRemoveInputSchema,
  type AnimationRemoveFieldDescriptions,
} from "./tools/animationRemove/animationRemove.js";
export {
  createAnimationListActive,
  animationListActive,
  type AnimationListActiveConfig,
} from "./tools/animationListActive/animationListActive.js";
export {
  DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION,
  DEFAULT_ANIMATION_LIST_ACTIVE_FIELD_DESCRIPTIONS,
  buildAnimationListActiveInputSchema,
  defaultAnimationListActiveInputSchema,
  type AnimationListActiveFieldDescriptions,
} from "./tools/animationListActive/animationListActive.js";
export {
  createAnimationUpdatePath,
  animationUpdatePath,
  type AnimationUpdatePathConfig,
} from "./tools/animationUpdatePath/animationUpdatePath.js";
export {
  DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION,
  DEFAULT_ANIMATION_UPDATE_PATH_FIELD_DESCRIPTIONS,
  buildAnimationUpdatePathInputSchema,
  defaultAnimationUpdatePathInputSchema,
  type AnimationUpdatePathFieldDescriptions,
} from "./tools/animationUpdatePath/animationUpdatePath.js";
export {
  createAnimationCameraTracking,
  animationCameraTracking,
  type AnimationCameraTrackingConfig,
} from "./tools/animationCameraTracking/animationCameraTracking.js";
export {
  DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION,
  DEFAULT_ANIMATION_CAMERA_TRACKING_FIELD_DESCRIPTIONS,
  buildAnimationCameraTrackingInputSchema,
  defaultAnimationCameraTrackingInputSchema,
  type AnimationCameraTrackingFieldDescriptions,
} from "./tools/animationCameraTracking/animationCameraTracking.js";
export {
  createClockControl,
  clockControl,
  type ClockControlConfig,
} from "./tools/clockControl/clockControl.js";
export {
  DEFAULT_CLOCK_CONTROL_DESCRIPTION,
  DEFAULT_CLOCK_CONTROL_FIELD_DESCRIPTIONS,
  buildClockControlInputSchema,
  defaultClockControlInputSchema,
  type ClockControlFieldDescriptions,
} from "./tools/clockControl/clockControl.js";
export {
  createGlobeSetLighting,
  globeSetLighting,
  type GlobeSetLightingConfig,
} from "./tools/globeSetLighting/globeSetLighting.js";
export {
  DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION,
  DEFAULT_GLOBE_SET_LIGHTING_FIELD_DESCRIPTIONS,
  buildGlobeSetLightingInputSchema,
  defaultGlobeSetLightingInputSchema,
  type GlobeSetLightingFieldDescriptions,
} from "./tools/globeSetLighting/globeSetLighting.js";
export {
  createImageryAdd,
  imageryAdd,
  type ImageryAddConfig,
} from "./tools/imageryAdd/imageryAdd.js";
export {
  DEFAULT_IMAGERY_ADD_DESCRIPTION,
  DEFAULT_IMAGERY_ADD_FIELD_DESCRIPTIONS,
  buildImageryAddInputSchema,
  defaultImageryAddInputSchema,
  type ImageryAddFieldDescriptions,
} from "./tools/imageryAdd/imageryAdd.js";
export {
  createImageryRemove,
  imageryRemove,
  type ImageryRemoveConfig,
} from "./tools/imageryRemove/imageryRemove.js";
export {
  DEFAULT_IMAGERY_REMOVE_DESCRIPTION,
  DEFAULT_IMAGERY_REMOVE_FIELD_DESCRIPTIONS,
  buildImageryRemoveInputSchema,
  defaultImageryRemoveInputSchema,
  type ImageryRemoveFieldDescriptions,
} from "./tools/imageryRemove/imageryRemove.js";
export {
  createImageryList,
  imageryList,
  type ImageryListConfig,
} from "./tools/imageryList/imageryList.js";
export {
  DEFAULT_IMAGERY_LIST_DESCRIPTION,
  DEFAULT_IMAGERY_LIST_FIELD_DESCRIPTIONS,
  buildImageryListInputSchema,
  defaultImageryListInputSchema,
  type ImageryListFieldDescriptions,
} from "./tools/imageryList/imageryList.js";
export { buildDescribedSchema, describeShape } from "./lib/describe-shape.js";
export { mergeDescriptions } from "./lib/merge-descriptions.js";

/**
 * Per-tool configuration for {@link createCesiumTools}. Each key maps to a
 * tool's {@link FlyToConfig}-style overrides; pass `false` to omit a tool from
 * the registry entirely.
 */
export interface CesiumToolsConfig {
  /**
   * Opt-in allowlist of tool names to build. When provided, **only** these
   * tools are registered — the natural way for a host to declare the subset it
   * wants as the Cesium tool catalogue grows. Omit to include every tool by
   * default. A tool named here is still dropped if its per-tool config is
   * `false`, so the allowlist and per-tool overrides compose.
   */
  enabled?: readonly (CesiumToolName | string)[];
  /** Override `flyTo`'s description / input schema, or `false` to exclude it. */
  flyTo?: FlyToConfig | false;
  /** Override `cameraSetView`'s description / input schema, or `false` to exclude it. */
  cameraSetView?: CameraSetViewConfig | false;
  /** Override `cameraLookAtTransform`'s description / input schema, or `false` to exclude it. */
  cameraLookAtTransform?: CameraLookAtTransformConfig | false;
  /** Override `cameraOrbit`'s description / input schema, or `false` to exclude it. */
  cameraOrbit?: CameraOrbitConfig | false;
  /** Override `cameraGetPosition`'s description / input schema, or `false` to exclude it. */
  cameraGetPosition?: CameraGetPositionConfig | false;
  /** Override `cameraSetControllerOptions`'s description / input schema, or `false` to exclude it. */
  cameraSetControllerOptions?: CameraSetControllerOptionsConfig | false;
  /** Override `entityAdd`'s description / input schema, or `false` to exclude it. */
  entityAdd?: EntityAddConfig | false;
  /** Override `entityList`'s description / input schema, or `false` to exclude it. */
  entityList?: EntityListConfig | false;
  /** Override `entityRemove`'s description / input schema, or `false` to exclude it. */
  entityRemove?: EntityRemoveConfig | false;
  /** Override `animationCreate`'s description / input schema, or `false` to exclude it. */
  animationCreate?: AnimationCreateConfig | false;
  /** Override `animationRemove`'s description / input schema, or `false` to exclude it. */
  animationRemove?: AnimationRemoveConfig | false;
  /** Override `animationListActive`'s description / input schema, or `false` to exclude it. */
  animationListActive?: AnimationListActiveConfig | false;
  /** Override `animationUpdatePath`'s description / input schema, or `false` to exclude it. */
  animationUpdatePath?: AnimationUpdatePathConfig | false;
  /** Override `animationCameraTracking`'s description / input schema, or `false` to exclude it. */
  animationCameraTracking?: AnimationCameraTrackingConfig | false;
  /** Override `clockControl`'s description / input schema, or `false` to exclude it. */
  clockControl?: ClockControlConfig | false;
  /** Override `globeSetLighting`'s description / input schema, or `false` to exclude it. */
  globeSetLighting?: GlobeSetLightingConfig | false;
  /** Override `imageryAdd`'s description / input schema, or `false` to exclude it. */
  imageryAdd?: ImageryAddConfig | false;
  /** Override `imageryRemove`'s description / input schema, or `false` to exclude it. */
  imageryRemove?: ImageryRemoveConfig | false;
  /** Override `imageryList`'s description / input schema, or `false` to exclude it. */
  imageryList?: ImageryListConfig | false;
}

/**
 * Builds the set of CesiumJS viewer tools (client-side execution). Returning a
 * factory keeps the registry composable — future tool groups (MCP-backed,
 * server-side, etc.) can be spread alongside it:
 *
 *   const tools = { ...createCesiumTools(), ...createMcpTools() };
 *
 * Pass {@link CesiumToolsConfig} to customize a tool's description or input
 * schema per host application, e.g.:
 *
 *   createCesiumTools({
 *     flyTo: { description: "Move the camera to a place." },
 *   });
 *
 * Pass {@link CesiumToolsConfig.enabled} to register only a chosen subset —
 * the host's allowlist as the catalogue grows:
 *
 *   createCesiumTools({ enabled: ["flyTo"] });
 *
 * These tools are **schemas only** — none define `execute`. The host
 * application runs each tool call against its live CesiumJS `Viewer` and posts
 * the result back to the agent loop (see `@cesium-ai/server`).
 */
export function createCesiumTools(config: CesiumToolsConfig = {}): ToolSet {
  const tools: ToolSet = {};

  // A tool ships only when the allowlist admits it (or there is no allowlist).
  const allowed = (name: CesiumToolName): boolean =>
    config.enabled === undefined || config.enabled.includes(name);

  // Key the registry off the shared name constant — never a bare string — so a
  // tool's server name stays in lockstep with the client executor that handles
  // it (see `./tool-names.ts`).
  if (config.flyTo !== false && allowed(CESIUM_TOOL_NAMES.flyTo)) {
    tools[CESIUM_TOOL_NAMES.flyTo] = createFlyTo(config.flyTo);
  }
  if (config.cameraSetView !== false && allowed(CESIUM_TOOL_NAMES.cameraSetView)) {
    tools[CESIUM_TOOL_NAMES.cameraSetView] = createCameraSetView(config.cameraSetView);
  }
  if (config.cameraLookAtTransform !== false && allowed(CESIUM_TOOL_NAMES.cameraLookAtTransform)) {
    tools[CESIUM_TOOL_NAMES.cameraLookAtTransform] = createCameraLookAtTransform(
      config.cameraLookAtTransform,
    );
  }
  if (config.cameraOrbit !== false && allowed(CESIUM_TOOL_NAMES.cameraOrbit)) {
    tools[CESIUM_TOOL_NAMES.cameraOrbit] = createCameraOrbit(config.cameraOrbit);
  }
  if (config.cameraGetPosition !== false && allowed(CESIUM_TOOL_NAMES.cameraGetPosition)) {
    tools[CESIUM_TOOL_NAMES.cameraGetPosition] = createCameraGetPosition(config.cameraGetPosition);
  }
  if (
    config.cameraSetControllerOptions !== false &&
    allowed(CESIUM_TOOL_NAMES.cameraSetControllerOptions)
  ) {
    tools[CESIUM_TOOL_NAMES.cameraSetControllerOptions] = createCameraSetControllerOptions(
      config.cameraSetControllerOptions,
    );
  }
  if (config.entityAdd !== false && allowed(CESIUM_TOOL_NAMES.entityAdd)) {
    tools[CESIUM_TOOL_NAMES.entityAdd] = createEntityAdd(config.entityAdd);
  }
  if (config.entityList !== false && allowed(CESIUM_TOOL_NAMES.entityList)) {
    tools[CESIUM_TOOL_NAMES.entityList] = createEntityList(config.entityList);
  }
  if (config.entityRemove !== false && allowed(CESIUM_TOOL_NAMES.entityRemove)) {
    tools[CESIUM_TOOL_NAMES.entityRemove] = createEntityRemove(config.entityRemove);
  }
  if (config.animationCreate !== false && allowed(CESIUM_TOOL_NAMES.animationCreate)) {
    tools[CESIUM_TOOL_NAMES.animationCreate] = createAnimationCreate(config.animationCreate);
  }
  if (config.animationRemove !== false && allowed(CESIUM_TOOL_NAMES.animationRemove)) {
    tools[CESIUM_TOOL_NAMES.animationRemove] = createAnimationRemove(config.animationRemove);
  }
  if (config.animationListActive !== false && allowed(CESIUM_TOOL_NAMES.animationListActive)) {
    tools[CESIUM_TOOL_NAMES.animationListActive] = createAnimationListActive(
      config.animationListActive,
    );
  }
  if (config.animationUpdatePath !== false && allowed(CESIUM_TOOL_NAMES.animationUpdatePath)) {
    tools[CESIUM_TOOL_NAMES.animationUpdatePath] = createAnimationUpdatePath(
      config.animationUpdatePath,
    );
  }
  if (
    config.animationCameraTracking !== false &&
    allowed(CESIUM_TOOL_NAMES.animationCameraTracking)
  ) {
    tools[CESIUM_TOOL_NAMES.animationCameraTracking] = createAnimationCameraTracking(
      config.animationCameraTracking,
    );
  }
  if (config.clockControl !== false && allowed(CESIUM_TOOL_NAMES.clockControl)) {
    tools[CESIUM_TOOL_NAMES.clockControl] = createClockControl(config.clockControl);
  }
  if (config.globeSetLighting !== false && allowed(CESIUM_TOOL_NAMES.globeSetLighting)) {
    tools[CESIUM_TOOL_NAMES.globeSetLighting] = createGlobeSetLighting(config.globeSetLighting);
  }
  if (config.imageryAdd !== false && allowed(CESIUM_TOOL_NAMES.imageryAdd)) {
    tools[CESIUM_TOOL_NAMES.imageryAdd] = createImageryAdd(config.imageryAdd);
  }
  if (config.imageryRemove !== false && allowed(CESIUM_TOOL_NAMES.imageryRemove)) {
    tools[CESIUM_TOOL_NAMES.imageryRemove] = createImageryRemove(config.imageryRemove);
  }
  if (config.imageryList !== false && allowed(CESIUM_TOOL_NAMES.imageryList)) {
    tools[CESIUM_TOOL_NAMES.imageryList] = createImageryList(config.imageryList);
  }

  return tools;
}
