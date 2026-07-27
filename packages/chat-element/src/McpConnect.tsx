import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Popover, Tooltip, Typography } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgCheckmark from "@stratakit/icons/checkmark.svg";
import svgKey from "@stratakit/icons/key.svg";
import svgMcpServer from "@stratakit/icons/mcp-server.svg";
import {
  beginMcpConnect,
  disconnectMcpServer,
  fetchMcpConnectionStatus,
  fetchSessionMcpServers,
} from "./mcp-connect";
import type { RegisteredTool } from "./registered-tools";
import { ToolGroup, filterToolsForGroup } from "./ToolGroup";
import { spanVariantMapping } from "./ui-constants";
import styles from "./AiChatPanel.module.css";

/** Message shape the backend's shared `/api/mcp/callback` popup page posts back to `window.opener`. */
interface McpOAuthMessage {
  type: "cesium-ai-mcp-oauth";
  server: string;
  ok: boolean;
  message?: string;
}

function isMcpOAuthMessage(data: unknown): data is McpOAuthMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "cesium-ai-mcp-oauth" &&
    typeof (data as { server?: unknown }).server === "string"
  );
}

interface ServerState {
  name: string;
  connected: boolean;
  connecting: boolean;
  /** Set when the last connect attempt (request-level or the OAuth flow itself) failed, so it can be shown to the user. */
  error?: string;
}

export interface McpConnectProps {
  /**
   * Base URL for the session-scoped MCP connect routes, e.g.
   * `${apiBase}/api/mcp` — see this repo's backend's `mcp-session-router.ts`.
   * When omitted (or the host reports no session-connectable servers), this
   * component renders nothing.
   */
  apiBase: string;
  /**
   * Case-insensitive substring filter applied to each server's name (e.g.
   * `RegisteredTools`'s search box) — a server whose name doesn't match is
   * hidden from view, but its connection state keeps updating normally in
   * the background. Blank/omitted shows every server.
   */
  filter?: string;
  /**
   * Called right after this session's connection to a server actually
   * changes (a connect completes, or a disconnect finishes) — lets a host
   * like `RegisteredTools` refetch its own tool list so a newly-connected
   * server's tools show up immediately, without waiting for the panel to be
   * closed and reopened.
   */
  onConnectionChange?: () => void;
  /**
   * Every tool currently registered on the backend, grouped by originating
   * MCP server name (see `RegisteredTools`'s `mcpToolsByServer`) — used to
   * show a connected session server's own tools (as a normal `ToolGroup`,
   * complete with a "Disconnect" action) instead of just a bare status row.
   * A server with no entry here (not yet connected, or connected but the
   * tools list hasn't refreshed yet) falls back to the plain connect-prompt
   * row.
   */
  serverTools?: Map<string, RegisteredTool[]>;
  /**
   * Called once this component has fetched the list of session-connectable
   * server names — lets `RegisteredTools` exclude these from its own
   * operator-configured `MCP: <server>` group rendering, since this
   * component renders them itself once connected.
   */
  onServerNames?: (names: string[]) => void;
}

/**
 * Lets the end user interactively connect their OWN account to one or more
 * user-initiated, OAuth-gated MCP servers (e.g. "Connect to Cesium ion") —
 * distinct from any always-on, operator-configured servers. Each connection
 * is scoped to this browser session only: the backend never persists these
 * tokens to disk, and they're discarded once the session disconnects (see
 * `@cesium-ai/mcp-tools`'s `createSessionMcpManager`).
 *
 * Rendered as one row per server inside the SAME popover/list as
 * `RegisteredTools`'s own tool groups — see that component's
 * `mcpConnectApiBase` prop. An unauthenticated server renders as a prompt
 * row (name + key icon); clicking it starts the OAuth flow immediately.
 * Once connected AND its tools are known (via `serverTools`), the row
 * instead renders as a full, expandable `ToolGroup` with an extra
 * "Disconnect" action.
 *
 * Connecting opens a separate browser popup to the returned authorization
 * URL; it navigates through the provider's consent screen and back to this
 * backend's callback route, which posts a `{type: "cesium-ai-mcp-oauth",
 * server, ok}` message to `window.opener` and closes itself — this
 * component listens for that message to learn the outcome without polling.
 */
export function McpConnect({
  apiBase,
  filter,
  onConnectionChange,
  serverTools,
  onServerNames,
}: McpConnectProps) {
  const [servers, setServers] = useState<ServerState[]>([]);
  /** Name of the server whose connect/disconnect popup is currently open, or `null` if none. */
  const [openServer, setOpenServer] = useState<string | null>(null);
  const anchorsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    fetchSessionMcpServers(apiBase).then(async (names) => {
      if (cancelled) return;
      onServerNames?.(names);
      if (names.length === 0) return;
      const statuses = await Promise.all(
        names.map((name) => fetchMcpConnectionStatus(apiBase, name)),
      );
      if (!cancelled) {
        setServers(
          names.map((name, i) => ({
            name,
            connected: statuses[i] ?? false,
            connecting: false,
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase, onServerNames]);

  useEffect(() => {
    let cancelled = false;
    const callbackOrigin = new URL(apiBase, window.location.href).origin;

    async function handleMessage(event: MessageEvent) {
      if (event.origin !== callbackOrigin || !isMcpOAuthMessage(event.data)) return;
      const { server, ok, message } = event.data;
      const connected = ok ? await fetchMcpConnectionStatus(apiBase, server) : false;
      if (cancelled) return;
      setServers((prev) =>
        prev.map((s) =>
          s.name === server
            ? {
                ...s,
                connecting: false,
                connected,
                error: connected
                  ? undefined
                  : (message ??
                    (ok ? "The server did not confirm the connection." : "Connection failed.")),
              }
            : s,
        ),
      );
      if (connected) {
        setOpenServer((current) => (current === server ? null : current));
        onConnectionChange?.();
      } else {
        // Surface the failure as an anchored popup next to the row, since
        // there's no other Connect button left to show it near.
        setOpenServer(server);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage);
    };
  }, [apiBase, onConnectionChange]);

  const handleConnect = useCallback(
    async (name: string) => {
      setServers((prev) =>
        prev.map((s) => (s.name === name ? { ...s, connecting: true, error: undefined } : s)),
      );
      // Open synchronously while this click still carries user activation;
      // browsers commonly block popups created only after an awaited fetch.
      const popup = window.open(
        "about:blank",
        `cesium-ai-mcp-oauth-${name}`,
        "width=500,height=700",
      );
      if (!popup) {
        setServers((prev) =>
          prev.map((s) =>
            s.name === name
              ? { ...s, connecting: false, error: "The authorization popup was blocked." }
              : s,
          ),
        );
        setOpenServer(name);
        return;
      }
      const result = await beginMcpConnect(apiBase, name);
      if ("error" in result) {
        popup.close();
        setServers((prev) =>
          prev.map((s) => (s.name === name ? { ...s, connecting: false, error: result.error } : s)),
        );
        setOpenServer(name);
        return;
      }
      popup.location.assign(result.authorizationUrl);
    },
    [apiBase],
  );

  const handleDisconnect = useCallback(
    async (name: string) => {
      await disconnectMcpServer(apiBase, name);
      setServers((prev) => prev.map((s) => (s.name === name ? { ...s, connected: false } : s)));
      setOpenServer((current) => (current === name ? null : current));
      onConnectionChange?.();
    },
    [apiBase, onConnectionChange],
  );

  const toggleOpen = useCallback((name: string) => {
    setOpenServer((current) => (current === name ? null : name));
  }, []);

  /**
   * The whole row is one big button: a connected server toggles its
   * Disconnect popup, same as before, but an unauthenticated one starts the
   * OAuth flow immediately instead of opening an intermediate popup with a
   * separate "Connect" button — the key icon itself IS the connect action.
   * Any resulting error still surfaces via the anchored popup (see
   * `handleConnect` and the OAuth-message handler above).
   */
  const handleRowClick = useCallback(
    (server: ServerState) => {
      if (server.connecting) return;
      if (server.connected) {
        toggleOpen(server.name);
        return;
      }
      void handleConnect(server.name);
    },
    [handleConnect, toggleOpen],
  );

  const query = filter?.trim().toLowerCase() ?? "";

  // A connected server whose tools are already known (via `serverTools`)
  // renders as a full `ToolGroup` further down; a name match alone isn't the
  // only way such a server can stay visible under a search query — one of
  // its own tools matching should keep it visible too, mirroring
  // `RegisteredTools`' own group-filtering semantics.
  const rows = servers
    .map((server) => {
      const toolsForServer = serverTools?.get(server.name) ?? [];
      const filteredTools = filterToolsForGroup(`MCP: ${server.name}`, toolsForServer, query);
      const nameMatches = !query || server.name.toLowerCase().includes(query);
      const visible = server.connected ? nameMatches || filteredTools.length > 0 : nameMatches;
      return { server, filteredTools, visible };
    })
    .filter((row) => row.visible);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map(({ server, filteredTools }) =>
        server.connected && filteredTools.length > 0 ? (
          <ToolGroup
            key={server.name}
            title={
              <>
                <Icon href={svgMcpServer} className={styles.toolGroupTitleIcon} /> {server.name}
              </>
            }
            tools={filteredTools}
            connected
            onDisconnect={() => void handleDisconnect(server.name)}
          />
        ) : (
          <div key={server.name} className={styles.toolGroup}>
            <button
              ref={(el) => {
                if (el) anchorsRef.current.set(server.name, el);
                else anchorsRef.current.delete(server.name);
              }}
              type="button"
              className={styles.toolGroupHeader}
              aria-haspopup="dialog"
              aria-expanded={openServer === server.name}
              onClick={() => handleRowClick(server)}
            >
              <Typography variantMapping={spanVariantMapping} className={styles.toolGroupTitle}>
                <Icon href={svgMcpServer} className={styles.toolGroupTitleIcon} /> {server.name}
              </Typography>
              <Tooltip
                title={
                  server.connecting
                    ? "Connecting…"
                    : server.connected
                      ? "Connected"
                      : "Click to authenticate"
                }
              >
                <span className={styles.mcpConnectStatusIcon}>
                  <Icon
                    href={server.connected ? svgCheckmark : svgKey}
                    className={
                      server.connected
                        ? styles.mcpConnectStatusIconOk
                        : styles.mcpConnectStatusIconWarn
                    }
                  />
                </span>
              </Tooltip>
            </button>

            <Popover
              open={openServer === server.name}
              anchorEl={anchorsRef.current.get(server.name) ?? null}
              onClose={() => setOpenServer(null)}
              anchorOrigin={{ vertical: "top", horizontal: "left" }}
              transformOrigin={{ vertical: "bottom", horizontal: "left" }}
              slotProps={{ paper: { className: styles.mcpConnectPopover } }}
            >
              <div className={styles.mcpConnectPopoverContent}>
                <Typography
                  variantMapping={spanVariantMapping}
                  variant="caption"
                  className={styles.mcpConnectPopoverTitle}
                >
                  {server.name}
                </Typography>
                {server.connected ? (
                  <Button size="small" onClick={() => void handleDisconnect(server.name)}>
                    Disconnect
                  </Button>
                ) : server.error ? (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={server.connecting}
                    onClick={() => void handleConnect(server.name)}
                  >
                    {server.connecting ? "Connecting…" : "Retry"}
                  </Button>
                ) : null}
                {server.error && (
                  <Typography variantMapping={spanVariantMapping} variant="caption" color="error">
                    {server.error}
                  </Typography>
                )}
              </div>
            </Popover>
          </div>
        ),
      )}
    </>
  );
}
