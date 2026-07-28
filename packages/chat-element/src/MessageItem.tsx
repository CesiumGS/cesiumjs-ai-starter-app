import { Typography } from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./chat-client";
import type { RegisteredToolMcpApp } from "./registered-tools";
import { spanVariantMapping } from "./ui-constants";
import { ToolCard, type PendingApprovalHandlers } from "./ToolCard";
import styles from "./AiChatPanel.module.css";

export type { PendingApprovalHandlers } from "./ToolCard";

export function MessageItem({
  message,
  approval,
  codeResultToolName,
  mcpAppByToolName,
  mcpAppApiBase,
}: {
  message: Message;
  approval?: PendingApprovalHandlers;
  /** Forwarded straight through to {@link ToolCard} — see its prop doc. */
  codeResultToolName?: string;
  /** Forwarded straight through to {@link ToolCard} — MCP Apps widget lookup, keyed by namespaced tool name. */
  mcpAppByToolName?: ReadonlyMap<string, RegisteredToolMcpApp>;
  /** Forwarded straight through to {@link ToolCard} — see its `mcpAppApiBase` prop. */
  mcpAppApiBase?: string;
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
          render={<div />}
          data-testid={isError ? "error-text" : isUser ? "user-bubble" : "assistant-text"}
          className={`${styles.messageContent} ${
            isError ? styles.errorMessage : isUser ? styles.userBubble : ""
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <div className={styles.markdown}>
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          )}
        </Typography>
      )}
      {message.toolInvocations?.map((inv) => (
        <ToolCard
          key={inv.toolCallId}
          invocation={inv}
          isPendingApproval={approval?.pendingApprovalToolCallId === inv.toolCallId}
          onApprove={approval?.onApprove}
          onReject={approval?.onReject}
          codeResultToolName={codeResultToolName}
          mcpApp={mcpAppByToolName?.get(inv.toolName)}
          mcpAppApiBase={mcpAppApiBase}
        />
      ))}
    </div>
  );
}
