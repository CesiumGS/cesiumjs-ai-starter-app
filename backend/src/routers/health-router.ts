import type { McpToolsHandle } from "@cesium-ai/mcp-tools";
import { Router } from "express";
import type { Env } from "../utils/env.js";

export interface HealthRouterOptions {
  env: Env;
  /** Whether a language model is configured — reported as `providerConfigured`. */
  modelConfigured: boolean;
  /** Operator-configured, always-on MCP servers — see `createMcpTools`. Reported as `mcpServers` when present. */
  mcp?: McpToolsHandle;
}

/** Builds the `GET /health` liveness/readiness probe. */
export function createHealthRouter({ env, modelConfigured, mcp }: HealthRouterOptions): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      provider: env.AI_PROVIDER,
      providerConfigured: modelConfigured,
      ...(mcp ? { mcpServers: mcp.servers } : {}),
    });
  });

  return router;
}
