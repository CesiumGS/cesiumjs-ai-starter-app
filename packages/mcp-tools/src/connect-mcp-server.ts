import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { Tool } from "ai";
import type { McpToolsLogger } from "./logger.js";
import type { McpServerConfig, McpTransportConfig } from "./types.js";

function namespacedToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
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
function selectToolEntries(
  discovered: Awaited<ReturnType<MCPClient["tools"]>>,
  server: McpServerConfig,
  logger: McpToolsLogger,
): [string, Tool][] {
  const allowed = server.allowedTools ? new Set(server.allowedTools) : undefined;

  const toolEntries: [string, Tool][] = [];
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
    toolEntries.push([namespacedToolName(server.name, toolName), toolDef as Tool]);
  }
  return toolEntries;
}

function buildTransport(transport: McpTransportConfig) {
  return { type: transport.type, url: transport.url, headers: transport.headers };
}

/**
 * Connects to one MCP server and discovers + allowlist-filters + namespaces
 * its tools. Never throws — a connection/discovery failure is reported back
 * as `{ error }` so callers can isolate it from other servers.
 */
export async function connectMcpServer(
  server: McpServerConfig,
  logger: McpToolsLogger,
): Promise<{ client: MCPClient; toolEntries: [string, Tool][] } | { error: string }> {
  try {
    const client = await createMCPClient({
      transport: buildTransport(server.transport),
      clientName: "cesium-ai-mcp-tools",
    });
    const toolEntries = selectToolEntries(await client.tools(), server, logger);
    return { client, toolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to connect to MCP server`, { server: server.name, error: message });
    return { error: message };
  }
}
