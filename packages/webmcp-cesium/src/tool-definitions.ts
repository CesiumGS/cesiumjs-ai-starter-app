import type { z } from "zod";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import {
  DEFAULT_FLY_TO_DESCRIPTION,
  defaultFlyToInputSchema,
  DEFAULT_CAMERA_SET_VIEW_DESCRIPTION,
  defaultCameraSetViewInputSchema,
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION,
  defaultCameraLookAtTransformInputSchema,
  DEFAULT_CAMERA_ORBIT_DESCRIPTION,
  defaultCameraOrbitInputSchema,
  DEFAULT_CAMERA_GET_POSITION_DESCRIPTION,
  defaultCameraGetPositionInputSchema,
  DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION,
  defaultCameraSetControllerOptionsInputSchema,
  DEFAULT_ENTITY_ADD_DESCRIPTION,
  defaultEntityAddInputSchema,
  DEFAULT_ENTITY_LIST_DESCRIPTION,
  defaultEntityListInputSchema,
  DEFAULT_ENTITY_REMOVE_DESCRIPTION,
  defaultEntityRemoveInputSchema,
  DEFAULT_ANIMATION_CREATE_DESCRIPTION,
  defaultAnimationCreateInputSchema,
  DEFAULT_ANIMATION_REMOVE_DESCRIPTION,
  defaultAnimationRemoveInputSchema,
  DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION,
  defaultAnimationListActiveInputSchema,
  DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION,
  defaultAnimationUpdatePathInputSchema,
  DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION,
  defaultAnimationCameraTrackingInputSchema,
  DEFAULT_CLOCK_CONTROL_DESCRIPTION,
  defaultClockControlInputSchema,
  DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION,
  defaultGlobeSetLightingInputSchema,
  DEFAULT_IMAGERY_ADD_DESCRIPTION,
  defaultImageryAddInputSchema,
  DEFAULT_IMAGERY_REMOVE_DESCRIPTION,
  defaultImageryRemoveInputSchema,
  DEFAULT_IMAGERY_LIST_DESCRIPTION,
  defaultImageryListInputSchema,
} from "@cesium-ai/tools-schemas";

/** A tool's model-facing description plus its structural Zod input schema. */
export interface CesiumWebMcpToolDefinition {
  description: string;
  inputSchema: z.ZodTypeAny;
}

/**
 * One {@link CesiumWebMcpToolDefinition} per {@link CesiumToolName}, reusing the exact
 * description/schema pairs `@cesium-ai/tools-schemas` already builds for the AI SDK — kept as
 * plain Zod schemas here (rather than re-deriving JSON Schema from an AI SDK `Tool`'s internal
 * representation) so `z.toJSONSchema()` can convert them directly for WebMCP's `inputSchema`.
 */
export const CESIUM_WEBMCP_TOOL_DEFINITIONS: Record<CesiumToolName, CesiumWebMcpToolDefinition> = {
  [CESIUM_TOOL_NAMES.flyTo]: {
    description: DEFAULT_FLY_TO_DESCRIPTION,
    inputSchema: defaultFlyToInputSchema,
  },
  [CESIUM_TOOL_NAMES.cameraSetView]: {
    description: DEFAULT_CAMERA_SET_VIEW_DESCRIPTION,
    inputSchema: defaultCameraSetViewInputSchema,
  },
  [CESIUM_TOOL_NAMES.cameraLookAtTransform]: {
    description: DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION,
    inputSchema: defaultCameraLookAtTransformInputSchema,
  },
  [CESIUM_TOOL_NAMES.cameraOrbit]: {
    description: DEFAULT_CAMERA_ORBIT_DESCRIPTION,
    inputSchema: defaultCameraOrbitInputSchema,
  },
  [CESIUM_TOOL_NAMES.cameraGetPosition]: {
    description: DEFAULT_CAMERA_GET_POSITION_DESCRIPTION,
    inputSchema: defaultCameraGetPositionInputSchema,
  },
  [CESIUM_TOOL_NAMES.cameraSetControllerOptions]: {
    description: DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION,
    inputSchema: defaultCameraSetControllerOptionsInputSchema,
  },
  [CESIUM_TOOL_NAMES.entityAdd]: {
    description: DEFAULT_ENTITY_ADD_DESCRIPTION,
    inputSchema: defaultEntityAddInputSchema,
  },
  [CESIUM_TOOL_NAMES.entityList]: {
    description: DEFAULT_ENTITY_LIST_DESCRIPTION,
    inputSchema: defaultEntityListInputSchema,
  },
  [CESIUM_TOOL_NAMES.entityRemove]: {
    description: DEFAULT_ENTITY_REMOVE_DESCRIPTION,
    inputSchema: defaultEntityRemoveInputSchema,
  },
  [CESIUM_TOOL_NAMES.animationCreate]: {
    description: DEFAULT_ANIMATION_CREATE_DESCRIPTION,
    inputSchema: defaultAnimationCreateInputSchema,
  },
  [CESIUM_TOOL_NAMES.animationRemove]: {
    description: DEFAULT_ANIMATION_REMOVE_DESCRIPTION,
    inputSchema: defaultAnimationRemoveInputSchema,
  },
  [CESIUM_TOOL_NAMES.animationListActive]: {
    description: DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION,
    inputSchema: defaultAnimationListActiveInputSchema,
  },
  [CESIUM_TOOL_NAMES.animationUpdatePath]: {
    description: DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION,
    inputSchema: defaultAnimationUpdatePathInputSchema,
  },
  [CESIUM_TOOL_NAMES.animationCameraTracking]: {
    description: DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION,
    inputSchema: defaultAnimationCameraTrackingInputSchema,
  },
  [CESIUM_TOOL_NAMES.clockControl]: {
    description: DEFAULT_CLOCK_CONTROL_DESCRIPTION,
    inputSchema: defaultClockControlInputSchema,
  },
  [CESIUM_TOOL_NAMES.globeSetLighting]: {
    description: DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION,
    inputSchema: defaultGlobeSetLightingInputSchema,
  },
  [CESIUM_TOOL_NAMES.imageryAdd]: {
    description: DEFAULT_IMAGERY_ADD_DESCRIPTION,
    inputSchema: defaultImageryAddInputSchema,
  },
  [CESIUM_TOOL_NAMES.imageryRemove]: {
    description: DEFAULT_IMAGERY_REMOVE_DESCRIPTION,
    inputSchema: defaultImageryRemoveInputSchema,
  },
  [CESIUM_TOOL_NAMES.imageryList]: {
    description: DEFAULT_IMAGERY_LIST_DESCRIPTION,
    inputSchema: defaultImageryListInputSchema,
  },
};

/** Tools that only read Viewer state and never mutate it — surfaced as `annotations.readOnlyHint`. */
export const READ_ONLY_CESIUM_WEBMCP_TOOLS: ReadonlySet<CesiumToolName> = new Set([
  CESIUM_TOOL_NAMES.entityList,
  CESIUM_TOOL_NAMES.cameraGetPosition,
  CESIUM_TOOL_NAMES.animationListActive,
  CESIUM_TOOL_NAMES.imageryList,
]);
