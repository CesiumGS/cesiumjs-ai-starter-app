import type { Viewer } from "cesium";
import { ENABLED_CESIUM_TOOLS, type EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { createCesiumToolExecutors, type ToolsLogger } from "@cesium-ai/tools";
import { createFrontendLogger } from "../utils/telemetry";
import { flyToLocation } from "./camera";

/** A client-side executor: runs one tool call against the live Viewer. */
export type ToolExecutor = (viewer: Viewer, args: unknown) => Promise<unknown>;

/**
 * Adapts the frontend's variadic-`meta` telemetry logger to `@cesium-ai/tools`'s fixed-shape
 * `ToolsLogger`, mirroring the same pattern used for `@cesium-ai/chat-element`'s `ChatLogger` in
 * `ChatPanel.tsx`. Passed to `createCesiumToolExecutors` so every executor's outcome (success, a
 * resolved `{ error }`, or a thrown rejection) is reported through this app's OTEL-wired
 * telemetry instead of vanishing silently whenever nothing reads the result's `error` field.
 */
const toolsLoggerSource = createFrontendLogger("@cesium-ai/tools");
const toolsLogger: ToolsLogger = {
  debug: (message, meta) => toolsLoggerSource.debug(message, meta),
  info: (message, meta) => toolsLoggerSource.info(message, meta),
  warn: (message, meta) => toolsLoggerSource.warn(message, meta),
  error: (message, meta) => toolsLoggerSource.error(message, meta),
};

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
} as Record<EnabledCesiumTool, ToolExecutor>;

/** Runtime set of enabled tools for defense-in-depth validation. */
export const ENABLED_TOOLS = new Set<EnabledCesiumTool>(ENABLED_CESIUM_TOOLS);
