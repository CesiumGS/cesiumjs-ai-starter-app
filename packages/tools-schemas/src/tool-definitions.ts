import type { z } from "zod";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "./tool-names.js";
import { DEFAULT_FLY_TO_DESCRIPTION, defaultFlyToInputSchema } from "./tools/flyTo/flyTo.js";
import {
  DEFAULT_CAMERA_SET_VIEW_DESCRIPTION,
  defaultCameraSetViewInputSchema,
} from "./tools/cameraSetView/cameraSetView.js";
import {
  DEFAULT_CAMERA_LOOK_AT_TRANSFORM_DESCRIPTION,
  defaultCameraLookAtTransformInputSchema,
} from "./tools/cameraLookAtTransform/cameraLookAtTransform.js";
import {
  DEFAULT_CAMERA_ORBIT_DESCRIPTION,
  defaultCameraOrbitInputSchema,
} from "./tools/cameraOrbit/cameraOrbit.js";
import {
  DEFAULT_CAMERA_GET_POSITION_DESCRIPTION,
  defaultCameraGetPositionInputSchema,
} from "./tools/cameraGetPosition/cameraGetPosition.js";
import {
  DEFAULT_CAMERA_SET_CONTROLLER_OPTIONS_DESCRIPTION,
  defaultCameraSetControllerOptionsInputSchema,
} from "./tools/cameraSetControllerOptions/cameraSetControllerOptions.js";
import {
  DEFAULT_ENTITY_ADD_DESCRIPTION,
  defaultEntityAddInputSchema,
} from "./tools/entityAdd/entityAdd.js";
import {
  DEFAULT_ENTITY_LIST_DESCRIPTION,
  defaultEntityListInputSchema,
} from "./tools/entityList/entityList.js";
import {
  DEFAULT_ENTITY_REMOVE_DESCRIPTION,
  defaultEntityRemoveInputSchema,
} from "./tools/entityRemove/entityRemove.js";
import {
  DEFAULT_ANIMATION_CREATE_DESCRIPTION,
  defaultAnimationCreateInputSchema,
} from "./tools/animationCreate/animationCreate.js";
import {
  DEFAULT_ANIMATION_REMOVE_DESCRIPTION,
  defaultAnimationRemoveInputSchema,
} from "./tools/animationRemove/animationRemove.js";
import {
  DEFAULT_ANIMATION_LIST_ACTIVE_DESCRIPTION,
  defaultAnimationListActiveInputSchema,
} from "./tools/animationListActive/animationListActive.js";
import {
  DEFAULT_ANIMATION_UPDATE_PATH_DESCRIPTION,
  defaultAnimationUpdatePathInputSchema,
} from "./tools/animationUpdatePath/animationUpdatePath.js";
import {
  DEFAULT_ANIMATION_CAMERA_TRACKING_DESCRIPTION,
  defaultAnimationCameraTrackingInputSchema,
} from "./tools/animationCameraTracking/animationCameraTracking.js";
import {
  DEFAULT_CLOCK_CONTROL_DESCRIPTION,
  defaultClockControlInputSchema,
} from "./tools/clockControl/clockControl.js";
import {
  DEFAULT_GLOBE_SET_LIGHTING_DESCRIPTION,
  defaultGlobeSetLightingInputSchema,
} from "./tools/globeSetLighting/globeSetLighting.js";
import {
  DEFAULT_IMAGERY_ADD_DESCRIPTION,
  defaultImageryAddInputSchema,
} from "./tools/imageryAdd/imageryAdd.js";
import {
  DEFAULT_IMAGERY_REMOVE_DESCRIPTION,
  defaultImageryRemoveInputSchema,
} from "./tools/imageryRemove/imageryRemove.js";
import {
  DEFAULT_IMAGERY_LIST_DESCRIPTION,
  defaultImageryListInputSchema,
} from "./tools/imageryList/imageryList.js";

/** A tool's default model-facing description plus its structural Zod input schema. */
export interface CesiumToolDefinition {
  description: string;
  inputSchema: z.ZodTypeAny;
}

/**
 * One {@link CesiumToolDefinition} per {@link CesiumToolName} — the package's single canonical
 * `name -> {default description, default Zod input schema}` registry. `createCesiumTools` wraps
 * these (via each tool's `createX`) into AI SDK `Tool`s for the agent loop; consumers that need
 * the raw Zod schema instead of an AI-SDK-wrapped `Tool` (e.g. `@cesium-ai/webmcp-cesium`, which
 * feeds `z.toJSONSchema()`) should import this directly rather than re-deriving or duplicating it.
 */
export const CESIUM_TOOL_DEFINITIONS: Record<CesiumToolName, CesiumToolDefinition> = {
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
