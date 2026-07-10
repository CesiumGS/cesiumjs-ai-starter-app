import { Button, Typography } from "@mui/material";
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
  return (
    <div className={styles.toolCard}>
      <Typography variantMapping={spanVariantMapping} className={styles.toolLabel}>
        [tool] {invocation.toolName}
      </Typography>
      <pre className={styles.toolArgs}>{JSON.stringify(invocation.args, null, 2)}</pre>
      {invocation.state === "result" && invocation.result !== undefined && (
        <pre className={styles.toolResult}>{JSON.stringify(invocation.result, null, 2)}</pre>
      )}
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
    </div>
  );
}
