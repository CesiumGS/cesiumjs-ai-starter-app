import type { McpTool } from "@cesium-ai/mcp-tools";
import { Router, type Request } from "express";

export interface ToolsRouterOptions {
  /**
   * Resolves this request's full tool registry (static tools + this
   * session's connected MCP tools). An MCP tool that declared a `ui://` MCP
   * Apps widget resource carries that metadata as its own `mcpApp` property
   * (see `@cesium-ai/mcp-tools`' `McpTool`).
   */
  buildTools: (req: Request) => Promise<Record<string, McpTool>>;
}

/**
 * Builds the `GET /api/tools` introspection route — lets the client see the
 * exact tool surface a request would run against, including MCP tools not
 * known statically at build time, and which of them declared an MCP Apps
 * `ui://` widget resource (so the frontend can render that widget inline
 * instead of the plain JSON result).
 *
 * Read-only, but the host app is expected to rate-limit this route itself
 * (same as `/api/chat`/`/api/mcp-app`) — this router doesn't apply one of
 * its own, since a third-party MCP server's tool count/descriptions could
 * otherwise be scraped freely.
 */
export function createToolsRouter({ buildTools }: ToolsRouterOptions): Router {
  const router = Router();

  router.get("/api/tools", async (req, res) => {
    const tools = await buildTools(req);
    res.json({
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        // Present only for MCP tools that declared an MCP Apps `ui://` widget
        // resource (see @cesium-ai/mcp-tools' `mcp-app-meta.ts`).
        ...(tool.mcpApp ? { mcpApp: { resourceUri: tool.mcpApp.resourceUri } } : {}),
      })),
    });
  });

  return router;
}
