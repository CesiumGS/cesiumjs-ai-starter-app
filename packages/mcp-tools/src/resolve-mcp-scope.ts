import type { MCPClient } from "@ai-sdk/mcp";
import { namespacedToolName } from "./connection/connect-mcp-server.js";
import type { McpToolsHandle } from "./connection/create-mcp-tools.js";
import type { McpTool } from "./mcp-app-meta.js";
import type { SessionMcpManager } from "./session/session-mcp-manager.js";

/**
 * The two places a host app's MCP connections can live: `mcp` (operator-
 * configured, always-on servers — see `createMcpTools`) and `sessionMcp`
 * (per-browser-session, user-initiated OAuth connections — see
 * `createSessionMcpManager`). A server name is only ever meaningfully
 * connected through ONE of these two at a time in this package's
 * architecture (a server `createMcpTools` fails to connect to at startup
 * with a 401 is excluded from `mcp.tools`/`mcp.getClient` entirely and only
 * ever reachable via `sessionMcp` once a user connects it) — so every helper
 * below always checks `mcp` first, then falls back to `sessionMcp`, with no
 * separate `scope` parameter needed from the caller.
 */
export interface McpScope {
  mcp?: McpToolsHandle;
  sessionMcp?: SessionMcpManager;
}

/** Resolves the live `MCPClient` for `server`, checking `mcp` first, then `sessionId`'s own `sessionMcp` connections. */
export async function resolveMcpClient(
  scope: McpScope,
  sessionId: string,
  server: string,
): Promise<MCPClient | undefined> {
  const globalClient = scope.mcp?.getClient(server);
  if (globalClient) return globalClient;
  return scope.sessionMcp?.getSessionClient(sessionId, server);
}

/** Whether `(server, rawToolName)` is one of the tools `sessionId`'s resolved tool registry actually knows about. */
export async function isKnownMcpTool(
  scope: McpScope,
  sessionId: string,
  server: string,
  rawToolName: string,
): Promise<boolean> {
  const namespaced = namespacedToolName(server, rawToolName);
  if (scope.mcp && namespaced in scope.mcp.tools) return true;
  if (!scope.sessionMcp) return false;
  const sessionTools = await scope.sessionMcp.getSessionTools(sessionId);
  return namespaced in sessionTools;
}

/**
 * Merges `mcp`'s always-on tools with `sessionId`'s own `sessionMcp` tools
 * into one registry. Each tool already carries its own MCP Apps widget
 * metadata (if any) as `tool.mcpApp` — see `McpTool` — so callers that need
 * to know which tools have a widget (e.g. the `/api/tools` introspection
 * route) can read it straight off the resolved tools, with no separate
 * lookup required.
 */
export async function resolveMcpTools(
  scope: McpScope,
  sessionId: string,
): Promise<Record<string, McpTool>> {
  return {
    ...(scope.mcp?.tools ?? {}),
    ...(scope.sessionMcp ? await scope.sessionMcp.getSessionTools(sessionId) : {}),
  };
}
