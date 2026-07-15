import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium";
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
export function createBackendApp({ env, model }: BackendAppOptions): Express {
  const app = express();

  app.use(cors({ origin: env.ALLOWED_ORIGIN }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      provider: env.AI_PROVIDER,
      providerConfigured: model !== undefined,
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
  };

  app.use(
    createChatRouter({
      model,
      tools,
      // Gate executeCesiumCode behind a human approval decision — the current,
      // non-deprecated replacement for setting `needsApproval` directly on the
      // tool object (see `./tools/execute-cesium-code-tool.ts`).
      toolApproval: { [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval" },
    }),
  );

  return app;
}
