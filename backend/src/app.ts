import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium";
import type { McpToolsHandle, SessionMcpManager } from "@cesium-ai/mcp-tools";
import type { LanguageModel, ToolApprovalConfiguration, ToolSet } from "ai";
import cors from "cors";
import express, { type Express, type Request } from "express";
import type { SessionOptions } from "express-session";
import type { Env } from "./utils/env.js";
import { createMcpAppRouter } from "./mcp-app-router.js";
import { createMcpSessionRouter } from "./mcp-session-router.js";
import { createExecuteCesiumCodeTool } from "./tools/execute-cesium-code-tool.js";
import { flyToInputSchema } from "./tools/flyto-tool.js";
import { rateLimiter } from "./utils/rate-limit.js";
import { createSessionMiddleware } from "./utils/session.js";

export interface BackendAppOptions {
  /**
   * Resolved environment configuration (allowed origins, rate limit, feature
   * flags, selected provider). Kept as an injected argument — rather than read
   * from `./env.js` here — so tests can build the app with a synthetic config
   * without tripping env.ts's load-time `process.env` validation.
   */
  env: Env;
  /**
   * The resolved language model the agent loop talks to, or `undefined` when no
   * provider is configured. When omitted, `/api/chat` returns the structured
   * `NOT_CONFIGURED` payload (see `@cesium-ai/server`).
   */
  model?: LanguageModel;
  /**
   * Resolved MCP (Model Context Protocol) tool bridge — connect servers with
   * `createMcpTools()` from `@cesium-ai/mcp-tools` before calling this
   * function (connecting is async; this constructor stays synchronous so it
   * can still be driven directly over HTTP in tests). Omit to run with no
   * MCP servers configured — a no-op, zero-behavior-change default.
   */
  mcp?: McpToolsHandle;
  /**
   * Manages user-initiated, per-browser-session MCP OAuth connections (e.g. a
   * "Connect to Cesium ion" UI button) — distinct from `mcp`'s
   * operator-configured, always-on servers. When provided, mounts
   * `/api/mcp/*` routes and requires session middleware, and every chat
   * request's tool set is augmented with that session's connected tools.
   * Omit to run with no session-connectable MCP servers — a no-op default.
   */
  sessionMcp?: SessionMcpManager;
  /**
   * `express-session` store for session middleware. Only meaningful alongside
   * `sessionMcp`. Defaults to the in-memory `MemoryStore` — pass a real store
   * (e.g. `connect-redis`) so sessions survive a restart / are shared across
   * replicas in production. See `./utils/session.js` for why this alone
   * doesn't make session-scoped MCP connections multi-instance-safe.
   */
  sessionStore?: SessionOptions["store"];
}

/**
 * Composes the backend Express application: CORS, JSON body parsing, the
 * `/health` probe, `/api/tools` (introspection of the resolved tool registry),
 * the per-IP rate limiter, and the chat router with this app's curated
 * CesiumJS tool surface.
 *
 * Split out from {@link file://./index.ts} (which resolves env + model and calls
 * `listen`) so the fully-wired app — real middleware in real order, real tool
 * registry — can be started on an ephemeral port and driven over HTTP in tests.
 */
export function createBackendApp({
  env,
  model,
  mcp,
  sessionMcp,
  sessionStore,
}: BackendAppOptions): Express {
  const app = express();

  app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "256kb" }));

  if (sessionMcp) {
    if (!env.SESSION_SECRET) {
      throw new Error(
        "SESSION_SECRET must be set when session-scoped MCP connections are enabled.",
      );
    }
    app.use(createSessionMiddleware({ secret: env.SESSION_SECRET, store: sessionStore }));
    app.use(rateLimiter({ rpm: env.RATE_LIMIT_RPM }));
    app.use(createMcpSessionRouter(sessionMcp));
  }

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      provider: env.AI_PROVIDER,
      providerConfigured: model !== undefined,
      ...(mcp ? { mcpServers: mcp.servers } : {}),
    });
  });

  app.use("/api/chat", rateLimiter({ rpm: env.RATE_LIMIT_RPM }));
  // Curate tools via ENABLED_CESIUM_TOOLS allowlist; add custom flyTo schema.
  // Only include executeCesiumCode when a model is configured.
  const staticTools: ToolSet = {
    ...createCesiumTools({
      enabled: ENABLED_CESIUM_TOOLS,
      flyTo: { inputSchema: flyToInputSchema },
    }),
    ...(model && ENABLED_CESIUM_TOOLS.includes(CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode)
      ? {
          [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: createExecuteCesiumCodeTool({
            model,
            maxSkills: env.CODEGEN_MAX_SKILLS,
            maxAttempts: env.CODEGEN_MAX_ATTEMPTS,
            maxLength: env.CODEGEN_MAX_CODE_LENGTH,
            maxLines: env.CODEGEN_MAX_CODE_LINES,
            allowedSymbols: env.CODEGEN_ALLOWED_SYMBOLS,
            extraInstructions: env.CODEGEN_EXTRA_INSTRUCTIONS,
          }),
        }
      : {}),
    // MCP tools run arbitrary server-side code owned by a third party (the MCP
    // server), never the browser — see @cesium-ai/mcp-tools. Unlike flyTo/
    // executeCesiumCode, these are never streamed as client tool calls.
    ...(mcp?.tools ?? {}),
  };

  // Resolved per-request rather than once: a request's own session may have
  // user-initiated MCP connections (see `sessionMcp`) not known statically
  // at server-construction time. `createChatRouter`'s `tools` option accepts
  // a `(req) => ToolSet | Promise<ToolSet>` for exactly this reason.
  const buildTools = async (req: Request): Promise<ToolSet> => ({
    ...staticTools,
    ...(sessionMcp ? await sessionMcp.getSessionTools(req.sessionID) : {}),
  });

  app.use("/api/tools", rateLimiter({ rpm: env.RATE_LIMIT_RPM }));
  // Lets the client introspect the exact tool surface this request would run
  // against, including MCP tools not known statically at build time.
  // Read-only; rate-limited the same as /api/chat since a third-party MCP
  // server's tool count/descriptions could otherwise be scraped freely.
  app.get("/api/tools", async (req, res) => {
    const tools = await buildTools(req);
    const appTools = {
      ...(mcp?.appTools ?? {}),
      ...(sessionMcp ? await sessionMcp.getSessionAppTools(req.sessionID) : {}),
    };
    res.json({
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        // Present only for MCP tools that declared an MCP Apps `ui://` widget
        // resource (see @cesium-ai/mcp-tools' `mcp-app-meta.ts`) — lets the
        // frontend render that widget inline instead of the plain JSON result.
        ...(appTools[name] ? { mcpApp: { resourceUri: appTools[name].resourceUri } } : {}),
      })),
    });
  });

  // Bridge for a rendered MCP App widget's own host<->iframe postMessage
  // protocol: fetching its `ui://` HTML resource and (after the frontend's
  // own inline user-approval step) calling tools back on its own MCP server.
  // Mounted whenever either kind of MCP connection exists — a no-op 404 for
  // every route otherwise.
  if (mcp || sessionMcp) {
    app.use("/api/mcp-app", rateLimiter({ rpm: env.RATE_LIMIT_RPM }));
    app.use(createMcpAppRouter({ mcp, sessionMcp, timeoutMs: env.MCP_TOOL_TIMEOUT_MS }));
  }

  app.use(
    createChatRouter({
      model,
      tools: buildTools,
      resolveToolApproval: (resolvedTools): ToolApprovalConfiguration<ToolSet, never> => ({
        // Gate executeCesiumCode behind a human approval decision — the current,
        // non-deprecated replacement for setting `needsApproval` directly on the
        // tool object (see `./tools/execute-cesium-code-tool.ts`).
        [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval",
        // Every MCP tool is approval-gated too, for the same reason: it's
        // third-party code this app doesn't control. Unlike executeCesiumCode,
        // an MCP tool's `execute()` result is already the real, final outcome,
        // so this doesn't need the extra `stopAfterTools`/response-suppression
        // machinery executeCesiumCode required (see @cesium-ai/server's README).
        //
        // Matched by the `mcp__<server>__<tool>` naming convention rather than
        // a fixed list, since `resolvedTools` also includes this request's own
        // session's user-initiated MCP connections, not known statically at
        // server-construction time.
        ...Object.fromEntries(
          Object.keys(resolvedTools)
            .filter((name) => name.startsWith("mcp__"))
            .map((name) => [name, "user-approval"]),
        ),
      }),
      // executeCesiumCode's server-side result only means the generated code
      // passed static verification — not that it has actually run
      // successfully in the browser sandbox yet (that happens client-side,
      // after this response, and is reported back via a follow-up request —
      // see `handleServerToolResult`/`continueConversation` in the frontend).
      // Stop the agent loop right after that tool call so the model can't
      // generate a premature "done!" reply before the real outcome is known.
      stopAfterTools: [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode],
    }),
  );

  return app;
}
