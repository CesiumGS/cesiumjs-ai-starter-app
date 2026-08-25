import type { Viewer } from "cesium";
import { ENABLED_CESIUM_TOOLS, type EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { CODEGEN_CZML_TOOL_NAMES } from "@cesium-ai/codegen-czml/names";
import { createCesiumToolExecutors } from "@cesium-ai/tools";
import { createFrontendLogger } from "../utils/telemetry";
import { flyToLocation } from "./camera";

/** A client-side executor: runs one tool call against the live Viewer. */
export type ToolExecutor = (viewer: Viewer, args: unknown) => Promise<unknown>;

const toolsLogger = createFrontendLogger("@cesium-ai/tools");

/**
 * `@cesium-ai/tools`'s default executor for every `@cesium-ai/tools-schemas` tool,
 * with `flyTo` overridden by this app's extended `flyToLocation` (adds `duration`/
 * `easingFunction` via `createFlyToExecutor`). See `@cesium-ai/tools` README for the
 * override pattern; every other tool keeps its default.
 */
export const TOOL_EXECUTORS: Record<EnabledCesiumTool, ToolExecutor> = {
  ...createCesiumToolExecutors({ flyTo: flyToLocation }, toolsLogger),
  // executeCesiumCode is server-resolved; stub serves as defense-in-depth.
  [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: () =>
    Promise.resolve({
      success: false,
      error: "executeCesiumCode is resolved server-side; no client-side executor runs for it.",
    }),
  // generateCzml is server-resolved (intent -> verified CZML); stub serves as defense-in-depth.
  [CODEGEN_CZML_TOOL_NAMES.generateCzml]: () =>
    Promise.resolve({
      success: false,
      error: "generateCzml is resolved server-side; no client-side executor runs for it.",
    }),
} as Record<EnabledCesiumTool, ToolExecutor>;

/** Runtime set of enabled tools for defense-in-depth validation. */
export const ENABLED_TOOLS = new Set<EnabledCesiumTool>(ENABLED_CESIUM_TOOLS);
