import { Typography } from "@mui/material";
import type { Message } from "./chat-client";
import { spanVariantMapping } from "./ui-constants";
import { ToolCard, type PendingApprovalHandlers } from "./ToolCard";
import styles from "./AiChatPanel.module.css";

export type { PendingApprovalHandlers } from "./ToolCard";

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
