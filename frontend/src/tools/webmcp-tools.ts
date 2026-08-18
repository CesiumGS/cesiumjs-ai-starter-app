import type { Viewer } from "cesium";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import {
  registerCesiumWebMcpTools,
  type RegisteredCesiumWebMcpTools,
  type WebMcpToolsLogger,
} from "@cesium-ai/webmcp-cesium";
import { createFrontendLogger } from "../utils/telemetry";
import { flyToLocation } from "./camera";

/**
 * This app's enabled viewer tools, narrowed to the subset `@cesium-ai/webmcp-cesium` covers.
 * `ENABLED_CESIUM_TOOLS` also includes `executeCesiumCode` (server-resolved, no client-side
 * executor) — that one is never a WebMCP tool here.
 */
const ENABLED_WEBMCP_TOOLS = ENABLED_CESIUM_TOOLS.filter(
  (name): name is CesiumToolName => name in CESIUM_TOOL_NAMES,
);

/**
 * Adapts the frontend's variadic-`meta` telemetry logger to `@cesium-ai/webmcp-cesium`'s
 * fixed-shape `WebMcpToolsLogger`, mirroring the same pattern used for `@cesium-ai/tools`'s
 * `ToolsLogger` in `cesium-tool-executors.ts`. Routes WebMCP registration/tool-call logs through
 * this app's OTEL-wired telemetry in both dev and prod, instead of console-only in dev and silent
 * in prod.
 */
const webMcpLoggerSource = createFrontendLogger("@cesium-ai/webmcp-cesium");
const webMcpLogger: WebMcpToolsLogger = {
  debug: (message, meta) => webMcpLoggerSource.debug(message, meta),
  info: (message, meta) => webMcpLoggerSource.info(message, meta),
  warn: (message, meta) => webMcpLoggerSource.warn(message, meta),
  error: (message, meta) => webMcpLoggerSource.error(message, meta),
};

/**
 * Registers this app's viewer tools on `document.modelContext` (the WebMCP Imperative API) so an
 * in-browser agent (e.g. the Model Context Tool Inspector extension, or Chrome's built-in AI) can
 * call them directly against the live `Viewer`. No-ops in browsers without WebMCP support — see
 * `packages/webmcp-cesium/README.md` for how to enable and test it.
 */
export function registerAppWebMcpTools(
  viewer: Viewer,
  cancelSignal?: AbortSignal,
): Promise<RegisteredCesiumWebMcpTools> {
  return registerCesiumWebMcpTools(viewer, {
    enabled: ENABLED_WEBMCP_TOOLS,
    // Same flyTo override as the chat-driven executors (adds duration/easingFunction).
    executors: { flyTo: flyToLocation },
    logger: webMcpLogger,
    cancelSignal,
  });
}
