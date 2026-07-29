import { useCallback, useState } from "react";
import { Button, Typography } from "@mui/material";
import { AppRenderer } from "@mcp-ui/client";
import type {
  CallToolRequest,
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import styles from "./AiChatPanel.module.css";

/**
 * Placeholder height shown only until the widget reports its real content
 * size via `onSizeChanged` (see the `contentHeight` state below) — most
 * widgets report a size well under this shortly after loading, at which
 * point the container shrinks to match instead of leaving blank space.
 */
const DEFAULT_LOADING_HEIGHT = "300px";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = (await res.json().catch(() => undefined)) as (T & { error?: string }) | undefined;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status}).`);
  return body as T;
}

/** A widget-initiated `tools/call` request awaiting the user's inline Approve/Reject decision. */
interface PendingToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  resolve: (result: CallToolResult) => void;
  reject: (error: Error) => void;
}

export interface McpAppWidgetProps {
  /** Base URL for the widget bridge routes, e.g. `${apiBase}/api/mcp-app` — see `@cesium-ai/server`'s `mcp-app-router.ts`. */
  appApiBase: string;
  /** MCP server this tool/resource belongs to (parsed from the invocation's namespaced tool name). */
  server: string;
  /** Raw (un-namespaced) tool name this widget was launched from. */
  toolName: string;
  /** The `ui://` resource URI to fetch and render. */
  resourceUri: string;
  /** The tool call's own input arguments, if already available. */
  toolInput?: Record<string, unknown>;
  /** The tool call's own result, if already available — passed to the widget so it can render without an extra round trip. */
  toolResult?: CallToolResult;
  /**
   * URL of the static sandbox proxy page (see
   * `@mcp-ui/client`'s "Sandbox Proxy" docs) that actually hosts/isolates the
   * widget iframe. Defaults to `/sandbox_proxy.html` at the current page's
   * origin — the host app must serve that file (e.g. as a static asset).
   */
  sandboxUrl?: URL;
}

/**
 * Renders one MCP Apps widget (a `ui://` HTML resource) inline using the
 * official `@mcp-ui/client` `AppRenderer` — the real MCP Apps host
 * implementation (JSON-RPC over postMessage, double-iframe sandbox proxy),
 * rather than a hand-rolled protocol, since a widget's own bootstrap script
 * only speaks the real spec.
 *
 * No in-browser MCP client is used (this app deliberately keeps MCP
 * connections/credentials server-side) — `toolResourceUri` + the
 * `onReadResource`/`onCallTool` callbacks proxy through this app's own
 * backend (`/api/mcp-app/resource`, `/api/mcp-app/tool-call`) instead.
 *
 * Security model:
 * - The widget itself never runs in this app's own origin/DOM — `AppRenderer`
 *   isolates it inside the sandbox proxy's OWN nested iframe (see
 *   `frontend/public/sandbox_proxy.html`).
 * - A `tools/call` request from the widget is NEVER executed automatically —
 *   it shows an inline Approve/Reject prompt and only reaches the backend
 *   once approved. `resources/read` (the backend independently restricts to
 *   `ui://` URIs) doesn't need approval since it can't mutate anything.
 * - `onOpenLink` only allows https/http/mailto schemes.
 */
export function McpAppWidget({
  appApiBase,
  server,
  toolName,
  resourceUri,
  toolInput,
  toolResult,
  sandboxUrl,
}: McpAppWidgetProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingCall, setPendingCall] = useState<PendingToolCall | null>(null);
  // Tracks the widget's own reported content height (via `onSizeChanged`) so
  // the container can shrink/grow to fit it instead of sitting at a fixed
  // placeholder height regardless of how tall the widget's actual content is.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const resolvedSandboxUrl = sandboxUrl ?? new URL("/sandbox_proxy.html", window.location.origin);

  const onReadResource = useCallback(
    async ({ uri }: { uri: string }): Promise<ReadResourceResult> => {
      return fetchJson<ReadResourceResult>(
        `${appApiBase}/resource?server=${encodeURIComponent(server)}&uri=${encodeURIComponent(uri)}`,
      );
    },
    [appApiBase, server],
  );

  const onCallTool = useCallback((params: CallToolRequest["params"]): Promise<CallToolResult> => {
    return new Promise<CallToolResult>((resolve, reject) => {
      setPendingCall((current) => {
        if (current) {
          reject(new Error("Another action is already awaiting your approval."));
          return current;
        }
        return { name: params.name, arguments: params.arguments, resolve, reject };
      });
    });
  }, []);

  const handleApproveCall = useCallback(() => {
    if (!pendingCall) return;
    const { name, arguments: args, resolve, reject } = pendingCall;
    setPendingCall(null);
    fetchJson<CallToolResult>(`${appApiBase}/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server, toolName: name, arguments: args }),
    })
      .then(resolve)
      .catch((err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
  }, [appApiBase, pendingCall, server]);

  const handleRejectCall = useCallback(() => {
    if (!pendingCall) return;
    pendingCall.reject(new Error("The user declined this action."));
    setPendingCall(null);
  }, [pendingCall]);

  const onSizeChanged = useCallback(({ height }: { width?: number; height?: number }) => {
    if (typeof height === "number" && height > 0) {
      setContentHeight(height);
    }
  }, []);

  const onOpenLink = useCallback(async ({ url }: { url: string }) => {
    const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    if (!scheme || !["https", "http", "mailto"].includes(scheme)) {
      return { isError: true };
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return {};
  }, []);

  if (error) {
    return (
      <div className={styles.executionErrorPanel} data-testid="mcp-app-widget-error">
        <Typography className={styles.executionErrorTitle}>Widget failed to load</Typography>
        <pre className={styles.executionErrorText}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      data-testid="mcp-app-widget"
      className={styles.mcpAppWidget}
      style={{ height: contentHeight ? `${contentHeight}px` : DEFAULT_LOADING_HEIGHT }}
    >
      <AppRenderer
        toolName={toolName}
        toolResourceUri={resourceUri}
        sandbox={{ url: resolvedSandboxUrl }}
        toolInput={toolInput}
        toolResult={toolResult}
        onReadResource={onReadResource}
        onCallTool={onCallTool}
        onOpenLink={onOpenLink}
        onSizeChanged={onSizeChanged}
        onMessage={async () => ({})}
        onError={(err) => setError(err.message)}
      />
      {pendingCall && (
        <div
          role="group"
          aria-label={`Approve widget call to ${pendingCall.name}`}
          className={styles.approvalActions}
        >
          <Typography className={styles.approvalPrompt}>
            This widget wants to call <code>{pendingCall.name}</code> on &quot;{server}&quot; —
            nothing runs until you decide.
          </Typography>
          <pre className={styles.toolArgs}>
            {JSON.stringify(pendingCall.arguments ?? {}, null, 2)}
          </pre>
          <div className={styles.approvalButtons}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              className={styles.approvalButton}
              onClick={handleRejectCall}
            >
              Reject
            </Button>
            <Button
              size="small"
              variant="contained"
              className={styles.approvalButton}
              onClick={handleApproveCall}
            >
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
