import { ENABLED_CESIUM_TOOLS } from "@cesium-ai/sample-config";
import { createChatRouter } from "@cesium-ai/server";
import { createCesiumTools } from "@cesium-ai/tools-cesium";
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
      chatEnabled: env.CHAT_ENABLED,
      provider: env.AI_PROVIDER,
      providerConfigured: model !== undefined,
    });
  });

  app.use("/api/chat", rateLimiter({ rpm: env.RATE_LIMIT_RPM }));
  // The app curates its tool surface via the shared ENABLED_CESIUM_TOOLS
  // allowlist — the same list the frontend keys its executors off — so the model
  // is only ever offered the tools this app turned on. `flyTo`'s input schema is
  // this app's extended `flyToInputSchema` (adds `duration`/`easingFunction` on
  // top of the stock tool), built from the same shared shape the frontend
  // validates against — see `./flyto-tool.ts`.
  //
  // `executeCesiumCode` isn't a viewer tool, so `createCesiumTools`
  // (`@cesium-ai/tools-cesium`, scoped to tools that run directly against a
  // live `Viewer`) never builds it — unlike `flyTo`, it needs a real
  // server-side `execute` (intent -> verified code) backed by
  // `@cesium-ai/codegen-cesium`'s generation pipeline. This app builds its own
  // executable version — see `./tools/execute-cesium-code-tool.ts` — and
  // merges it in only when a model is actually configured (no model, no
  // codegen calls to make) and the app has it enabled.
  const tools: ToolSet = {
    ...createCesiumTools({
      enabled: ENABLED_CESIUM_TOOLS,
      flyTo: { inputSchema: flyToInputSchema },
    }),
    ...(model && ENABLED_CESIUM_TOOLS.includes(CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode)
      ? {
          // The frontend doesn't yet execute the generated code anywhere — see
          // `frontend/README.md` — so static verification is unrestricted for now
          // (aside from the verifier's unconditional bans on `eval`/`Function`/dynamic
          // `import`/banned globals), matching real CesiumJS primitives
          // (`viewer.camera.flyTo`, `viewer.entities.add`, `Cesium.Cartesian3.fromDegrees`, ...).
          [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: createExecuteCesiumCodeTool({
            model,
            maxSkills: env.CODEGEN_MAX_SKILLS,
            maxAttempts: env.CODEGEN_MAX_ATTEMPTS,
          }),
        }
      : {}),
  };

  app.use(createChatRouter({ model, tools }));

  return app;
}
