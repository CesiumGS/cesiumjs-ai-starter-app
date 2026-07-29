import {
  createConsoleMcpToolsLogger,
  createMcpTools,
  createSessionMcpManager,
} from "@cesium-ai/mcp-tools";
import { createBackendApp } from "./app.js";
import { env } from "./utils/env.js";
import { createModel, createProviderConfig, isProviderConfigured } from "./utils/providers.js";

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
        logger: createConsoleMcpToolsLogger("info"),
      })
    : undefined;

if (mcp) {
  for (const server of mcp.servers) {
    console.log(
      server.connected
        ? `  mcp: "${server.name}" connected (${server.toolNames.length} tool(s))`
        : server.authRequired
          ? `  mcp: "${server.name}" requires per-user authentication — available via the chat panel's Connect button`
          : `  mcp: "${server.name}" failed to connect: ${server.error}`,
    );
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
        logger: createConsoleMcpToolsLogger("info"),
      })
    : undefined;

if (sessionMcp) {
  console.log(`  mcp (session): ${sessionMcp.serverNames.join(", ")}`);
}

// No `sessionStore` is passed here, so `createSessionMiddleware` falls back
// to express-session's in-memory `MemoryStore` (session.ts logs a startup
// warning). A production deployment needing sessions to survive a restart
// or be shared across replicas should construct a real store here (e.g.
// `connect-redis`) and pass it through as `sessionStore` below.
const app = createBackendApp({ env, model, mcp, sessionMcp });

const url = new URL(env.PUBLIC_URL);
const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;

const server = app.listen(port, () => {
  console.log(`Backend listening on ${env.PUBLIC_URL}`);
  console.log(
    `  chat: ${model ? "enabled" : "disabled"} | provider: ${env.AI_PROVIDER} | rate limit: ${env.RATE_LIMIT_RPM} rpm`,
  );
});

async function shutdown(): Promise<void> {
  server.close();
  await mcp?.close();
  await sessionMcp?.closeAll();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
