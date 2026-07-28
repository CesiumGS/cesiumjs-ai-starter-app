import type { MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { McpAppToolInfo } from "../create-mcp-tools.js";
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
 * One live, fully-connected MCP session for one browser session + MCP
 * server. Unlike {@link PendingMcpConnection}, this can NEVER be persisted
 * to an external store - `client` is an open network connection and
 * `tools`' functions are closures bound to it. Any implementation of
 * `McpConnectedConnectionRepository` (see `../storage/repositories.js`) is
 * necessarily in-memory and scoped to the process that created the
 * connection.
 */
export interface ConnectedMcpConnection {
  sessionId: string;
  serverName: string;
  client: MCPClient;
  tools: ToolSet;
  /** MCP Apps widget metadata for this connection's tools, keyed by NAMESPACED tool name — see `McpToolsHandle.appTools`. */
  appTools: Record<string, McpAppToolInfo>;
}
