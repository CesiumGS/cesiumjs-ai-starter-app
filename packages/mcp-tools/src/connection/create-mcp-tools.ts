import type { MCPClient } from "@ai-sdk/mcp";
import { connectMcpServer } from "./connect-mcp-server.js";
import { DEFAULT_MCP_TOOL_TIMEOUT_MS } from "../constants.js";
import { noopMcpToolsLogger, type McpToolsLogger } from "../logger.js";
import type { McpTool } from "../mcp-app-meta.js";
import { withTimeout } from "../tool-timeout.js";
import type { McpServerConfig } from "../types.js";

export { DEFAULT_MCP_TOOL_TIMEOUT_MS } from "../constants.js";

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
  /**
   * Present (and `true`) only when `connected` is `false` AND the failure
   * looks like "this server requires per-user authentication" (a 401 with no
   * static credentials configured) — see {@link McpToolsHandle.authRequiredServers}.
   */
  authRequired?: boolean;
}

export interface McpToolsHandle {
  /**
   * Merged, namespaced tool registry — spread this alongside
   * `createCesiumTools()`. A tool that declared a `ui://` MCP Apps widget
   * resource carries that metadata as its own `mcpApp` property (see
   * `McpTool`) rather than in a separate map.
   */
  tools: Record<string, McpTool>;
  /** Connection outcome per configured server, for startup logs / `/health` reporting. */
  servers: readonly McpServerStatus[];
  /**
   * Servers whose startup connection attempt failed specifically because they
   * need per-user authentication (a 401 response, no static credentials
   * configured) — auto-detected, no config flag required. Feed these into
   * `createSessionMcpManager` so they're offered via the interactive
   * "Connect" UI instead of just logged as a hard failure.
   */
  authRequiredServers: readonly McpServerConfig[];
  /**
   * The live `MCPClient` for one connected server, keyed by server name —
   * needed to serve MCP App resource-reads/tool-calls a rendered widget's
   * bridge requests. `undefined` if that server never connected.
   */
  getClient: (serverName: string) => MCPClient | undefined;
  /** Closes every underlying MCP client connection. Call once on process shutdown. */
  close: () => Promise<void>;
}

/** Connects one server and builds its timeout-wrapped, namespaced tool set — the unit of work `createMcpTools` fans out over. */
async function registerServer(
  server: McpServerConfig,
  logger: McpToolsLogger,
  timeoutMs: number,
): Promise<{
  status: McpServerStatus;
  client?: MCPClient;
  tools: Record<string, McpTool>;
}> {
  const result = await connectMcpServer(server, logger);
  if ("error" in result) {
    return {
      status: {
        name: server.name,
        connected: false,
        toolNames: [],
        error: result.error,
        ...(result.authRequired ? { authRequired: true } : {}),
      },
      tools: {},
    };
  }

  const tools: Record<string, McpTool> = {};
  for (const entry of result.toolEntries) {
    tools[entry.namespacedName] = withTimeout(entry.tool, timeoutMs, entry.namespacedName, logger);
  }

  return {
    status: {
      name: server.name,
      connected: true,
      toolNames: result.toolEntries.map((entry) => entry.namespacedName),
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
 * connected. A failure that looks like a 401 (no static credentials
 * configured) is ALSO collected into {@link McpToolsHandle.authRequiredServers}
 * — no manual "this server needs OAuth" flag needed, it's detected from the
 * real connection attempt. Call {@link McpToolsHandle.close} once on process
 * shutdown.
 *
 *   const mcp = await createMcpTools({ servers: [...] });
 *   const tools = { ...createCesiumTools(), ...mcp.tools };
 *   // offer mcp.authRequiredServers via createSessionMcpManager for interactive connect
 *   // ...
 *   process.on("SIGTERM", () => mcp.close());
 */
export async function createMcpTools(options: CreateMcpToolsOptions): Promise<McpToolsHandle> {
  const { servers, timeoutMs = DEFAULT_MCP_TOOL_TIMEOUT_MS, logger = noopMcpToolsLogger } = options;

  const clientsByServer = new Map<string, MCPClient>();
  const statuses: McpServerStatus[] = [];
  const authRequiredServers: McpServerConfig[] = [];
  const tools: Record<string, McpTool> = {};

  for (const server of servers) {
    const registered = await registerServer(server, logger, timeoutMs);
    statuses.push(registered.status);
    if (registered.client) clientsByServer.set(server.name, registered.client);
    if (registered.status.authRequired) authRequiredServers.push(server);
    Object.assign(tools, registered.tools);
  }

  return {
    tools,
    servers: statuses,
    authRequiredServers,
    getClient: (serverName) => clientsByServer.get(serverName),
    close: async () => {
      const results = await Promise.allSettled(
        [...clientsByServer.values()].map((client) => client.close()),
      );
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
