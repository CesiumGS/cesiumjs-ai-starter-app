import { Button, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgChevronRight from "@stratakit/icons/chevron-right.svg";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolInvocation } from "../chat-client";
import { formatToolPayload } from "../utils/format-tool-payload";
import { StructuredResult, type StructuredResultRenderer } from "./StructuredResult";
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

interface ErrorPanelInfo {
  testId: string;
  title: string;
  message: string;
}

/**
 * Pure derivation of a resolved invocation's structured-result state: whether `config`'s `field`
 * applies to this result, and which of its `errorFields` (if any) have a string message to show
 * in their own panel (see `ToolResultErrorPanel`). Kept separate from `ToolCard`'s render body so
 * the data derivation reads independently of the JSX, and can be unit-tested on its own.
 */
function resolveStructuredResult(
  invocation: ToolInvocation,
  config: StructuredResultRenderer | undefined,
): { hasResult: boolean; isStructuredResult: boolean; errorPanels: ErrorPanelInfo[] } {
  const hasResult = invocation.state === "result" && invocation.result !== undefined;
  const isStructuredResult = hasResult && config !== undefined;
  const record =
    isStructuredResult && invocation.result && typeof invocation.result === "object"
      ? (invocation.result as Record<string, unknown>)
      : undefined;
  const errorPanels = (config?.errorFields ?? [])
    .map((errorField): ErrorPanelInfo | undefined => {
      const message = record?.[errorField.field];
      if (typeof message !== "string") return undefined;
      const title =
        typeof errorField.title === "function" ? errorField.title(record ?? {}) : errorField.title;
      return { testId: errorField.testId, title, message };
    })
    .filter((panel): panel is ErrorPanelInfo => panel !== undefined);
  return { hasResult, isStructuredResult, errorPanels };
}

export function ToolCard({
  invocation,
  isPendingApproval,
  onApprove,
  onReject,
  structuredResult,
  mcpApp,
  mcpAppApiBase,
  mcpAppSandboxUrl,
}: {
  invocation: ToolInvocation;
  isPendingApproval: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  /**
   * Config for this invocation's tool, already resolved by toolName (see `AiChatPanel`'s
   * `structuredResults` prop and `MessageItem`'s `structuredResultByToolName` lookup) — when set,
   * its `field` renders via {@link StructuredResult} (a dedicated `.codeBlock` panel) instead of
   * the generic result view, and each of its `errorFields` renders in its own error-styled panel
   * (see `ToolResultErrorPanel` below). Undefined means this tool call gets no special-cased
   * treatment.
   */
  structuredResult?: StructuredResultRenderer;
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
  const { hasResult, isStructuredResult, errorPanels } = resolveStructuredResult(
    invocation,
    structuredResult,
  );
  const resultText = hasResult && !isStructuredResult ? formatToolPayload(invocation.result) : "";
  const structuredLength = isStructuredResult ? formatToolPayload(invocation.result).length : 0;
  const combinedLength = argsText.length + resultText.length + structuredLength;
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
          (isStructuredResult && structuredResult ? (
            <StructuredResult result={invocation.result} config={structuredResult} />
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
      {errorPanels.map((panel) => (
        <ToolResultErrorPanel
          key={panel.testId}
          testId={panel.testId}
          title={panel.title}
          message={panel.message}
        />
      ))}
    </>
  );
}

/**
 * A distinct, error-styled panel shown as a SIBLING of a `structuredResult`-configured tool's
 * `ToolCard` (not nested inside it) for one of its `errorFields` (see `StructuredResult.tsx`'s
 * `StructuredResultErrorField`). Kept as its own panel — rather than folded into the tool card's
 * result output — so a failure reads as clearly distinct from a successful tool call, similar to
 * how a top-level `error-text` message bubble is visually separated from a normal assistant
 * message.
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
