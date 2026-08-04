import { Button, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgChevronRight from "@stratakit/icons/chevron-right.svg";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolInvocation } from "../chat-client";
import { formatToolPayload } from "../utils/format-tool-payload";
import { ExecuteCesiumCodeResult } from "./ExecuteCesiumCodeResult";
import { McpAppWidget } from "./McpAppWidget";
import { parseMcpToolName } from "../mcp/mcp-tool-name";
import type { RegisteredToolMcpApp } from "../mcp/registered-tools";
import styles from "./AiChatPanel.module.css";

/**
 * Decision callbacks for a `needsApproval`-gated tool call awaiting a human
 * go-ahead, plus which invocation (if any) they apply to. `AiChatPanel` owns
 * the actual pending-promise bookkeeping (see its `handleApprovalRequired`) —
 * this component only needs to know which `toolCallId`, if any, should show
 * Approve/Reject buttons right now, and what to call when they're clicked.
 */
export interface PendingApprovalHandlers {
  pendingApprovalToolCallId: string | null;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * Tool panels whose combined args/result text is at or under this size start
 * expanded; longer ones start collapsed (see {@link ToolCard}).
 */
export const AUTO_EXPAND_THRESHOLD = 300;

export function ToolCard({
  invocation,
  isPendingApproval,
  onApprove,
  onReject,
  codeResultToolName,
  mcpApp,
  mcpAppApiBase,
  mcpAppSandboxUrl,
}: {
  invocation: ToolInvocation;
  isPendingApproval: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  /**
   * Tool name that gets the dedicated code/error rendering (see
   * {@link ExecuteCesiumCodeResult} and `ToolResultErrorPanel` below) instead
   * of the generic result view.
   * Omitted means no tool call gets this special-cased treatment.
   */
  codeResultToolName?: string;
  /**
   * MCP Apps widget metadata for THIS invocation's tool, if it declared one
   * (see `RegisteredTool.mcpApp` / `AiChatPanel`'s tools lookup). When set
   * (and `mcpAppApiBase` is also provided), renders the widget inline via
   * {@link McpAppWidget} instead of/alongside the plain JSON result.
   */
  mcpApp?: RegisteredToolMcpApp;
  /** Base URL for the MCP Apps widget bridge routes — see `McpAppWidget`'s `appApiBase` prop. */
  mcpAppApiBase?: string;
  /** Host-served sandbox proxy URL forwarded to {@link McpAppWidget}. */
  mcpAppSandboxUrl?: URL;
}) {
  const argsText = JSON.stringify(invocation.args, null, 2);
  const hasResult = invocation.state === "result" && invocation.result !== undefined;
  const isCodeResult =
    hasResult && codeResultToolName !== undefined && invocation.toolName === codeResultToolName;
  const resultText = hasResult && !isCodeResult ? formatToolPayload(invocation.result) : "";
  const generationError =
    isCodeResult && invocation.result && typeof invocation.result === "object"
      ? (invocation.result as Record<string, unknown>).error
      : undefined;
  const generationErrorText = typeof generationError === "string" ? generationError : undefined;
  const executionError =
    isCodeResult && invocation.result && typeof invocation.result === "object"
      ? (invocation.result as Record<string, unknown>).executionError
      : undefined;
  const executionErrorText = typeof executionError === "string" ? executionError : undefined;
  const codeLength =
    isCodeResult && invocation.result && typeof invocation.result === "object"
      ? Object.values(invocation.result as Record<string, unknown>).reduce<number>(
          (total, value) => total + (typeof value === "string" ? value.length : 0),
          0,
        )
      : 0;
  const combinedLength = argsText.length + resultText.length + codeLength;
  const defaultOpen = isPendingApproval || combinedLength <= AUTO_EXPAND_THRESHOLD;
  const parsedMcpName = parseMcpToolName(invocation.toolName);

  return (
    <>
      <details className={styles.toolCard} open={defaultOpen}>
        <summary className={styles.toolSummary}>
          <Icon href={svgChevronRight} className={styles.toolSummaryIcon} />
          [tool] {invocation.toolName}
        </summary>
        <pre className={styles.toolArgs}>{argsText}</pre>
        {mcpApp && mcpAppApiBase && parsedMcpName && (
          <McpAppWidget
            appApiBase={mcpAppApiBase}
            server={parsedMcpName.server}
            toolName={parsedMcpName.displayName}
            resourceUri={mcpApp.resourceUri}
            toolInput={invocation.args as Record<string, unknown> | undefined}
            toolResult={hasResult ? (invocation.result as unknown as CallToolResult) : undefined}
            sandboxUrl={mcpAppSandboxUrl}
          />
        )}
        {hasResult &&
          (isCodeResult ? (
            <ExecuteCesiumCodeResult result={invocation.result} />
          ) : (
            <pre className={styles.toolResult}>{resultText}</pre>
          ))}
        {isPendingApproval && (
          <div
            role="group"
            aria-label={`Approve call to ${invocation.toolName}`}
            className={styles.approvalActions}
          >
            <Typography className={styles.approvalPrompt}>
              Waiting for your approval — nothing runs until you decide.
            </Typography>
            <div className={styles.approvalButtons}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                className={styles.approvalButton}
                onClick={onReject}
              >
                Reject
              </Button>
              <Button
                size="small"
                variant="contained"
                className={styles.approvalButton}
                onClick={onApprove}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </details>
      {generationErrorText && (
        <ToolResultErrorPanel
          testId="generation-error-panel"
          title="Generation error"
          message={generationErrorText}
        />
      )}
      {executionErrorText && (
        <ToolResultErrorPanel
          testId="execution-error-panel"
          title="Execution error"
          message={executionErrorText}
        />
      )}
    </>
  );
}

/**
 * A distinct, error-styled panel shown as a SIBLING of `executeCesiumCode`'s
 * `ToolCard` (not nested inside it), used for BOTH failure modes the tool can
 * report: `result.error` (the generated code was rejected by static AST
 * verification, or generation itself failed) and `result.executionError`
 * (the code passed verification but threw at runtime). Kept as its own panel
 * — rather than folded into the tool card's result output — so either kind of
 * failure reads as clearly distinct from a successful tool call, similar to
 * how a top-level `error-text` message bubble is visually separated from a
 * normal assistant message.
 */
function ToolResultErrorPanel({
  testId,
  title,
  message,
}: {
  testId: string;
  title: string;
  message: string;
}) {
  return (
    <div className={styles.executionErrorPanel} data-testid={testId}>
      <Typography className={styles.executionErrorTitle}>{title}</Typography>
      <pre className={styles.executionErrorText}>{message}</pre>
    </div>
  );
}
