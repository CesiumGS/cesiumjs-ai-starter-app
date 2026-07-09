import { useCallback } from "react";
import type { Viewer } from "cesium";
import { AiChatPanel } from "@cesium-ai/chat-element/react";
import { ENABLED_CESIUM_TOOLS, type EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-cesium/names";
import { flyToLocation } from "../tools/camera";
import { config } from "../utils/config";

interface ChatPanelProps {
  viewerRef: React.RefObject<Viewer | null>;
}

/** A client-side executor: runs one tool call against the live Viewer. */
type ToolExecutor = (viewer: Viewer, args: unknown) => Promise<unknown>;

/**
 * Client-side executors for the tools THIS app enabled. Keying the map by
 * `EnabledCesiumTool` (derived from the shared `ENABLED_CESIUM_TOOLS` allowlist
 * the backend builds its registry off) makes it self-checking in both
 * directions: it fails to compile unless there is an executor for *every*
 * enabled tool — so the app can't offer the model a tool the client can't run —
 * and it rejects an executor for any *non*-enabled tool. The frontend therefore
 * ships exactly the executors for the app's current tool surface, in lockstep
 * with the backend.
 *
 * We import only the schema-free `/names` subpath, so no tool definitions
 * (descriptions, Zod schemas) reach the client bundle.
 */
const TOOL_EXECUTORS: Record<EnabledCesiumTool, ToolExecutor> = {
  // flyToLocation validates the untrusted args against its own schema, so the
  // raw payload is passed straight through — no cast.
  [CESIUM_TOOL_NAMES.flyTo]: (viewer, args) => flyToLocation(viewer, args),
};

/**
 * The enabled tool names as a runtime set, from the same shared allowlist. The
 * backend only offers these tools to the model, so under normal operation no
 * other name reaches us; we still gate on it here as defense-in-depth, so a
 * disabled (or stale/spoofed) tool call — including inherited object keys like
 * `"toString"` — never drives the live Viewer.
 */
const ENABLED_TOOLS = new Set<EnabledCesiumTool>(ENABLED_CESIUM_TOOLS);

/**
 * Host-side tool-call listener. The chat element streams a server tool call up
 * via `onToolCall(toolName, args)`; we look up its client-side executor and run
 * it against the live `Viewer`, returning the result for the chat client to
 * post back to the agent loop. Unknown tools resolve with an error payload
 * rather than throwing, so the model can surface a graceful message.
 */
export default function ChatPanel({ viewerRef }: ChatPanelProps) {
  const handleToolCall = useCallback(
    (toolName: string, args: unknown): Promise<unknown> => {
      const viewer = viewerRef.current;
      if (!viewer) return Promise.reject(new Error("CesiumJS Viewer is not initialised"));

      if (!ENABLED_TOOLS.has(toolName as EnabledCesiumTool)) {
        return Promise.resolve({ success: false, error: `Unknown or disabled tool: ${toolName}` });
      }
      const executor = TOOL_EXECUTORS[toolName as EnabledCesiumTool];
      return executor(viewer, args);
    },
    [viewerRef],
  );

  return <AiChatPanel apiEndpoint={config.chatApiEndpoint} onToolCall={handleToolCall} />;
}
