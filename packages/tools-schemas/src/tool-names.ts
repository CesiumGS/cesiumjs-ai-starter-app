/**
 * Canonical CesiumJS tool identifiers — the **single source of truth** for tool
 * names, shared by the server tool registry and the client-side executors.
 *
 * This module imports nothing (no `ai`, no `zod`, no schemas) on purpose: the
 * frontend imports it to build its executor map, so it must stay free of tool
 * *definitions* to keep schemas out of the client bundle. Names alone are not
 * sensitive — they already appear in the tool-call payloads streamed to the
 * browser.
 *
 * The contract this enforces:
 * - The **server** registers a subset of these names (see `createCesiumTools`).
 * - The **client** implements an executor for every one of these names (a
 *   `Record<CesiumToolName, …>`, checked at compile time).
 *
 * Therefore the set the server can stream is always a subset of what the client
 * can execute — the two sides cannot drift apart for the dangerous direction.
 */
export const CESIUM_TOOL_NAMES = {
  flyTo: "flyTo",
  // camera
  cameraSetView: "cameraSetView",
  cameraLookAtTransform: "cameraLookAtTransform",
  cameraOrbit: "cameraOrbit",
  cameraGetPosition: "cameraGetPosition",
  cameraSetControllerOptions: "cameraSetControllerOptions",
  // entity
  entityAdd: "entityAdd",
  entityList: "entityList",
  entityRemove: "entityRemove",
  // animation
  animationCreate: "animationCreate",
  animationControl: "animationControl",
  animationRemove: "animationRemove",
  animationListActive: "animationListActive",
  animationUpdatePath: "animationUpdatePath",
  animationCameraTracking: "animationCameraTracking",
  clockControl: "clockControl",
  globeSetLighting: "globeSetLighting",
  // imagery
  imageryAdd: "imageryAdd",
  imageryRemove: "imageryRemove",
  imageryList: "imageryList",
} as const;

/** Union of every CesiumJS tool name. */
export type CesiumToolName = (typeof CESIUM_TOOL_NAMES)[keyof typeof CESIUM_TOOL_NAMES];
