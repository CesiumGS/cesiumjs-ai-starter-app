import { useCallback, useRef } from "react";
import type { Viewer } from "cesium";
import { AiChatPanel } from "@cesium-ai/chat-element/react";
import { ENABLED_CESIUM_TOOLS, type EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CESIUM_TOOL_NAMES } from "@cesium-ai/tools-schemas/names";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { flyToLocation } from "../tools/camera";
import {
  handleExecuteCesiumCodeResult,
  isExecuteCesiumCodeTool,
} from "../tools/execute-cesium-code";
import { DEFAULT_RATE_LIMIT, SandboxCallRateLimiter } from "../utils/sandbox-call-rate-limiter";
import { config } from "../utils/config";
import type { ToolExecutionOutcome } from "@cesium-ai/chat-element";

interface ChatPanelProps {
  viewerRef: React.RefObject<Viewer | null>;
}

/** A client-side executor: runs one tool call against the live Viewer. */
type ToolExecutor = (viewer: Viewer, args: unknown) => Promise<unknown>;

/** Client-side executors for enabled tools, keyed by type for compile-time safety. */
const TOOL_EXECUTORS: Record<EnabledCesiumTool, ToolExecutor> = {
  [CESIUM_TOOL_NAMES.flyTo]: (viewer, args) => flyToLocation(viewer, args),
  // executeCesiumCode is server-resolved; stub serves as defense-in-depth.
  [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: () =>
    Promise.resolve({
      success: false,
      error: "executeCesiumCode is resolved server-side; no client-side executor runs for it.",
    }),
};

/** Runtime set of enabled tools for defense-in-depth validation. */
const ENABLED_TOOLS = new Set<EnabledCesiumTool>(ENABLED_CESIUM_TOOLS);

/** Executes tool calls against the live Viewer; handles unknown tools gracefully. */
export default function ChatPanel({ viewerRef }: ChatPanelProps) {
  // Defense-in-depth against a runaway/adversarial model calling the sandbox too often —
  // independent of whether any individual generated snippet is itself safe (see
  // `sandbox-call-rate-limiter.ts`). One instance per mounted ChatPanel, kept in a ref (rather
  // than state) so it survives re-renders without triggering any, and lazily constructed here
  // since passing `new SandboxCallRateLimiter(...)` as `useRef`'s initial value would otherwise
  // build a fresh limiter on every render.
  const sandboxRateLimiterRef = useRef<SandboxCallRateLimiter | null>(null);
  if (!sandboxRateLimiterRef.current) {
    sandboxRateLimiterRef.current = new SandboxCallRateLimiter(DEFAULT_RATE_LIMIT);
  }

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
   * Executes server-resolved code and reports the real outcome for model
   * feedback. The backend now always suppresses the model's reply for the
   * request that resolves `executeCesiumCode`'s approval (see
   * `packages/server/src/chat-router.ts`'s `suppressTextChunks`) — that
   * request can only carry a preliminary result (verification passed/failed,
   * not "actually ran"), so the model's one real chance to reply is always
   * this follow-up. `continueConversation` must therefore always be `true`
   * here, whether the outcome is success, a runtime execution failure, or a
   * verification failure the tool itself already reported as `{ error }`.
   */
  const handleServerToolResult = useCallback(
    async (toolCall: {
      toolCallId: string;
      toolName: string;
      output: unknown;
    }): Promise<ToolExecutionOutcome | undefined> => {
      if (!isExecuteCesiumCodeTool(toolCall.toolName)) return undefined;

      const errorMessage = await handleExecuteCesiumCodeResult(
        viewerRef.current,
        toolCall.output,
        () => sandboxRateLimiterRef.current?.checkAndRecord(),
      );

      return {
        result: errorMessage
          ? { ...(toolCall.output as object), executionError: errorMessage }
          : toolCall.output,
        continueConversation: true,
      };
    },
    [viewerRef],
  );

  return (
    <AiChatPanel
      apiEndpoint={config.chatApiEndpoint}
      onToolCall={handleToolCall}
      onServerToolResult={handleServerToolResult}
      codeResultToolName={CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode}
    />
  );
}
