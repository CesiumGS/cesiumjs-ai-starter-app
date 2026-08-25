import { useCallback, useRef } from "react";
import type { Viewer } from "cesium";
import { AiChatPanel } from "@cesium-ai/chat-element/react";
import type { EnabledCesiumTool } from "@cesium-ai/sample-config";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";
import { CODEGEN_CZML_TOOL_NAMES } from "@cesium-ai/codegen-czml/names";
import { ENABLED_TOOLS, TOOL_EXECUTORS } from "../tools/cesium-tool-executors";
import {
  handleExecuteCesiumCodeResult,
  isExecuteCesiumCodeTool,
} from "../tools/execute-cesium-code";
import { handleGenerateCzmlResult, isGenerateCzmlTool } from "../tools/generate-czml";
import { DEFAULT_RATE_LIMIT, SandboxCallRateLimiter } from "../utils/sandbox-call-rate-limiter";
import { config } from "../utils/config";
import { createFrontendLogger, frontendLogger } from "../utils/telemetry";
import type { StructuredResultRenderer, ToolExecutionOutcome } from "@cesium-ai/chat-element";

interface ChatPanelProps {
  viewerRef: React.RefObject<Viewer | null>;
}

const chatElementLogger = createFrontendLogger("@cesium-ai/chat-element");

/**
 * Dedicated `ToolCard` rendering for this app's two codegen tools (see
 * `AiChatPanel`'s `structuredResults` prop / `StructuredResult.tsx`): each gets its generated
 * content in a copyable `.codeBlock` panel, plus its own error field(s) broken out into distinct
 * error-styled panels instead of the generic result view.
 */
const STRUCTURED_RESULTS: StructuredResultRenderer[] = [
  {
    toolName: CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode,
    field: "code",
    copyLabel: "Copy code",
    errorFields: [
      { field: "error", title: "Generation error", testId: "generation-error-panel" },
      { field: "executionError", title: "Execution error", testId: "execution-error-panel" },
    ],
  },
  {
    toolName: CODEGEN_CZML_TOOL_NAMES.generateCzml,
    field: "czml",
    copyLabel: "Copy CZML",
    errorFields: [
      {
        field: "error",
        // `czml` is only present alongside `error` when generation succeeded but the frontend's
        // later `CzmlDataSource` load failed (see `generate-czml.ts`'s `handleGenerateCzmlResult`)
        // — absent, the failure happened during generation itself.
        title: (result) => (Array.isArray(result.czml) ? "Load error" : "Generation error"),
        testId: "czml-error-panel",
      },
    ],
  },
];

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
      if (!viewer) {
        frontendLogger.warn("Tool call rejected because viewer is not initialised", { toolName });
        return Promise.reject(new Error("CesiumJS Viewer is not initialised"));
      }

      if (!ENABLED_TOOLS.has(toolName as EnabledCesiumTool)) {
        frontendLogger.warn("Tool call rejected because tool is unknown or disabled", { toolName });
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
   *
   * `generateCzml` follows the same "stop the agent loop, report the real
   * outcome in a follow-up" shape (see `backend/src/app.ts`'s
   * `stopAfterTools`), and is likewise approval-gated: unlike executeCesiumCode
   * this app's `AiChatPanel` requires no extra wiring here for that gate — the
   * Approve/Reject UI is generic (see `ToolCard.tsx`), driven entirely by the
   * backend's `resolveToolApproval`.
   */
  const handleServerToolResult = useCallback(
    async (toolCall: {
      toolCallId: string;
      toolName: string;
      output: unknown;
    }): Promise<ToolExecutionOutcome | undefined> => {
      if (isExecuteCesiumCodeTool(toolCall.toolName)) {
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
      }

      if (isGenerateCzmlTool(toolCall.toolName)) {
        const outcome = await handleGenerateCzmlResult(viewerRef.current, toolCall.output);

        return {
          result: outcome.success
            ? { ...(toolCall.output as object), entityCount: outcome.entityCount }
            : { ...(toolCall.output as object), error: outcome.error },
          continueConversation: true,
        };
      }

      return undefined;
    },
    [viewerRef],
  );

  return (
    <AiChatPanel
      apiBase={config.apiBase}
      onToolCall={handleToolCall}
      onServerToolResult={handleServerToolResult}
      structuredResults={STRUCTURED_RESULTS}
      logger={chatElementLogger}
    />
  );
}
