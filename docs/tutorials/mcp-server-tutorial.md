# Adding an MCP Server

<img src="../../assets/ty-book.png" alt="Ty mascot with book" class="doc-illustration" />

This tutorial covers [`@cesium-ai/mcp-tools`](../packages/mcp-tools/index.md), the optional,
server-only bridge that connects this starter's chat agent to one or more
[Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers. It walks through adding
a server to your config, how the backend hooks its tools into the agent loop, and how to verify
the connection and try a tool call end to end.

For the underlying component model and sequence diagrams, see
[MCP Support Architecture](../architectures/architecture-mcp.md). This tutorial is the
task-oriented "how do I actually configure one" companion to that document.

---

## 1. How it works end to end

Unlike `flyTo` (executed in the browser) or `executeCesiumCode` (generated server-side, executed
in the browser), an MCP tool's `execute()` calls the MCP server directly from Node — its result
**is** the final outcome, never re-executed client-side. Here is what happens once a server is
configured:

1. At backend startup, [`backend/src/index.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/index.ts)
   calls `createMcpTools({ servers: env.MCP_SERVERS })` — connecting to every configured server and
   discovering its tools, once, before the HTTP server starts listening.
2. Each server's tools are namespaced `mcp__<serverName>__<toolName>` and merged into the same
   tool registry `flyTo`/`executeCesiumCode` live in
   ([`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts)).
3. A chat turn that needs one of these tools works exactly like any other tool call — the model
   decides to call it, the browser shows an approval prompt (every MCP tool is
   approval-gated by default), and on approval the backend forwards the call to the MCP server
   and streams back the final result.

For the full sequence diagram, see
[MCP Support Architecture § Sequence — connecting at startup, then a tool-calling turn](../architectures/architecture-mcp.md#2-sequence-connecting-at-startup-then-a-tool-calling-turn).

---

## 2. Add a server to `MCP_SERVERS`

`MCP_SERVERS` is a JSON array of `McpServerConfig` objects, read once at backend startup. Set it
in your root `.env` (see [`.env.example`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/.env.example)):

```bash
MCP_SERVERS=[{"name":"docs","transport":{"type":"http","url":"https://example.com/mcp"},"allowedTools":["search"]}]
```

Each entry has this shape:

```ts
interface McpServerConfig {
  name: string; // unique — used for namespacing (mcp__<name>__<tool>) and logs
  transport: {
    type: "sse" | "http"; // stdio (spawning a local executable) is deliberately unsupported
    url: string;
    headers?: Record<string, string>; // e.g. { Authorization: "Bearer ..." } for static auth
  };
  allowedTools?: readonly string[]; // omit = expose every tool the server advertises
}
```

To configure more than one server, add more entries to the array:

```bash
MCP_SERVERS=[
  {"name":"docs","transport":{"type":"http","url":"https://example.com/mcp"},"allowedTools":["search"]},
  {"name":"maps","transport":{"type":"sse","url":"https://maps.example.com/sse"}}
]
```

`parseMcpServerConfigs`/`McpServerConfigsSchema` (used by `backend/src/utils/env.ts`) validate this
at startup: an invalid transport `type`, a malformed URL, or a duplicate `name` fails env
validation with a clear message rather than connecting to something unexpected.

> **Config is trusted, operator-supplied input — never derived from a chat request.** A server URL
> controls what code effectively runs on your behalf; only add servers you trust the same way you'd
> trust an LLM API key.

### Static header authentication

If a server needs a static bearer token or API key, pass it via `headers`:

```bash
MCP_SERVERS=[{"name":"docs","transport":{"type":"http","url":"https://example.com/mcp","headers":{"Authorization":"Bearer sk-..."}}}]
```

This is the only authentication mechanism this package currently wires up — there is no OAuth
token-refresh flow (see the [Limitations section](../packages/mcp-tools/index.md) of the package
README).

### Restricting which tools are exposed

Omitting `allowedTools` exposes every tool the server advertises. For any server you don't fully
control, prefer an explicit allowlist — it limits what the model can call to only the tools you've
reviewed, and protects against the server later adding new, unreviewed tools:

```bash
MCP_SERVERS=[{"name":"docs","transport":{"type":"http","url":"https://example.com/mcp"},"allowedTools":["search","getPage"]}]
```

### Per-call timeout

`MCP_TOOL_TIMEOUT_MS` (default `30000`) bounds how long the backend waits for any single MCP tool
call before rejecting it — applies to every configured server:

```bash
MCP_TOOL_TIMEOUT_MS=15000
```

---

## 3. How the backend hooks a server's tools into the agent loop

Nothing else needs to change in your code — connecting and merging happens automatically once
`MCP_SERVERS` is non-empty. It's still useful to know where the wiring lives:

**Connect at startup** — [`backend/src/index.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/index.ts):

```ts
const mcp =
  env.MCP_SERVERS.length > 0
    ? await createMcpTools({
        servers: env.MCP_SERVERS,
        timeoutMs: env.MCP_TOOL_TIMEOUT_MS,
        logger: createConsoleMcpToolsLogger("info"),
      })
    : undefined;
```

**Merge into the registry + approval-gate** — [`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts):

```ts
const tools: ToolSet = {
  ...createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS, flyTo: { inputSchema: flyToInputSchema } }),
  ...(model
    ? { [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: createExecuteCesiumCodeTool({ model }) }
    : {}),
  ...(mcp?.tools ?? {}), // every discovered MCP tool, already namespaced + timeout-wrapped
};

app.use(
  createChatRouter({
    model,
    tools,
    toolApproval: {
      [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval",
      // Every MCP tool defaults to the same human-in-the-loop gate.
      ...Object.fromEntries(Object.keys(mcp?.tools ?? {}).map((name) => [name, "user-approval"])),
    },
  }),
);
```

**Shut down cleanly** — `mcp.close()` is called on `SIGTERM`/`SIGINT` in the same `index.ts`,
closing every underlying MCP client connection.

None of this requires editing `shared/src/enabled-tools.ts` (unlike `flyTo`/`executeCesiumCode`) —
an MCP server's tools are discovered dynamically at connect time, not hand-declared ahead of time.

---

## 4. Verify the connection

Restart the backend (`.env` changes require a restart — there's no live-reload for env vars) and
check the startup log:

```text
  mcp: "docs" connected (2 tool(s))
```

or, on failure:

```text
  mcp: "docs" failed to connect: <error message>
```

A connection failure for one server never prevents the others (or the rest of the app) from
starting — it's recorded, not thrown.

You can also check `GET /health`, which includes a `mcpServers` array (only present when at least
one server is configured):

```bash
curl http://localhost:3001/health
```

```json
{
  "status": "ok",
  "provider": "openai",
  "providerConfigured": true,
  "mcpServers": [{ "name": "docs", "connected": true, "toolNames": ["search"] }]
}
```

If `connected` is `false`, an `error` field explains why (e.g. an unreachable URL or an auth
failure) — this is the first place to look when a server isn't showing up in chat.

---

## 5. Try it in the chat panel

Once connected, ask the chat panel something that would naturally call the new tool — for example,
if you configured a `docs` server with a `search` tool: _"search the docs for camera controls"_.

1. The model decides to call `mcp__docs__search`.
2. The chat panel shows an approval prompt (the same Approve/Reject UI `executeCesiumCode` uses) —
   nothing runs until you approve.
3. On approval, the backend forwards the call to the MCP server and returns the result; the model
   uses it to compose its final reply.

![MCP tool call being approved and executed in the chat panel](../assets/fire_mcp.gif)

If the model never calls the tool, double-check `allowedTools` doesn't exclude it and that the
server actually advertises a tool relevant to your prompt (see `toolNames` in `/health`).

---

## 6. Security checklist before adding a new server

- **Only add servers you trust.** `MCP_SERVERS` is operator config, equivalent in trust level to an
  LLM API key — never build it from user/chat input.
- **Prefer `allowedTools` over a full, unreviewed catalogue** — especially for a third-party server
  you don't operate yourself.
- **Use `createConsoleMcpToolsLogger("info")` (already the default in `index.ts`)** and re-review
  the logged tool names/descriptions whenever a server's catalogue might have changed — an MCP
  server can silently reword a tool's description at any time
  ([tool poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)).
- **Leave approval gating on.** Don't remove a tool's `"user-approval"` entry unless you fully
  trust that specific server's tool to run unattended.
- **`stdio` transport is deliberately unsupported** — only `sse`/`http` are accepted, so there's no
  way to configure this app to spawn a local executable via MCP.

See [MCP Support Architecture § Security model](../architectures/architecture-mcp.md#5-security-model)
and the [package README](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/mcp-tools/README.md)
for the full threat model.

---

## 7. Quick reference

| I want to…                                     | Where to look                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Add a new MCP server                           | `MCP_SERVERS` env var — append an entry to the JSON array          |
| Remove a server                                | Delete its entry from `MCP_SERVERS` and restart the backend        |
| Restrict which tools a server exposes          | `allowedTools` on that server's config entry                       |
| Add static auth (bearer token / API key)       | `transport.headers` on that server's config entry                  |
| Change the per-call timeout                    | `MCP_TOOL_TIMEOUT_MS` env var (applies to every configured server) |
| Check whether a server connected               | Backend startup log, or `GET /health`'s `mcpServers` array         |
| See which tools a connected server contributed | `toolNames` in `/health`'s `mcpServers` entry for that server      |
| Understand the architecture                    | [MCP Support Architecture](../architectures/architecture-mcp.md)   |
| Review the full API and security model         | [`@cesium-ai/mcp-tools` README](../packages/mcp-tools/index.md)    |
