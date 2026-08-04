# Backend

Thin Node.js/Express host app. It resolves the environment and LLM provider, curates this app's Cesium tool surface, and wires everything into `@cesium-ai/server`'s chat router. This is where the LLM API key lives — it never reaches the browser.

See the [top-level README](../README.md) for architecture, quick start, and the full smoke test.

## Structure

```
src/
├── app.ts                 # Express app: composes middleware + routers below into one app
├── routers/
│   └── health-router.ts       # GET /health liveness/readiness probe
├── tools/
│   ├── flyto-tool.ts       # This app's model-facing flyTo input schema (extends the shared shape with descriptions)
│   └── execute-cesium-code-tool.ts # This app's server-executed executeCesiumCode tool (wraps @cesium-ai/codegen-cesium)
└── utils/
    ├── env.ts              # Zod-validated, typed environment config (loads .env)
    ├── mcp-servers-config.ts # Resolves MCP servers from mcp.config.json
    ├── providers.ts        # LLM provider factory — resolves an AI SDK LanguageModel from Env
    └── rate-limit.ts        # In-process per-IP sliding-window rate limiter
```

`app.ts` is split out from the process entry point (env/model resolution + `listen`) so the fully-wired app — real middleware in real order, real tool registry — can be started on an ephemeral port and driven over HTTP in `app.integration.test.ts`.

## Tool surface

The backend builds its tool registry from `ENABLED_CESIUM_TOOLS` (`@cesium-ai/sample-config`, in [`shared/`](../shared)) via `createCesiumTools` (`@cesium-ai/tools-schemas`), so the model is only ever offered tools this app turned on. `flyTo`'s model-facing input schema is this app's extended `flyToInputSchema` (`src/tools/flyto-tool.ts`), which layers `.describe()` hints onto the shared structural shape (`flyToShape` in `@cesium-ai/sample-config`) that the frontend also validates against — see [Working with Cesium Tools](../README.md#working-with-cesium-tools) in the top-level README.

### `executeCesiumCode`: code generation and verification

`executeCesiumCode` is built in `src/tools/execute-cesium-code-tool.ts` and wraps the code generation from `@cesium-ai/codegen-cesium`. The backend generates and verifies code (AST-based), then the frontend receives the verified code and executes it directly against the live Viewer. When the frontend sandbox reports an `executionError`, the next tool execution automatically extracts the latest `{ code, executionError }` result from the AI SDK message history and appends it to the nested codegen prompt as runtime correction context. A later successful execution clears older feedback. AST-based verification remains the server-side security gate; the frontend sandbox provides the independent runtime boundary.

## Environment

Environment variables are parsed and validated by `src/utils/env.ts` (Zod). See the [Environment Variables](../README.md#environment-variables) table in the top-level README for the full list (`AI_PROVIDER`, provider API keys, `RATE_LIMIT_RPM`, `ALLOWED_ORIGIN`, etc.).

## Session middleware (MCP OAuth "Connect" flow)

`src/utils/session.ts`'s `createSessionMiddleware` is only mounted when `sessionMcp` is configured (see [Enabling MCP tools](../README.md#enabling-mcp-tools)). It defaults to `express-session`'s in-memory `MemoryStore` — fine for local dev / a single instance, but sessions (and any MCP connections tied to them) are lost on restart and aren't shared across replicas. `createBackendApp`'s `sessionStore` option accepts any real `express-session`-compatible `Store` (e.g. `connect-redis`) for production; construct it in `src/index.ts` and pass it through. See [`@cesium-ai/server`'s README](../packages/server/README.md#session-scoped-mcp-oauth-connect-createmcpsessionrouter) for why this "Connect" flow is a Backend-for-Frontend design rather than a browser-side PKCE client, the full sequence diagram, and the BFF vs. `sessionStorage` comparison.

## MCP Apps widget bridge

`@cesium-ai/server/mcp`'s `mcp-app-router.ts` (mounted in `app.ts`) exposes `/api/mcp-app/resource` and `/api/mcp-app/tool-call` — the backend-side half of rendering an MCP Apps widget (a tool result's `ui://` HTML resource, e.g. Cesium ion's asset importer). Like the OAuth "Connect" flow above, this backend never hands MCP credentials or a live MCP client to the browser: the widget itself runs inside `@mcp-ui/client`'s sandboxed iframe (`frontend/public/sandbox_proxy.html`, created following the [mcp-ui sandbox proxy setup guide](https://mcpui.dev/guide/client/walkthrough#_3-set-up-a-sandbox-proxy)) and only ever talks to this backend's two proxy routes over plain `fetch`, authenticated by the same session cookie.

- `GET /api/mcp-app/resource` resolves the right `MCPClient` for `(req.sessionID, server)` (checking operator-configured servers first, then this session's own connected servers), rejects any `uri` not starting with `ui://`, and returns the raw `client.readResource(...)` result unmodified.
- `POST /api/mcp-app/tool-call` re-validates `(server, toolName)` against **this request's own** resolved tool registry (`isKnownMcpTool`) before calling `client.callTool(...)` — a widget can never invoke a tool the backend wouldn't otherwise have offered the model.
- Neither route executes a tool call automatically: the frontend (`McpAppWidget.tsx`) always shows an inline Approve/Reject prompt first, and only calls `POST /api/mcp-app/tool-call` once the user approves.

### Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Widget as Widget iframe (sandbox_proxy.html + AppRenderer)
    participant Host as Host page (McpAppWidget.tsx)
    participant Backend as Backend (/api/mcp-app/*)
    participant MCP as MCP Server

    Note over Host: Rendered inline in a tool card once a tool's result<br/>declares a ui:// resource (_meta.ui.resourceUri)
    Host->>Widget: AppRenderer mounts, loads sandbox_proxy.html
    Widget->>Host: onReadResource(uri)
    Host->>Backend: GET /api/mcp-app/resource?server&uri (cookie)
    Backend->>Backend: resolve the MCP client for (session, server)<br/>reject any uri not starting with "ui://"
    Backend->>MCP: readResource(uri)
    MCP-->>Backend: ReadResourceResult (raw)
    Backend-->>Host: ReadResourceResult (raw, unmodified)
    Host-->>Widget: resource contents -> widget HTML renders inside its OWN nested iframe

    Widget->>Host: onCallTool({name, arguments}) - e.g. a button click inside the widget
    Host->>User: inline Approve/Reject prompt (call is PAUSED, no network yet)
    alt user approves
        User->>Host: Approve
        Host->>Backend: POST /api/mcp-app/tool-call {server, toolName, arguments} (cookie)
        Backend->>Backend: isKnownMcpTool(server, toolName) against THIS request's own resolved tool registry
        Backend->>MCP: callTool(toolName, arguments)
        MCP-->>Backend: CallToolResult
        Backend-->>Host: CallToolResult
        Host-->>Widget: resolves the pending tools/call
    else user rejects
        User->>Host: Reject
        Host-->>Widget: rejects the pending tools/call (no backend/network call at all)
    end
```

## Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Run the backend with `tsx watch`             |
| `npm run build`          | Type-check and compile to `dist/`            |
| `npm run typecheck:test` | Type-check source and tests without emitting |
| `npm run start`          | Run the compiled `dist/index.js`             |

Run from the repo root with `npm run dev:backend` to also build/watch the workspace packages it depends on.
