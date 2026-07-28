import { type MCPClient } from "@ai-sdk/mcp";
import {
  namespacedToolName,
  type McpToolsHandle,
  type SessionMcpManager,
} from "@cesium-ai/mcp-tools";
import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

export interface McpAppRouterOptions {
  /** Operator-configured, always-on MCP servers — see `createMcpTools`. */
  mcp?: McpToolsHandle;
  /** Per-browser-session, user-initiated MCP OAuth connections — see `createSessionMcpManager`. */
  sessionMcp?: SessionMcpManager;
}

/**
 * Resolves the live `MCPClient` for `server`, checking the operator-configured
 * (`mcp`) servers first, then this request's own session-connected
 * (`sessionMcp`) servers. A server name is only ever meaningfully connected
 * through ONE of these two at a time in this app's architecture (a server
 * `createMcpTools` fails to connect to at startup with a 401 is excluded
 * from `mcp.tools`/`mcp.getClient` entirely and only ever reachable via
 * `sessionMcp` once a user connects it) — so no `scope` parameter is needed
 * from the caller.
 */
async function resolveClient(
  server: string,
  req: Request,
  { mcp, sessionMcp }: McpAppRouterOptions,
): Promise<MCPClient | undefined> {
  const globalClient = mcp?.getClient(server);
  if (globalClient) return globalClient;
  return sessionMcp?.getSessionClient(req.sessionID, server);
}

/** Whether `(server, rawToolName)` is one of the tools this request's resolved tool registry actually knows about — prevents the widget bridge from calling an unlisted/cross-server tool name. */
async function isKnownServerTool(
  server: string,
  rawToolName: string,
  req: Request,
  { mcp, sessionMcp }: McpAppRouterOptions,
): Promise<boolean> {
  const namespaced = namespacedToolName(server, rawToolName);
  if (mcp && namespaced in mcp.tools) return true;
  if (!sessionMcp) return false;
  const sessionTools = await sessionMcp.getSessionTools(req.sessionID);
  return namespaced in sessionTools;
}

/**
 * Best-effort, in-memory trust-on-first-use fingerprint cache for MCP App
 * resources: logs (never blocks) if a `(server, uri)` resource's content
 * changes between reads within this process's lifetime — a legitimate
 * content update looks identical to a compromised/rug-pulled server silently
 * swapping a widget's code, so this is purely an observability signal for an
 * operator watching logs, not an enforcement mechanism. Hashes the RAW
 * `ReadResourceResult` directly (rather than re-fetching/re-shaping via
 * `@ai-sdk/mcp`'s `readMCPAppResource`) so this never costs a second round
 * trip to the MCP server.
 */
function createResourceDriftTracker() {
  const baselines = new Map<string, string>();
  return function checkDrift(key: string, result: unknown): void {
    const fingerprint = createHash("sha256").update(JSON.stringify(result)).digest("base64url");
    const baseline = baselines.get(key);
    if (baseline === undefined) {
      baselines.set(key, fingerprint);
      return;
    }
    if (fingerprint !== baseline) {
      console.warn(
        `[mcp-app-router] MCP App resource "${key}" changed since it was first loaded — ` +
          `possible content update or a rug-pull from the MCP server. Re-review before trusting it.`,
      );
      baselines.set(key, fingerprint);
    }
  };
}

/**
 * Builds `/api/mcp-app/*` routes that let the browser-rendered MCP Apps
 * widget (`@mcp-ui/client`'s `AppRenderer`, used without an in-browser MCP
 * client — see `packages/chat-element/src/McpAppWidget.tsx`) fetch a tool's
 * `ui://` resource and, once the user approves, call tools back on the SAME
 * MCP server that served it. Returns raw MCP `ReadResourceResult`/
 * `CallToolResult` shapes — exactly what `AppRenderer`'s `onReadResource`/
 * `onCallTool` callbacks expect. Works for both operator-configured (`mcp`)
 * and per-session (`sessionMcp`) connections; omit both to mount a router
 * with a "no such server" 404 for everything (a no-op-safe default rather
 * than a hard crash if this is ever mounted without either configured).
 *
 * Security posture (see `docs/Codegen-tool-security-attacks-vectors.md` for
 * this repo's general threat-modeling conventions):
 * - `resources/read` is restricted to `ui://` URIs only.
 * - `tools/call` is restricted to `(server, toolName)` pairs already in this
 *   request's OWN resolved tool registry — a widget can never reach a tool on
 *   a DIFFERENT server, or one filtered out by that server's `allowedTools`.
 *   The actual user-consent gate for a widget-initiated tool call lives in
 *   the FRONTEND (an inline Approve/Reject prompt before this endpoint is
 *   ever called) — this router's checks are defense-in-depth, not a
 *   replacement for that UI.
 * - Every route is rate-limited by the caller (see `app.ts`), same as
 *   `/api/chat`/`/api/tools`.
 */
export function createMcpAppRouter(options: McpAppRouterOptions): Router {
  const router = Router();
  const checkDrift = createResourceDriftTracker();

  router.get("/api/mcp-app/resource", async (req: Request, res: Response) => {
    const server = typeof req.query.server === "string" ? req.query.server : undefined;
    const uri = typeof req.query.uri === "string" ? req.query.uri : undefined;
    if (!server || !uri) {
      res.status(400).json({ error: "Both `server` and `uri` query parameters are required." });
      return;
    }
    if (!uri.startsWith("ui://")) {
      res.status(400).json({ error: 'Only "ui://" resource URIs may be read.' });
      return;
    }

    const client = await resolveClient(server, req, options);
    if (!client) {
      res.status(404).json({ error: `Unknown or unconnected MCP server "${server}".` });
      return;
    }

    try {
      const result = await client.readResource({ uri });
      checkDrift(`${server}:${uri}`, result);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/api/mcp-app/tool-call", async (req: Request, res: Response) => {
    const {
      server,
      toolName,
      arguments: toolArguments,
    } = req.body as {
      server?: unknown;
      toolName?: unknown;
      arguments?: unknown;
    };
    if (typeof server !== "string" || typeof toolName !== "string") {
      res.status(400).json({ error: "`server` and `toolName` must be strings." });
      return;
    }
    if (
      toolArguments !== undefined &&
      (typeof toolArguments !== "object" || toolArguments === null)
    ) {
      res.status(400).json({ error: "`arguments`, if present, must be a JSON object." });
      return;
    }

    if (!(await isKnownServerTool(server, toolName, req, options))) {
      res.status(404).json({
        error: `"${toolName}" is not a known tool on MCP server "${server}" for this request.`,
      });
      return;
    }

    const client = await resolveClient(server, req, options);
    if (!client) {
      res.status(404).json({ error: `Unknown or unconnected MCP server "${server}".` });
      return;
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: (toolArguments as Record<string, unknown> | undefined) ?? {},
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
