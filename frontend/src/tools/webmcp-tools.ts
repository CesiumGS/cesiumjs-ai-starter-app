import type { Viewer } from "cesium";
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";
import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import {
  registerCesiumWebMcpTools,
  createConsoleWebMcpToolsLogger,
  type RegisteredCesiumWebMcpTools,
} from "@cesium-ai/webmcp-cesium";
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
    logger: import.meta.env.DEV ? createConsoleWebMcpToolsLogger("info") : undefined,
    cancelSignal,
  });
}
