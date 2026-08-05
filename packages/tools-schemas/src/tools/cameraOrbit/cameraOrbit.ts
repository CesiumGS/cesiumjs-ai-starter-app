import { z } from "zod";
import { createToolFactory, type ClientToolConfig } from "../../lib/client-tool.js";
import { cameraOrbitActionValues, cameraOrbitInputShape } from "./cameraOrbit.schema.js";

/** Default natural-language description handed to the model for `cameraOrbit`. */
export const DEFAULT_CAMERA_ORBIT_DESCRIPTION =
  'Start or stop an automated circular orbit of the camera around the current look-at target (set via cameraLookAtTransform). Choose `action` "start" (with optional speed/direction) to begin orbiting, or "stop" to return to manual navigation.';

/** Per-field model-facing `.describe()` hints for the `cameraOrbit` input schema. */
export interface CameraOrbitFieldDescriptions {
  action?: string;
  speed?: string;
  direction?: string;
}

/** Default **model-facing** `.describe()` hint for each `cameraOrbit` input field. */
export const DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS: Required<CameraOrbitFieldDescriptions> = {
  // Listed from cameraOrbitActionValues so it can't drift from the actual supported actions.
  action: `Orbit action: ${cameraOrbitActionValues.join(", ")}.`,
  speed: 'Orbit speed multiplier (0.1-10). Defaults to 1.0. Only used when action is "start".',
  direction: 'Orbit direction. Defaults to clockwise. Only used when action is "start".',
};

/**
 * Builds the **model-facing** `cameraOrbit` input schema: the shared discriminated-union
 * shape ({@link cameraOrbitInputShape}) decorated with the natural-language
 * `.describe()` hints the LLM reads.
 */
export function buildCameraOrbitInputSchema(descriptions: CameraOrbitFieldDescriptions = {}) {
  const actionDescription = descriptions.action ?? DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.action;
  const speedDescription = descriptions.speed ?? DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.speed;
  const directionDescription =
    descriptions.direction ?? DEFAULT_CAMERA_ORBIT_FIELD_DESCRIPTIONS.direction;

  const [startOption, stopOption] = cameraOrbitInputShape.options;

  return z.discriminatedUnion("action", [
    startOption.extend({
      action: startOption.shape.action.describe(actionDescription),
      speed: startOption.shape.speed.describe(speedDescription),
      direction: startOption.shape.direction.describe(directionDescription),
    }),
    stopOption.extend({
      action: stopOption.shape.action.describe(actionDescription),
    }),
  ]);
}

/** Default model-facing `cameraOrbit` input schema, using every default field hint. */
export const defaultCameraOrbitInputSchema = buildCameraOrbitInputSchema();

/** Per-tool overrides for {@link createCameraOrbit}. */
export type CameraOrbitConfig = ClientToolConfig<CameraOrbitFieldDescriptions>;

/**
 * `cameraOrbit` — a **client-side tool**: it deliberately has no `execute`
 * function. The AI SDK streams the tool call to the browser, which runs it
 * against the live `Viewer` instance and streams the result back.
 */
export const createCameraOrbit = createToolFactory(
  DEFAULT_CAMERA_ORBIT_DESCRIPTION,
  buildCameraOrbitInputSchema,
);

/** Ready-to-use `cameraOrbit` tool with default description and schema. */
export const cameraOrbit = createCameraOrbit();
