import { createConsoleMcpToolsLogger, createMcpTools } from "@cesium-ai/mcp-tools";
import { createBackendApp } from "./app.js";
import { env } from "./utils/env.js";
import { createModel, createProviderConfig, isProviderConfigured } from "./utils/providers.js";

const provider = createProviderConfig(env);
const model = isProviderConfigured(provider) ? await createModel(provider) : undefined;

// Connecting to MCP servers is async (discovers each server's tools over its
// transport), so it happens here, before the synchronous createBackendApp
// call — not lazily inside it. Skipped entirely (mcp stays undefined) when
// MCP_SERVERS is unset, a zero-behavior-change default.
const mcp =
  env.MCP_SERVERS.length > 0
    ? await createMcpTools({
        servers: env.MCP_SERVERS,
        timeoutMs: env.MCP_TOOL_TIMEOUT_MS,
        logger: createConsoleMcpToolsLogger("info"),
      })
    : undefined;

if (mcp) {
  for (const server of mcp.servers) {
    console.log(
      server.connected
        ? `  mcp: "${server.name}" connected (${server.toolNames.length} tool(s))`
        : `  mcp: "${server.name}" failed to connect: ${server.error}`,
    );
  }
}

const app = createBackendApp({ env, model, mcp });

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
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
