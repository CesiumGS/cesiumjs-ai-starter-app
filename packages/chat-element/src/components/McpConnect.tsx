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
} from "../mcp/mcp-connect";
import { listenForMcpOAuthResult } from "../mcp/mcp-oauth-channel";
import type { RegisteredTool } from "../mcp/registered-tools";
import { ToolGroup, filterToolsForGroup } from "./ToolGroup";
import { spanVariantMapping } from "../utils/ui-constants";
import styles from "./AiChatPanel.module.css";

/**
 * How often to check whether the OAuth popup itself has been closed (a
 * plain, local `Window.closed` property read — no network call at all), so
 * an abandoned attempt (the user closes the popup without completing
 * consent, or without this browser supporting `BroadcastChannel` at all —
 * see `mcp-oauth-channel.ts`) still resolves to a final connected/failed
 * state instead of leaving the row stuck on "Connecting…" forever.
 */
const CLOSED_CHECK_INTERVAL_MS = 500;

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
   * `${apiBase}/api/mcp` — see `@cesium-ai/server`'s `mcp-session-router.ts`.
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
 * URL; it navigates through the provider's consent screen, back to this
 * backend's shared callback route, which renders a small, plain "Connected"/
 * "Connection failed" page directly (rather than redirecting to a frontend —
 * this backend may be shared by more than one frontend origin, so there's no
 * single one always correct to bounce back to) and self-closes. This
 * component learns the actual outcome PUSHED from that popup via
 * `window.postMessage` (see `mcp-oauth-channel.ts`), matched against the
 * exact popup `Window` reference this component opened rather than by
 * origin — no network polling on this end at all. A lightweight, purely-
 * local `Window.closed` check (see `CLOSED_CHECK_INTERVAL_MS`) is kept as a
 * fallback so an abandoned attempt (popup closed without completing) still
 * resolves to a final state instead of hanging on "Connecting…" forever.
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
  /**
   * Per-server cleanup for an in-flight connect attempt: unsubscribes the
   * `BroadcastChannel` listener and stops the local popup-closed check.
   * Keyed by server name so a new attempt for the same server cleanly
   * replaces (rather than doubles up with) any still-pending previous one.
   */
  const watchersRef = useRef(new Map<string, () => void>());

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
            connected: statuses[i]?.connected ?? false,
            connecting: false,
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase, onServerNames]);

  // Stop every in-flight watcher on unmount — nothing left to update.
  useEffect(() => {
    const watchers = watchersRef.current;
    return () => {
      for (const stop of watchers.values()) stop();
      watchers.clear();
    };
  }, []);

  const stopWatching = useCallback((name: string) => {
    const stop = watchersRef.current.get(name);
    if (stop !== undefined) {
      stop();
      watchersRef.current.delete(name);
    }
  }, []);

  /**
   * Watches for `name`'s connect attempt to resolve: primarily via the
   * `postMessage` push from the OAuth popup itself (backend-rendered — see
   * `renderMcpCallbackHtml` in `@cesium-ai/server`'s `mcp-session-router.ts`;
   * near-instant, no network call on this end), with a local `Window.closed`
   * check as a fallback — covers the user closing the popup without
   * completing consent (in which case the popup's own ~1.5s auto-close is
   * what eventually triggers the fallback's single status fetch below).
   * Whichever settles first wins; the other is torn down immediately via
   * `stopWatching`.
   */
  const watchForOutcome = useCallback(
    (name: string, popup: Window) => {
      stopWatching(name);

      const applyOutcome = (connected: boolean, error: string | undefined) => {
        stopWatching(name);
        if (!popup.closed) popup.close();
        setServers((prev) =>
          prev.map((s) =>
            s.name === name
              ? connected
                ? { ...s, connecting: false, connected: true, error: undefined }
                : {
                    ...s,
                    connecting: false,
                    connected: false,
                    error: error ?? "Connection failed.",
                  }
              : s,
          ),
        );
        if (connected) {
          setOpenServer((current) => (current === name ? null : current));
          onConnectionChange?.();
        } else {
          // Surface the failure as an anchored popup next to the row, since
          // there's no other Connect button left to show it near.
          setOpenServer(name);
        }
      };

      const unsubscribe = listenForMcpOAuthResult(popup, (message) => {
        if (message.server !== name) return;
        applyOutcome(message.connected, message.error);
      });

      const closedTimer = setInterval(() => {
        if (!popup.closed) return;
        clearInterval(closedTimer);
        // The popup is gone with no broadcast having arrived (e.g. the user
        // closed it manually, or this browser lacks `BroadcastChannel`
        // support) — do the one, final status check `McpCallbackPage` would
        // otherwise have pushed, rather than continuously polling.
        void fetchMcpConnectionStatus(apiBase, name).then((status) => {
          applyOutcome(status.connected, status.error);
        });
      }, CLOSED_CHECK_INTERVAL_MS);

      watchersRef.current.set(name, () => {
        unsubscribe();
        clearInterval(closedTimer);
      });
    },
    [apiBase, onConnectionChange, stopWatching],
  );

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
      // Clear any leftover pending attempt first — e.g. a previous popup the
      // user closed (or that otherwise never reached the callback route)
      // still counts as "pending" on the backend for `pendingTtlMs`, which
      // would otherwise make THIS attempt fail immediately with "already
      // pending" and leave the user stuck with no way to retry from the UI.
      // A no-op if nothing was actually pending/connected.
      await disconnectMcpServer(apiBase, name);
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
      watchForOutcome(name, popup);
    },
    [apiBase, watchForOutcome],
  );

  const handleDisconnect = useCallback(
    async (name: string) => {
      stopWatching(name);
      await disconnectMcpServer(apiBase, name);
      setServers((prev) => prev.map((s) => (s.name === name ? { ...s, connected: false } : s)));
      setOpenServer((current) => (current === name ? null : current));
      onConnectionChange?.();
    },
    [apiBase, onConnectionChange, stopWatching],
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
