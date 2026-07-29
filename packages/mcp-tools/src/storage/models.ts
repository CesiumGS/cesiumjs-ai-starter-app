import type { MCPClient } from "@ai-sdk/mcp";
import type { McpTool } from "../mcp-app-meta.js";
import type { PendingSessionOAuth } from "../session/session-oauth-connect.js";

/**
 * One in-flight, not-yet-completed OAuth connection attempt for one browser
 * session + MCP server. Mostly plain data — `sessionId`, `serverName`,
 * `state`, `startedAt` are all serializable — EXCEPT `oauth.provider`, which
 * is a live `OAuthClientProvider` object (closures over its own token/PKCE
 * state), not plain data. Pending connections are therefore process-local;
 * persistence would require a separate serializable model and provider
 * reconstruction API that this package does not currently expose.
 */
export interface PendingMcpConnection {
  sessionId: string;
  serverName: string;
  /** The OAuth `state` value this flow was started with - the only thing a shared, server-name-agnostic callback route has to route on. */
  state: string;
  /** `Date.now()` when this flow was started - used to decide whether a later `connect()` call may supersede it as abandoned. */
  startedAt: number;
  oauth: PendingSessionOAuth;
}

/**
 * Serializable snapshot of a {@link PendingMcpConnection}, with the live
 * `oauth` provider dropped. Safe to write to an external store (Redis, Azure
 * Table, ...) for cross-process observability — e.g. "does this session have
 * an OAuth flow in flight for this server, and since when" — but a process
 * that needs to actually complete the flow (`completeCallback`) must own the
 * matching in-memory `PendingMcpConnection` (with its live `oauth.provider`)
 * itself; there is no way to reconstruct the provider from this descriptor.
 */
export interface PendingMcpConnectionDescriptor {
  sessionId: string;
  serverName: string;
  state: string;
  startedAt: number;
}

/** Derives a {@link PendingMcpConnectionDescriptor} from a live `PendingMcpConnection`, dropping the non-serializable `oauth` provider. */
export function toPendingMcpConnectionDescriptor(
  entry: PendingMcpConnection,
): PendingMcpConnectionDescriptor {
  return {
    sessionId: entry.sessionId,
    serverName: entry.serverName,
    state: entry.state,
    startedAt: entry.startedAt,
  };
}

/**
 * One live, fully-connected MCP session for one browser session + MCP
 * server. Unlike {@link PendingMcpConnection}, this can NEVER be persisted
 * to an external store - `client` is an open network connection and
 * `tools`' functions are closures bound to it. Any implementation of
 * `McpConnectionRepository<ConnectedMcpConnection>` (see `../storage/repositories.js`) is
 * necessarily in-memory and scoped to the process that created the
 * connection.
 */
export interface ConnectedMcpConnection {
  sessionId: string;
  serverName: string;
  client: MCPClient;
  /** Each tool carries its own `mcpApp` widget metadata (if any) — see `McpTool`. */
  tools: Record<string, McpTool>;
}

/**
 * Serializable snapshot of a {@link ConnectedMcpConnection}'s metadata, with
 * `client` and `tools` (live connection/closures) dropped in favor of
 * `toolNames`. Safe to write to an external store (Redis, Azure Table, ...)
 * for cross-process observability — e.g. "is this session connected to this
 * server, and what tools did it last have" — but it is NOT a substitute for
 * `ConnectedMcpConnection` itself: there is no way to turn a descriptor back
 * into a live client. A process that needs the actual connection must run
 * the real connect flow again and hold the result in its own in-memory
 * `McpConnectionRepository<ConnectedMcpConnection>`.
 */
export interface ConnectedMcpConnectionDescriptor {
  sessionId: string;
  serverName: string;
  /** Namespaced tool names this connection contributed (`Object.keys(tools)`), for introspection without the live `ToolSet`. */
  toolNames: readonly string[];
  /** `Date.now()` when this connection was established (or last replaced), for TTL/staleness checks by a store that doesn't track it itself. */
  connectedAt: number;
}

/** Derives a {@link ConnectedMcpConnectionDescriptor} from a live `ConnectedMcpConnection`, dropping the non-serializable `client`/`tools` closures. */
export function toConnectedMcpConnectionDescriptor(
  entry: ConnectedMcpConnection,
  connectedAt: number = Date.now(),
): ConnectedMcpConnectionDescriptor {
  return {
    sessionId: entry.sessionId,
    serverName: entry.serverName,
    toolNames: Object.keys(entry.tools),
    connectedAt,
  };
}
