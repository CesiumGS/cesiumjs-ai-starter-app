import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { Button, Fab, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgDismiss from "@stratakit/icons/dismiss.svg";
import svgAiSparkle from "@stratakit/icons/ai-sparkle.svg";
import { ChatClient } from "./chat-client";
import { MessageItem } from "./MessageItem";
import { spanVariantMapping } from "./ui-constants";
import styles from "./AiChatPanel.module.css";

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 380;

export interface AiChatPanelProps {
  apiEndpoint?: string;
  onToolCall?: (toolName: string, args: unknown) => Promise<unknown>;
  /**
   * Hard cap on consecutive server round trips driven by client-resolved tool
   * calls. Fixed at mount — passed straight to the {@link ChatClient} that is
   * created once for the panel's lifetime. See
   * {@link ChatClientOptions.maxToolCallRounds} for the default.
   */
  maxToolCallRounds?: number;
}

function useChatClient(
  apiEndpoint: string,
  onToolCall: AiChatPanelProps["onToolCall"],
  maxToolCallRounds: AiChatPanelProps["maxToolCallRounds"],
) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Refs keep callbacks stable so the ChatClient doesn't need to be recreated
  const forceUpdateRef = useRef(forceUpdate);
  const onToolCallRef = useRef(onToolCall);
  forceUpdateRef.current = forceUpdate;
  onToolCallRef.current = onToolCall;

  const clientRef = useRef<ChatClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new ChatClient({
      api: apiEndpoint,
      onUpdate: () => forceUpdateRef.current(),
      onError: () => forceUpdateRef.current(),
      onToolCall: ({ toolName, args }) =>
        onToolCallRef.current
          ? onToolCallRef.current(toolName, args)
          : Promise.reject(new Error(`Unknown tool: ${toolName}`)),
      maxToolCallRounds,
    });
  }

  useEffect(() => {
    clientRef.current?.setApi(apiEndpoint);
  }, [apiEndpoint]);

  useEffect(() => {
    return () => clientRef.current?.stop();
  }, []);

  return { client: clientRef.current, forceUpdate };
}

export function AiChatPanel({
  apiEndpoint = "/api/chat",
  onToolCall,
  maxToolCallRounds,
}: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { client, forceUpdate } = useChatClient(apiEndpoint, onToolCall, maxToolCallRounds);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  });

  // Tracks the in-progress drag's listener teardown so it can also run on
  // unmount — without this, unmounting mid-drag would leak the document
  // listeners (they'd otherwise only be removed by a mouseup that may never
  // fire on this panel again).
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;
      const onMouseMove = (mv: MouseEvent) => {
        setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - mv.clientX))));
      };
      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        resizeCleanupRef.current = null;
      };
      const onMouseUp = () => cleanup();
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      resizeCleanupRef.current = cleanup;
    },
    [panelWidth],
  );

  if (!isOpen) {
    return (
      <div style={{ width: 0, flexShrink: 0 }}>
        <div className={styles.toggleContainer}>
          <Tooltip title="Open AI chat panel">
            <Fab
              color="primary"
              onClick={() => setIsOpen(true)}
              aria-label="Open AI chat panel"
              className={styles.toggleButton}
            >
              <Icon href={svgAiSparkle} />
            </Fab>
          </Tooltip>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    client.submit();
  };

  return (
    <div className={styles.panel} style={{ width: panelWidth }}>
      <div
        className={styles.resizeHandle}
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
      />

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Typography variantMapping={spanVariantMapping} className={styles.title}>
            AI Assistant
          </Typography>
        </div>
        <Tooltip title="Close chat panel">
          <IconButton aria-label="Close chat panel" size="small" onClick={() => setIsOpen(false)}>
            <Icon href={svgDismiss} />
          </IconButton>
        </Tooltip>
      </div>

      <div className={styles.messages} ref={messagesRef}>
        {client.messages.length === 0 ? (
          <Typography className={styles.emptyState}>
            Ask me to navigate the globe — e.g. &quot;fly to Tokyo&quot;
          </Typography>
        ) : (
          client.messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
      </div>

      <div className={styles.inputArea}>
        <form className={styles.inputForm} onSubmit={handleSubmit}>
          <div className={styles.chatInput} data-testid="chat-input-wrapper">
            <TextField
              value={client.input}
              onChange={(e) => {
                client.input = e.target.value;
                forceUpdate();
              }}
              placeholder="Ask about the map…"
              disabled={client.isLoading}
              aria-label="Chat message"
              size="small"
              fullWidth
              className={styles.textField}
            />
          </div>
          <Button
            type="submit"
            variant="contained"
            disabled={client.isLoading || !client.input.trim()}
            className={styles.sendButton}
          >
            {client.isLoading ? "…" : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );
}
