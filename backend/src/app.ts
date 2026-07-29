import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium";
import type { McpToolsHandle } from "@cesium-ai/mcp-tools";
import type { LanguageModel, ToolSet } from "ai";
import cors from "cors";
import express, { type Express } from "express";
import type { Env } from "./utils/env.js";
import { createExecuteCesiumCodeTool } from "./tools/execute-cesium-code-tool.js";
import { flyToInputSchema } from "./tools/flyto-tool.js";
import { rateLimiter } from "./utils/rate-limit.js";

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
}

/**
 * Composes the backend Express application: CORS, JSON body parsing, the
 * `/health` probe, the per-IP rate limiter, and the chat router with this app's
 * curated CesiumJS tool surface.
 *
 * Split out from {@link file://./index.ts} (which resolves env + model and calls
 * `listen`) so the fully-wired app — real middleware in real order, real tool
 * registry — can be started on an ephemeral port and driven over HTTP in tests.
 */
export function createBackendApp({ env, model, mcp }: BackendAppOptions): Express {
  const app = express();

  app.use(cors({ origin: env.ALLOWED_ORIGIN }));
  app.use(express.json({ limit: "256kb" }));

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
  const tools: ToolSet = {
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

  app.use(
    createChatRouter({
      model,
      tools,
      toolApproval: {
        // Gate executeCesiumCode behind a human approval decision — the current,
        // non-deprecated replacement for setting `needsApproval` directly on the
        // tool object (see `./tools/execute-cesium-code-tool.ts`).
        [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval",
        // Every MCP tool is approval-gated by default too, for the same reason:
        // it's third-party code this app doesn't control. Unlike
        // executeCesiumCode, an MCP tool's `execute()` result is already the
        // real, final outcome (no later client-side execution phase), so this
        // doesn't need the extra `stopAfterTools`/response-suppression
        // machinery executeCesiumCode required (see @cesium-ai/server's README).
        ...Object.fromEntries(Object.keys(mcp?.tools ?? {}).map((name) => [name, "user-approval"])),
      },
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
