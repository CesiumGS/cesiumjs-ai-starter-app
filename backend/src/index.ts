import { createMcpTools, createSessionMcpManager } from "@cesium-ai/mcp-tools";
import { createBackendApp } from "./app.js";
import { env } from "./utils/env.js";
import { createModel, createProviderConfig, isProviderConfigured } from "./utils/providers.js";
import { initializeBackendTelemetry } from "./utils/telemetry.js";

const telemetry = initializeBackendTelemetry(env);
const appLogger = telemetry.createLogger("backend");
const mcpLogger = telemetry.createMcpToolsLogger("@cesium-ai/mcp-tools");

const provider = createProviderConfig(env);
const model = isProviderConfigured(provider) ? await createModel(provider) : undefined;

// Connecting to MCP servers is async (discovers each server's tools over its
// transport), so it happens here, before the synchronous createBackendApp
// call. Every entry in `env.mcpServers` is attempted the same way — there's
// no static "this one needs OAuth" config flag. Skipped entirely when no
// servers are configured, a zero-behavior-change default.
const mcp =
  env.mcpServers.length > 0
    ? await createMcpTools({
        servers: env.mcpServers,
        timeoutMs: env.MCP_TOOL_TIMEOUT_MS,
        logger: mcpLogger,
      })
    : undefined;

if (mcp) {
  for (const server of mcp.servers) {
    if (server.connected) {
      appLogger.info(`MCP server connected: ${server.name}`, {
        toolCount: server.toolNames.length,
      });
      continue;
    }

    if (server.authRequired) {
      appLogger.warn(`MCP server requires per-user authentication: ${server.name}`);
      continue;
    }

    appLogger.error(`MCP server failed to connect: ${server.name}`, { error: server.error });
  }
}

// Servers `mcp` detected as needing per-user auth (a 401 during the plain
// startup connection attempt above, with no static credentials configured)
// are NOT connected here — each is only ever connected on demand, per
// browser session, once a user actually initiates it via the interactive
// "Connect" UI (see `@cesium-ai/server/mcp`'s `mcp-session-router.ts`). Skipped
// entirely (sessionMcp stays undefined) when nothing needed auth, a
// zero-behavior-change default.
//
// No `pendingRepository`/`connectedRepository` is passed, so state stays in
// this process's memory (single-instance deployment model, matching
// `utils/session.ts`'s `MemoryStore` default). To scale to multiple backend
// instances, use sticky sessions so each browser consistently reaches the
// process holding its live OAuth provider and MCP client connection. See
// `@cesium-ai/mcp-tools`'s README "Multi-instance deployment" section for
// how the manager's pluggable descriptor-repository options can be swapped
// for an external store (e.g. Redis) if you need cross-instance status
// visibility on top of that.
const sessionMcp =
  mcp && mcp.authRequiredServers.length > 0
    ? createSessionMcpManager({
        servers: mcp.authRequiredServers,
        buildRedirectUrl: () => new URL("/api/mcp/callback", env.PUBLIC_URL).href,
        timeoutMs: env.MCP_TOOL_TIMEOUT_MS,
        logger: mcpLogger,
      })
    : undefined;

if (sessionMcp) {
  appLogger.info("Session MCP servers enabled", { servers: sessionMcp.serverNames.join(",") });
}

// No `sessionStore` is passed here, so `createSessionMiddleware` falls back
// to express-session's in-memory `MemoryStore` (session.ts logs a startup
// warning). A production deployment needing sessions to survive a restart
// or be shared across replicas should construct a real store here (e.g.
// `connect-redis`) and pass it through as `sessionStore` below.
const app = createBackendApp({
  env,
  model,
  mcp,
  sessionMcp,
  createLogger: telemetry.createLogger,
  createServerMetrics: telemetry.createServerMetrics,
  createCodegenMetrics: telemetry.createCodegenMetrics,
});

const url = new URL(env.PUBLIC_URL);
const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;

const server = app.listen(port, () => {
  appLogger.info(`Backend listening on ${env.PUBLIC_URL}`);
  appLogger.info("Backend runtime configuration", {
    chatEnabled: Boolean(model),
    provider: env.AI_PROVIDER,
    rateLimitRpm: env.RATE_LIMIT_RPM,
    telemetryEnabled: telemetry.enabled,
  });
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  appLogger.info(`Received ${signal}; shutting down backend`);

  server.close();
  await mcp?.close();
  await sessionMcp?.closeAll();
  await telemetry.shutdown();

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
