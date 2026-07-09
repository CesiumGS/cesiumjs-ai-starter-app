import { useCallback, useRef } from "react";
import type { Viewer } from "cesium";
import * as Cesium from "cesium";
import { AiChatPanel } from "@cesium-ai/chat-element/react";
import { ENABLED_CESIUM_TOOLS, type EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-cesium/names";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { flyToLocation } from "../tools/camera";
import {
  executeCesiumCodeResultShape,
  isExecuteCesiumCodeTool,
} from "../tools/execute-cesium-code";
import { config } from "../utils/config";
import type { ChatClient } from "@cesium-ai/chat-element";

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
 * We import only the schema-free `/names` subpaths (from both
 * `@cesium-ai/tools-cesium`, for `flyTo`, and `@cesium-ai/codegen-cesium`, for
 * `executeCesiumCode`), so no tool definitions (descriptions, Zod schemas)
 * reach the client bundle.
 */
const TOOL_EXECUTORS: Record<EnabledCesiumTool, ToolExecutor> = {
  // flyToLocation validates the untrusted args against its own schema, so the
  // raw payload is passed straight through — no cast.
  [CESIUM_TOOL_NAMES.flyTo]: (viewer, args) => flyToLocation(viewer, args),
  // executeCesiumCode is server-executed (see `backend/src/tools/execute-cesium-code-tool.ts`):
  // its `tool-output-available` chunk always resolves the invocation before
  // `resolveClientToolCalls` runs, so this executor should never actually be
  // invoked. It's still required to satisfy `Record<EnabledCesiumTool, …>` —
  // kept as a defensive stub that reports the (unexpected) call rather than
  // silently doing nothing.
  [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: () =>
    Promise.resolve({
      success: false,
      error: "executeCesiumCode is resolved server-side; no client-side executor runs for it.",
    }),
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
  // Reference to the chat client for reporting tool-execution errors
  const chatClientRef = useRef<ChatClient | null>(null);

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

  /**
   * `executeCesiumCode` is approved and its snippet is generated and
   * statically verified server-side. Execute the verified code against the
   * live Viewer without a sandbox (security relies on server-side AST verification).
   */
  const runApprovedCode = useCallback(
    (code: string) => {
      const viewer = viewerRef.current;
      if (!viewer) {
        chatClientRef.current?.reportError("CesiumJS Viewer is not initialised");
        return;
      }

      try {
        // Create a function that receives both viewer and Cesium namespace as parameters
        // This allows the generated code to access both the viewer instance and Cesium APIs
        const executeCode = new Function("viewer", "Cesium", code);
        executeCode(viewer, Cesium);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        chatClientRef.current?.reportError(`Code execution failed: ${errorMessage}`);
      }
    },
    [viewerRef],
  );

  /**
   * Server-resolved tool result listener. `executeCesiumCode` is the one
   * enabled tool whose server-resolved output still needs a client-side
   * action: once the backend has generated and statically verified a CesiumJS
   * snippet — which, since the tool is `needsApproval`-gated, only happens
   * after `@cesium-ai/chat-element`'s built-in Approve/Reject UI already got
   * an explicit human "go ahead" for the intent — this host runs it. `output`
   * is validated defensively before anything runs: it is server-influenced
   * but still not implicitly trusted here.
   */
  const handleServerToolResult = useCallback(
    (toolCall: { toolCallId: string; toolName: string; output: unknown }) => {
      if (!isExecuteCesiumCodeTool(toolCall.toolName)) return;

      const parsed = executeCesiumCodeResultShape.safeParse(toolCall.output);
      if (!parsed.success) {
        chatClientRef.current?.reportError("Malformed executeCesiumCode result.");
        return;
      }
      if ("error" in parsed.data) {
        // Verification failed server-side — nothing to run, and the
        // existing result-display path (the chat transcript) already shows
        // the error via the tool invocation's result.
        return;
      }

      runApprovedCode(parsed.data.code);
    },
    [runApprovedCode],
  );

  return (
    <AiChatPanel
      apiEndpoint={config.chatApiEndpoint}
      onToolCall={handleToolCall}
      onServerToolResult={handleServerToolResult}
      onClientReady={(client) => {
        chatClientRef.current = client;
      }}
    />
  );
}
