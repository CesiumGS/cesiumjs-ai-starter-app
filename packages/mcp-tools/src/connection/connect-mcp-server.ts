import {
  createMCPClient,
  mcpAppClientCapabilities,
  type MCPClient,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import type { McpToolsLogger } from "../logger.js";
import { isUnauthorizedMcpError } from "./mcp-error.js";
import { getMcpAppToolMeta, type McpTool } from "../mcp-app-meta.js";
import type { McpServerConfig, McpTransportConfig } from "../types.js";

/** `mcp__<server>__<tool>` — the namespace every discovered tool is exposed under, everywhere in this app. */
export function namespacedToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

/** One discovered, allowlist-surviving tool from a connected MCP server. */
export interface SelectedMcpTool {
  /**
   * Raw tool name exactly as advertised by the MCP server (no namespace
   * prefix) — what `MCPClient.callTool`/`readResource` bridge calls must use.
   */
  rawName: string;
  /** `mcp__<server>__<tool>` name this tool is registered under everywhere else in this app. */
  namespacedName: string;
  /** Carries its MCP Apps widget metadata (if any) directly as `tool.mcpApp` — see `McpTool`. */
  tool: McpTool;
}

/**
 * Applies a server's `allowedTools` filter to its discovered tools and
 * namespaces the survivors as `mcp__<server>__<tool>`.
 *
 * Every discovered tool is logged BEFORE filtering (not just the ones that
 * survive) so a server silently changing a tool's description between runs
 * — a form of MCP "tool poisoning" / rug-pull — is visible even for a tool
 * that ends up filtered out by `allowedTools`.
 */
export function selectToolEntries(
  discovered: Awaited<ReturnType<MCPClient["tools"]>>,
  server: McpServerConfig,
  logger: McpToolsLogger,
): SelectedMcpTool[] {
  const allowed = server.allowedTools ? new Set(server.allowedTools) : undefined;

  const selected: SelectedMcpTool[] = [];
  for (const [toolName, toolDef] of Object.entries(discovered)) {
    logger.info(`Discovered MCP tool`, {
      server: server.name,
      tool: toolName,
      description: toolDef.description,
    });

    if (allowed && !allowed.has(toolName)) {
      logger.debug(`Skipping tool not in allowedTools`, { server: server.name, tool: toolName });
      continue;
    }
    const appMeta = getMcpAppToolMeta((toolDef as { _meta?: unknown })._meta);
    if (appMeta) {
      logger.info(`Discovered MCP App widget for tool`, {
        server: server.name,
        tool: toolName,
        resourceUri: appMeta.resourceUri,
      });
    }
    selected.push({
      rawName: toolName,
      namespacedName: namespacedToolName(server.name, toolName),
      tool: (appMeta ? { ...toolDef, mcpApp: appMeta } : toolDef) as McpTool,
    });
  }
  return selected;
}

export function buildTransport(transport: McpTransportConfig, authProvider?: OAuthClientProvider) {
  return {
    type: transport.type,
    url: transport.url,
    headers: transport.headers,
    authProvider,
  };
}

/**
 * Connects to one MCP server and discovers + allowlist-filters + namespaces
 * its tools. Never throws — a connection/discovery failure is reported back
 * as `{ error, authRequired? }` so callers can isolate it from other
 * servers.
 *
 * Always advertises `mcpAppClientCapabilities` (the "MCP Apps" extension,
 * `io.modelcontextprotocol/ui`) during initialization — this is purely a
 * capability announcement (lets a server that supports MCP Apps know it's
 * safe to include `_meta.ui`/serve `ui://` resources); it never obligates
 * this app to render anything, and a server that doesn't implement the
 * extension simply ignores it.
 *
 * Deliberately connects WITHOUT an `authProvider` — there's no static "needs
 * OAuth" config flag. A server requiring per-user auth returns a plain 401,
 * detected via `isUnauthorizedMcpError`; the caller (`createMcpTools`) uses
 * that to route it into `authRequiredServers` instead of a hard failure. The
 * actual interactive OAuth flow is handled separately by `session-oauth-connect.ts`.
 */
export async function connectMcpServer(
  server: McpServerConfig,
  logger: McpToolsLogger,
): Promise<
  { client: MCPClient; toolEntries: SelectedMcpTool[] } | { error: string; authRequired?: boolean }
> {
  try {
    const client = await createMCPClient({
      transport: buildTransport(server.transport),
      clientName: "cesium-ai-mcp-tools",
      capabilities: mcpAppClientCapabilities,
    });

    const toolEntries = selectToolEntries(await client.tools(), server, logger);
    return { client, toolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const authRequired = isUnauthorizedMcpError(err);
    logger.error(`Failed to connect to MCP server`, {
      server: server.name,
      error: message,
      authRequired,
    });
    return authRequired ? { error: message, authRequired: true } : { error: message };
  }
}
