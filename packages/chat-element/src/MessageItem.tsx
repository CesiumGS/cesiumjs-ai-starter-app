import { Typography } from "@mui/material";
import type { Message, ToolInvocation } from "./chat-client";
import { spanVariantMapping } from "./ui-constants";
import styles from "./AiChatPanel.module.css";

export function MessageItem({ message }: { message: Message }) {
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
        <ToolCard key={inv.toolCallId} invocation={inv} />
      ))}
    </div>
  );
}

function ToolCard({ invocation }: { invocation: ToolInvocation }) {
  return (
    <div className={styles.toolCard}>
      <Typography variantMapping={spanVariantMapping} className={styles.toolLabel}>
        [tool] {invocation.toolName}
      </Typography>
      <pre className={styles.toolArgs}>{JSON.stringify(invocation.args, null, 2)}</pre>
      {invocation.state === "result" && invocation.result !== undefined && (
        <pre className={styles.toolResult}>{JSON.stringify(invocation.result, null, 2)}</pre>
      )}
    </div>
  );
}
