import type { MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { connectMcpServer } from "./connect-mcp-server.js";
import { noopMcpToolsLogger, type McpToolsLogger } from "./logger.js";
import { withTimeout } from "./tool-timeout.js";
import type { McpServerConfig } from "./types.js";

/** Default per-tool-call timeout, applied to every MCP tool unless overridden. */
export const DEFAULT_MCP_TOOL_TIMEOUT_MS = 30_000;

export interface CreateMcpToolsOptions {
  /** MCP servers to connect to. Server-only, trusted config — never derived from a chat request. */
  servers: readonly McpServerConfig[];
  /**
   * Per-tool-call timeout in milliseconds. A hung/malicious MCP server can't
   * stall the agent loop past this. Defaults to {@link DEFAULT_MCP_TOOL_TIMEOUT_MS}.
   */
  timeoutMs?: number;
  /** Structured logger. Defaults to a no-op logger (see `createConsoleMcpToolsLogger` to enable). */
  logger?: McpToolsLogger;
}

/** Per-server outcome of a `createMcpTools` call — which servers connected and which didn't. */
export interface McpServerStatus {
  name: string;
  connected: boolean;
  /** Names of tools this server contributed (post-allowlist, pre-namespacing). Empty if not connected. */
  toolNames: readonly string[];
  /** Present only when `connected` is `false`. */
  error?: string;
}

export interface McpToolsHandle {
  /** Merged, namespaced tool registry — spread this alongside `createCesiumTools()`. */
  tools: ToolSet;
  /** Connection outcome per configured server, for startup logs / `/health` reporting. */
  servers: readonly McpServerStatus[];
  /** Closes every underlying MCP client connection. Call once on process shutdown. */
  close: () => Promise<void>;
}

/** Connects one server and builds its timeout-wrapped, namespaced tool set — the unit of work `createMcpTools` fans out over. */
async function registerServer(
  server: McpServerConfig,
  logger: McpToolsLogger,
  timeoutMs: number,
): Promise<{ status: McpServerStatus; client?: MCPClient; tools: ToolSet }> {
  const result = await connectMcpServer(server, logger);
  if ("error" in result) {
    return {
      status: { name: server.name, connected: false, toolNames: [], error: result.error },
      tools: {},
    };
  }

  const tools: ToolSet = {};
  for (const [namespaced, toolDef] of result.toolEntries) {
    tools[namespaced] = withTimeout(toolDef, timeoutMs, namespaced, logger);
  }

  return {
    status: {
      name: server.name,
      connected: true,
      toolNames: result.toolEntries.map(([namespaced]) => namespaced),
    },
    client: result.client,
    tools,
  };
}

/**
 * Connects to every configured MCP server, discovers + allowlist-filters +
 * namespaces their tools, and merges them into one AI SDK `ToolSet`.
 *
 * Connection failures are isolated per server — one unreachable/misbehaving
 * server never prevents the others (or the rest of the app) from starting;
 * check {@link McpToolsHandle.servers} to see which servers actually
 * connected. Call {@link McpToolsHandle.close} once on process shutdown.
 *
 *   const mcp = await createMcpTools({ servers: [...] });
 *   const tools = { ...createCesiumTools(), ...mcp.tools };
 *   // ...
 *   process.on("SIGTERM", () => mcp.close());
 */
export async function createMcpTools(options: CreateMcpToolsOptions): Promise<McpToolsHandle> {
  const { servers, timeoutMs = DEFAULT_MCP_TOOL_TIMEOUT_MS, logger = noopMcpToolsLogger } = options;

  const clients: MCPClient[] = [];
  const statuses: McpServerStatus[] = [];
  const tools: ToolSet = {};

  for (const server of servers) {
    const registered = await registerServer(server, logger, timeoutMs);
    statuses.push(registered.status);
    if (registered.client) clients.push(registered.client);
    Object.assign(tools, registered.tools);
  }

  return {
    tools,
    servers: statuses,
    close: async () => {
      const results = await Promise.allSettled(clients.map((client) => client.close()));
      for (const result of results) {
        if (result.status === "rejected") {
          logger.error(`Error while closing an MCP client connection`, {
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
    },
  };
}
