import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { Button, Fab, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgDismiss from "@stratakit/icons/dismiss.svg";
import svgAiSparkle from "@stratakit/icons/ai-sparkle.svg";
import { ChatClient } from "./chat-client";
import type { ToolExecutionOutcome } from "./chat-client";
import { MessageItem } from "./MessageItem";
import { RegisteredTools } from "./RegisteredTools";
import { spanVariantMapping } from "./ui-constants";
import styles from "./AiChatPanel.module.css";

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 380;

export interface AiChatPanelProps {
  apiEndpoint?: string;
  /**
   * Endpoint reporting the host's full registered tool set (built-in tools
   * plus any dynamically-connected MCP tools), shaped `{ tools:
   * RegisteredTool[] }` — see `fetchRegisteredTools`/`backend/src/app.ts`'s
   * `GET /api/tools` for this repo's own implementation. When omitted, the
   * tools disclosure in the panel header isn't rendered at all.
   */
  toolsApiEndpoint?: string;
  /**
   * Base URL for session-scoped, user-initiated MCP OAuth connect routes
   * (e.g. "Connect to Cesium ion"), shaped `${apiBase}/api/mcp` — see this
   * repo's backend's `mcp-session-router.ts`. When omitted (or the host
   * reports no session-connectable servers), no connect UI is rendered.
   */
  mcpConnectApiBase?: string;
  onToolCall?: (toolName: string, args: unknown) => Promise<unknown>;
  /**
   * Fired whenever a server-resolved tool result (`tool-output-available`)
   * arrives — see {@link ChatClientOptions.onServerToolResult}. Threaded
   * straight through to the underlying {@link ChatClient}, following the same
   * pattern as `onToolCall` above.
   */
  onServerToolResult?: (toolCall: {
    toolCallId: string;
    toolName: string;
    output: unknown;
  }) => ToolExecutionOutcome | void | Promise<ToolExecutionOutcome | void>;
  /**
   * Overrides the panel's built-in Approve/Reject UI for a `needsApproval`-gated
   * tool call. When omitted (the common case), `AiChatPanel` shows its own
   * inline Approve/Reject buttons on the pending tool call in the transcript
   * and resolves this decision itself — the host doesn't need to render any
   * approval UI. Pass this only to implement a host-side policy that decides
   * without prompting the user (e.g. auto-approving certain tools) — the
   * built-in UI is then skipped entirely for calls this handles.
   */
  onApprovalRequired?: (toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<{ approved: boolean; reason?: string }>;
  /**
   * Hard cap on consecutive server round trips driven by client-resolved tool
   * calls. Fixed at mount — passed straight to the {@link ChatClient} that is
   * created once for the panel's lifetime. See
   * {@link ChatClientOptions.maxToolCallRounds} for the default.
   */
  maxToolCallRounds?: number;
}

/**
 * A tool call the panel's built-in Approve/Reject UI is currently showing —
 * `resolve` is the promise executor captured from `handleApprovalRequired`
 * below, called exactly once when the user picks a decision.
 */
interface PendingApproval {
  toolCallId: string;
  resolve: (decision: { approved: boolean; reason?: string }) => void;
}

function useChatClient(
  apiEndpoint: string,
  onToolCall: AiChatPanelProps["onToolCall"],
  onServerToolResult: AiChatPanelProps["onServerToolResult"],
  onApprovalRequired: AiChatPanelProps["onApprovalRequired"],
  maxToolCallRounds: AiChatPanelProps["maxToolCallRounds"],
  setPendingApproval: (pending: PendingApproval | null) => void,
) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Refs keep callbacks stable so the ChatClient doesn't need to be recreated
  const forceUpdateRef = useRef(forceUpdate);
  const onToolCallRef = useRef(onToolCall);
  const onServerToolResultRef = useRef(onServerToolResult);
  const onApprovalRequiredRef = useRef(onApprovalRequired);
  const setPendingApprovalRef = useRef(setPendingApproval);
  forceUpdateRef.current = forceUpdate;
  onToolCallRef.current = onToolCall;
  onServerToolResultRef.current = onServerToolResult;
  onApprovalRequiredRef.current = onApprovalRequired;
  setPendingApprovalRef.current = setPendingApproval;

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
      onServerToolResult: (toolCall) => onServerToolResultRef.current?.(toolCall),
      onApprovalRequired: (toolCall) => {
        // A host-supplied override skips the built-in UI entirely — it
        // decides (and resolves) without ever touching `pendingApproval`.
        if (onApprovalRequiredRef.current) return onApprovalRequiredRef.current(toolCall);

        // Otherwise, this IS the panel's approval UI: park the decision as
        // pending state, which `MessageItem`/`ToolCard` render Approve/Reject
        // buttons for, and resolve this promise from `handleApprove`/
        // `handleReject` below once the user picks one.
        return new Promise((resolve) => {
          setPendingApprovalRef.current({ toolCallId: toolCall.toolCallId, resolve });
        });
      },
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
  toolsApiEndpoint,
  mcpConnectApiBase,
  onToolCall,
  onServerToolResult,
  onApprovalRequired,
  maxToolCallRounds,
}: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { client, forceUpdate } = useChatClient(
    apiEndpoint,
    onToolCall,
    onServerToolResult,
    onApprovalRequired,
    maxToolCallRounds,
    setPendingApproval,
  );

  const handleApprove = useCallback(() => {
    setPendingApproval((current) => {
      current?.resolve({ approved: true });
      return null;
    });
  }, []);

  const handleReject = useCallback(() => {
    setPendingApproval((current) => {
      current?.resolve({ approved: false, reason: "Declined by the user." });
      return null;
    });
  }, []);

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
        <div className={styles.headerActions}>
          {(toolsApiEndpoint || mcpConnectApiBase) && (
            <RegisteredTools
              toolsApiEndpoint={toolsApiEndpoint}
              mcpConnectApiBase={mcpConnectApiBase}
            />
          )}
          <Tooltip title="Close chat panel">
            <IconButton aria-label="Close chat panel" size="small" onClick={() => setIsOpen(false)}>
              <Icon href={svgDismiss} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className={styles.messages} ref={messagesRef}>
        {client.messages.length === 0 ? (
          <Typography className={styles.emptyState}>
            Ask me to navigate the globe — e.g. &quot;fly to Tokyo&quot;
          </Typography>
        ) : (
          client.messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              approval={{
                pendingApprovalToolCallId: pendingApproval?.toolCallId ?? null,
                onApprove: handleApprove,
                onReject: handleReject,
              }}
            />
          ))
        )}
      </div>

      <div className={styles.inputArea}>
        <form className={styles.inputForm} onSubmit={handleSubmit}>
          <div className={styles.chatInputBox} data-testid="chat-input-wrapper">
            <div className={styles.chatInputRow}>
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
              <Button
                type="submit"
                variant="contained"
                disabled={client.isLoading || !client.input.trim()}
                className={styles.sendButton}
              >
                {client.isLoading ? "…" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
