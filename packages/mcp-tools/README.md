# @cesium-ai/mcp-tools

Optional, server-only [Model Context Protocol](https://modelcontextprotocol.io) (MCP) client bridge for the AI SDK. Connects to one or more MCP servers over SSE or streamable HTTP (stdio — spawning a local executable — is deliberately unsupported, see the Security model table below), namespaces and allowlist-filters their tools, and merges them into a plain AI SDK `ToolSet` — the same shape [`@cesium-ai/tools-schemas`](../tools-schemas/README.md)'s `createCesiumTools()` returns, so a host app composes them the same way:

```ts
import { createMcpTools } from "@cesium-ai/mcp-tools";
import { createCesiumTools } from "@cesium-ai/tools-schemas";

const mcp = await createMcpTools({
  servers: [
    {
      name: "docs",
      transport: { type: "http", url: "https://example.com/mcp" },
      allowedTools: ["search"],
    },
  ],
});

const tools = { ...createCesiumTools(), ...mcp.tools };
// ... run the agent loop with `tools` ...

// on shutdown
await mcp.close();
```

This package has **no dependency on `@cesium-ai/server` or `@cesium-ai/tools-schemas`** and is entirely optional — an app that never configures an MCP server never imports it.

## Why this is a separate package

MCP tools are architecturally different from this repo's other tool groups:

- **They run entirely server-side.** Unlike `flyTo` (streamed to the browser, executed against the live `Viewer`), an MCP tool's `execute()` talks to the MCP server directly from Node and its result is the real, final outcome — never streamed as a client tool call. See the root [README's architecture section](../../README.md#architecture) and [`docs/architectures/architecture`](../../site/architectures/architecture/index.html) for the split-execution model this follows.
- **The tool registry is third-party, dynamic content.** `flyTo`'s schema is hand-authored and reviewed; an MCP server can add, remove, or reword its tools at any time. That's a materially different trust boundary, so it gets its own package rather than living in `@cesium-ai/tools-schemas` (which is scoped to this repo's own hand-authored viewer tools) or `@cesium-ai/server` (model-/tool-agnostic, and shouldn't gain an MCP SDK dependency just to support an optional feature).

## Security model

MCP tool calls run arbitrary code you don't control, so this package is deliberately conservative by default:

| Risk                                                                                                                                                                                                                                                                                               | Mitigation                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Config is attacker-influenceable** — a server URL controls what code runs.                                                                                                                                                                                                                       | `McpServerConfig[]` is a plain, host-supplied argument, exactly like the LLM API key — it must come from trusted operator config (e.g. an `MCP_SERVERS` env var, see the backend's `env.ts`), **never** from a chat request.                                                                                           |
| **A locally-spawned process is a larger attack surface than a URL.**                                                                                                                                                                                                                               | `stdio` transport (spawning an arbitrary local executable) is deliberately unsupported — `McpTransportConfig` only allows `sse`/`http`, and `McpServerConfigsSchema` rejects any other `type` at parse time. Only network transports this app merely calls are supported.                                              |
| **[Tool poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning) / silent "rug pull"** — an MCP server can change a tool's `name`/`description` (which the model reads to decide what to call) at any time, including after your app has been reviewed against the original wording. | Every discovered tool's name + description is logged via the `logger` option (`createConsoleMcpToolsLogger("info")` or higher) at connect time — review these logs whenever an MCP server updates. Prefer `allowedTools` (an explicit per-server allowlist) over accepting a server's full, unreviewed tool catalogue. |
| **Name collisions across servers.**                                                                                                                                                                                                                                                                | Every tool is namespaced `mcp__<serverName>__<toolName>` before merging, so two servers can never silently shadow each other's tools.                                                                                                                                                                                  |
| **A stalled or malicious server hangs the agent loop.**                                                                                                                                                                                                                                            | Every tool call is wrapped with a timeout (`timeoutMs`, default {@link DEFAULT_MCP_TOOL_TIMEOUT_MS} = 30s) that rejects the call — it can't block the request indefinitely.                                                                                                                                            |
| **One bad server takes the whole app down.**                                                                                                                                                                                                                                                       | Each server connects independently — a connection failure is recorded in `McpToolsHandle.servers` and logged, but never thrown; the other servers (and the rest of the app) start normally. Check `servers` at startup / in `/health`.                                                                                 |
| **Credentials/URLs leaking to the browser.**                                                                                                                                                                                                                                                       | `McpServerConfig` (which may carry auth headers) is consumed entirely server-side — never serialize it into any response sent to the client.                                                                                                                                                                           |
| **A model calling an MCP tool without a human in the loop.**                                                                                                                                                                                                                                       | This package doesn't gate approval itself (that's a `streamText`/`toolApproval` concern — see `@cesium-ai/server`), but the host app should default every MCP tool to `"user-approval"` (this repo's `backend/src/app.ts` does exactly that for every tool `createMcpTools` returns).                                  |

## API

### `createMcpTools(options)`

```ts
interface CreateMcpToolsOptions {
  servers: readonly McpServerConfig[];
  timeoutMs?: number; // default 30_000
  logger?: McpToolsLogger; // default: no-op
}

interface McpToolsHandle {
  tools: ToolSet; // merged, namespaced — spread into your registry
  servers: readonly McpServerStatus[]; // per-server connect outcome
  close(): Promise<void>; // closes every underlying MCP client
}
```

`createMcpTools` is `async` (connecting + discovering tools is inherently async), unlike `createCesiumTools()`. Resolve it once at process startup — not per-request — and pass the resulting `tools` into your registry and `close` into your shutdown handler.

### `McpServerConfig`

```ts
interface McpServerConfig {
  name: string; // unique; used for namespacing + logs
  transport: { type: "sse" | "http"; url: string; headers?: Record<string, string> };
  allowedTools?: readonly string[]; // omit = expose every tool the server advertises
}
```

### `parseMcpServerConfigs(value)`

Validates a `McpServerConfig[]` (e.g. `JSON.parse()`'d from an env var) — checks transport shape and rejects duplicate server names. Throws a `ZodError` on invalid input. `McpServerConfigSchema` / `McpServerConfigsSchema` are also exported directly for hosts that want to compose their own env-parsing pipeline (see `backend/src/utils/env.ts`'s `MCP_SERVERS` handling for a worked example).

### Logging

`noopMcpToolsLogger` (default) and `createConsoleMcpToolsLogger(level)` (`"debug" | "info" | "warn" | "error" | "silent"`, `[mcp-tools]`-prefixed) are exported. `"info"` or louder is recommended in any environment where you want to catch tool-poisoning-style changes — it logs every discovered tool's name and description at connect time.

## Limitations / follow-ups

This package only calls the MCP client's `tools()` method — the one capability this app's `streamText` agent loop can consume. A few other things `@ai-sdk/mcp`'s client exposes are deliberately **not** wired up:

- **Elicitation** (`client.onElicitationRequest(...)`) — a server can ask the client to gather more input from the user mid tool-call. No handler is registered, so a bridged tool that triggers elicitation will fail rather than surface a UI prompt. This app's MCP tool calls run headless, server-side, with no live "ask the user and wait" channel at that point — supporting this would mean threading a request through the SSE stream back to the browser and pausing the call for a response.
- **OAuth-authenticated servers** (`OAuthClientProvider`/`auth()`) — only static `headers` are supported for `sse`/`http` transports, not the full OAuth token-refresh flow.
- **Resources / Prompts** (`listResources`, `readResource`, `experimental_listPrompts`, `experimental_getPrompt`) — not fetched at all. A server whose real value is resources/prompts rather than tools will connect successfully but contribute zero tools (visible as `toolNames: []` in `McpToolsHandle.servers`).
- Per-tool-call timeout is enforced with a `Promise.race` wrapper around `execute()`; it can't cancel work already in flight on the MCP server itself, only stop waiting for its result.
- Requires Node.js ≥ 22 (`@ai-sdk/mcp`'s own engine requirement) — higher than this repo's overall `>=20` floor. Only relevant if you actually configure an MCP server.
