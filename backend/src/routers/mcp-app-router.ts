import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  isKnownMcpTool,
  resolveMcpClient,
  type McpScope,
} from "@cesium-ai/mcp-tools";
import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";

export interface McpAppRouterOptions extends McpScope {
  /** Maximum duration for each proxied MCP resource read or tool call. */
  timeoutMs?: number;
  /** Maximum resource fingerprints retained for drift detection. */
  maxTrackedResources?: number;
}

const DEFAULT_MAX_TRACKED_RESOURCES = 256;

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
function createResourceDriftTracker(maxEntries: number) {
  const baselines = new Map<string, string>();
  return function checkDrift(key: string, result: unknown): void {
    const fingerprint = createHash("sha256").update(JSON.stringify(result)).digest("base64url");
    const baseline = baselines.get(key);
    if (baseline === undefined) {
      if (baselines.size >= maxEntries) {
        const oldestKey = baselines.keys().next().value as string | undefined;
        if (oldestKey !== undefined) baselines.delete(oldestKey);
      }
      baselines.set(key, fingerprint);
      return;
    }
    baselines.delete(key);
    baselines.set(key, fingerprint);
    if (fingerprint !== baseline) {
      console.warn(
        `[mcp-app-router] MCP App resource "${key}" changed since it was first loaded — ` +
          `possible content update or a rug-pull from the MCP server. Re-review before trusting it.`,
      );
    }
  };
}

async function handleResourceRequest(
  req: Request,
  res: Response,
  options: McpAppRouterOptions,
  timeoutMs: number,
  checkDrift: (key: string, result: unknown) => void,
): Promise<void> {
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

  const client = await resolveMcpClient(options, req.sessionID, server);
  if (!client) {
    res.status(404).json({ error: `Unknown or unconnected MCP server "${server}".` });
    return;
  }

  try {
    const result = await client.readResource({
      uri,
      options: { timeout: timeoutMs, maxTotalTimeout: timeoutMs },
    });
    checkDrift(`${server}:${uri}`, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleToolCallRequest(
  req: Request,
  res: Response,
  options: McpAppRouterOptions,
  timeoutMs: number,
): Promise<void> {
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

  if (!(await isKnownMcpTool(options, req.sessionID, server, toolName))) {
    res.status(404).json({
      error: `"${toolName}" is not a known tool on MCP server "${server}" for this request.`,
    });
    return;
  }

  const client = await resolveMcpClient(options, req.sessionID, server);
  if (!client) {
    res.status(404).json({ error: `Unknown or unconnected MCP server "${server}".` });
    return;
  }

  try {
    const result = await client.callTool({
      name: toolName,
      arguments: (toolArguments as Record<string, unknown> | undefined) ?? {},
      options: { timeout: timeoutMs, maxTotalTimeout: timeoutMs },
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS;
  const maxTrackedResources = Math.max(
    1,
    options.maxTrackedResources ?? DEFAULT_MAX_TRACKED_RESOURCES,
  );
  const checkDrift = createResourceDriftTracker(maxTrackedResources);

  router.get("/api/mcp-app/resource", (req, res) =>
    handleResourceRequest(req, res, options, timeoutMs, checkDrift),
  );
  router.post("/api/mcp-app/tool-call", (req, res) =>
    handleToolCallRequest(req, res, options, timeoutMs),
  );

  return router;
}
