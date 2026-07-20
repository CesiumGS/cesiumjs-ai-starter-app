import { useState } from "react";
import { Button, IconButton, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgCopy from "@stratakit/icons/copy.svg";
import svgCheckmark from "@stratakit/icons/checkmark.svg";
import type { Message, ToolInvocation } from "./chat-client";
import { spanVariantMapping } from "./ui-constants";
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
 * Renders a tool's `result` payload for display. Plain values fall back to
 * normal JSON formatting, but top-level string fields (e.g. an
 * `executeCesiumCode` result's `code`) are printed as their raw text instead
 * of a JSON-escaped, single-line string — so multi-line source code renders
 * with real line breaks instead of literal `\n` characters.
 */
function formatToolPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return JSON.stringify(payload, null, 2);
  }
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) =>
      typeof value === "string" ? `${key}:\n${value}` : `${key}: ${JSON.stringify(value, null, 2)}`,
    )
    .join("\n\n");
}

/**
 * Tool panels whose combined args/result text is at or under this size start
 * expanded; longer ones start collapsed (see {@link ToolCard}).
 */
const AUTO_EXPAND_THRESHOLD = 300;

/**
 * Specialized result renderer for the `executeCesiumCode` tool: its `code`
 * field is real CesiumJS source (often long), so it gets a dedicated
 * `.codeBlock` style — unwrapped lines with both vertical AND horizontal
 * scrolling (unlike the generic `.toolResult`, which word-wraps), so long
 * lines/indentation stay readable instead of being squeezed or breaking
 * mid-token — plus a copy button. `error` (AST-verification/generation
 * failure) and `executionError` (runtime failure) are intentionally NOT
 * rendered here — {@link ToolCard} pulls both out and shows them in their
 * own separate, error-styled panels instead (see {@link ToolResultErrorPanel}),
 * so a failure reads as clearly distinct from a successful result rather
 * than blending into the plain result text. Any other result field still
 * renders via the generic {@link formatToolPayload}.
 */
function ExecuteCesiumCodeResult({ result }: { result: unknown }) {
  if (result === null || typeof result !== "object") {
    return <pre className={styles.toolResult}>{formatToolPayload(result)}</pre>;
  }
  const {
    code,
    executionError: _executionError,
    error: _error,
    ...rest
  } = result as Record<string, unknown>;
  const hasOtherFields = Object.keys(rest).length > 0;
  return (
    <>
      {hasOtherFields && <pre className={styles.toolResult}>{formatToolPayload(rest)}</pre>}
      {typeof code === "string" && (
        <div className={styles.codeBlockWrapper}>
          <pre className={styles.codeBlock}>{code}</pre>
          <CopyCodeButton code={code} />
        </div>
      )}
    </>
  );
}

type CopyState = "idle" | "copied" | "error";

/**
 * Copies generated code to the clipboard via the `navigator.clipboard` API.
 * Rendered as a small icon button overlaid in the corner of the code panel
 * (not the `<summary>` toggle, so no click-propagation concerns with the
 * parent `<details>`), swapping to a checkmark icon briefly on success before
 * resetting to the plain copy icon after 1.5s.
 */
function CopyCodeButton({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  const label = state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : "Copy code";

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        size="small"
        className={styles.copyButton}
        onClick={handleClick}
      >
        <Icon href={state === "copied" ? svgCheckmark : svgCopy} />
      </IconButton>
    </Tooltip>
  );
}

export function MessageItem({
  message,
  approval,
}: {
  message: Message;
  approval?: PendingApprovalHandlers;
}) {
  const isUser = message.role === "user";
  const isError = message.error === true;
  return (
    <div className={styles.message} data-testid="message-item" data-role={message.role}>
      <Typography
        variantMapping={spanVariantMapping}
        className={`${styles.sender} ${
          isError ? styles.errorSender : isUser ? styles.userSender : styles.assistantSender
        }`}
      >
        {isError ? "Error" : isUser ? "You" : "Assistant"}
      </Typography>
      {message.content && (
        <Typography
          data-testid={isError ? "error-text" : isUser ? "user-bubble" : "assistant-text"}
          className={`${styles.messageContent} ${
            isError ? styles.errorMessage : isUser ? styles.userBubble : ""
          }`}
        >
          {message.content}
        </Typography>
      )}
      {message.toolInvocations?.map((inv) => (
        <ToolCard
          key={inv.toolCallId}
          invocation={inv}
          isPendingApproval={approval?.pendingApprovalToolCallId === inv.toolCallId}
          onApprove={approval?.onApprove}
          onReject={approval?.onReject}
        />
      ))}
    </div>
  );
}

function ToolCard({
  invocation,
  isPendingApproval,
  onApprove,
  onReject,
}: {
  invocation: ToolInvocation;
  isPendingApproval: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const argsText = JSON.stringify(invocation.args, null, 2);
  const hasResult = invocation.state === "result" && invocation.result !== undefined;
  const isCodeResult = hasResult && invocation.toolName === "executeCesiumCode";
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

  return (
    <>
      <details className={styles.toolCard} open={defaultOpen}>
        <summary className={styles.toolSummary}>[tool] {invocation.toolName}</summary>
        <pre className={styles.toolArgs}>{argsText}</pre>
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
 * normal assistant message. Previously only `executionError` got this
 * treatment, which made a verification failure look like a plain/successful
 * result — both are equally failures and now share the same critical
 * styling, distinguished only by `title`/`testId`.
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
