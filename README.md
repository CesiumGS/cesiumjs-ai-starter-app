# CesiumJS AI Sample App

![Cesium](https://github.com/CesiumGS/cesium/wiki/logos/Cesium_Logo_Color.jpg)

A ready-to-run starter pairing a [CesiumJS](https://cesium.com/platform/cesiumjs/) 3D globe with an LLM-powered chat interface. The LLM drives the globe through structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the browser** — all inference runs behind a Node.js API server.

---

[**Getting Started**](docs/getting-started.md) &nbsp;·&nbsp; [**Architecture**](docs/architectures/architecture.md) &nbsp;·&nbsp; [**Packages**](docs/packages/index.md) &nbsp;·&nbsp; [**Tutorials**](docs/tutorials/index.md)

---

## Get Started

You need an **LLM API key** from OpenAI, Anthropic, or Google Generative AI to enable chat. A free [Cesium Ion](https://ion.cesium.com) token is optional but improves terrain and imagery.

```bash
npx degit CesiumGS/cesiumjs-ai-starter-app cesiumjs-ai-starter-app
cd cesiumjs-ai-starter-app
cp .env.example .env
```

Open `.env` and set `AI_PROVIDER` with its matching API key (e.g. `OPENAI_API_KEY`). Optionally set `VITE_CESIUM_ION_ACCESS_TOKEN`.

### Option A — Docker (recommended)

Requires [Docker Desktop](https://docs.docker.com/get-docker/) only — no local Node.js needed.

```bash
docker compose up --build --wait
```

Open **http://localhost:8080** once both containers report healthy.

### Option B — Local dev (hot reload)

Requires **Node.js ≥ 22** and **npm ≥ 9**.

```bash
npm install
npm run dev
```

- Globe + HMR: **http://localhost:5173**
- Chat API: `http://localhost:3001`

---

## Try It Out

Type a place into the chat panel — e.g. **`fly to Paris`** — and the camera flies there. Any city, landmark, or address works. See the [Cesium Viewer Tools Tutorial](docs/tutorials/cesium-viewer-tools-tutorial.md) for the full walkthrough.

![flyTo tool flying the camera to Palm Jumeirah](docs/assets/fly-to-palm-jumeirah.png)

For requests that don't fit a single tool call, try something like **`add 3D buildings and fly over New York`**. This routes through the `executeCesiumCode` tool instead: the chat panel shows the assistant's intent and waits for you to **approve or reject it** — a human-in-the-loop checkpoint — before any code is generated. Once approved, the backend generates and statically verifies a CesiumJS snippet, then the frontend runs it in a fresh QuickJS-WASM sandbox with memory/deadline limits and a guarded bridge to the live `Viewer`. See the [Codegen Tool Tutorial](docs/tutorials/codegen-tool-tutorial.md) for the full walkthrough.

![executeCesiumCode generating and running verified code that adds 3D buildings over New York](docs/assets/codegen-new-york.gif)

If no provider key is configured, the globe still runs as a plain viewer, with a banner noting that AI chat needs a provider API key.

---

## Architecture

![CesiumJS AI Starter App architecture](docs/assets/architecture-diagram.svg)

Viewer tools (camera, entities) are streamed via [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) to the browser and executed against the live `Viewer`. The LLM API key never reaches the browser — all inference happens behind the Node.js API. See [Architecture](docs/architectures/architecture.md) for the full component diagram, request sequence, and deployment topology. The workspace packages provide the reusable pieces:

| Package                                                   | Role                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@cesium-ai/server`](packages/server/)                   | [Express](https://expressjs.com) router — mounts `POST /api/chat`, runs the [`streamText`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text) agent loop                                                                 |
| [`@cesium-ai/tools-schemas`](packages/tools-schemas/)     | [Zod](https://zod.dev)-schemed viewer tool definitions (`flyTo`, entities, imagery, …) — schemas only, no `execute`                                                                                                                 |
| [`@cesium-ai/tools`](packages/tools/)                     | Default client-side executors for every tool in `tools-schemas` — a host app can override or extend any single tool without forking the rest                                                                                        |
| [`@cesium-ai/codegen-cesium`](packages/codegen-cesium/)   | Intent → [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree)-verified CesiumJS code pipeline; owns the `executeCesiumCode` tool definition                                                                                    |
| [`@cesium-ai/codegen-sandbox`](packages/codegen-sandbox/) | [QuickJS](https://bellard.org/quickjs/) + WASM runtime isolation for executing verified CesiumJS snippets in the browser                                                                                                            |
| [`@cesium-ai/mcp-tools`](packages/mcp-tools/)             | Optional [Model Context Protocol](https://modelcontextprotocol.io) client bridge — opt-in via `mcp.config.json`, exposes allowlisted MCP tools to the agent                                                                         |
| [`@cesium-ai/webmcp-cesium`](packages/webmcp-cesium/)     | Registers viewer tools on `document.modelContext`, the browser-native [WebMCP](https://developer.chrome.com/docs/ai/webmcp) standard — a different, in-browser counterpart to `@cesium-ai/mcp-tools`' server-side MCP client bridge |
| [`@cesium-ai/chat-element`](packages/chat-element/)       | Reusable React chat panel component that renders streamed assistant/tool activity and the tool-approval UX                                                                                                                          |
| [`@cesium-ai/sample-config`](shared/)                     | App-level tool allowlist and shared `flyTo` args contract                                                                                                                                                                           |

Because `executeCesiumCode` is a "Code Mode" tool — the model's output is arbitrary generated code, not bounded typed args like `flyTo`'s lat/lon/altitude — it needs a materially different security posture. Server-side AST verification ([`packages/codegen-cesium`](packages/codegen-cesium/README.md)) is defense-in-depth only, not a substitute for runtime isolation; the frontend independently executes verified snippets in a fresh QuickJS-WASM sandbox with memory/deadline limits and a guarded bridge to the live `Viewer` ([`packages/codegen-sandbox`](packages/codegen-sandbox/README.md)).

See each package's own README (linked above) for its full API, or [Architecture](docs/architectures/architecture.md) for the complete generation/verification pipeline and deployment topology.

---

## Working with Cesium Tools

**Enable or disable a tool:** edit `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](shared/src/enabled-tools.ts). Both the backend registry and frontend executor map derive from this array — a typo fails to build, and enabling a tool without a client-side executor also fails to compile.

**Update a tool's schema:** structural args rules live in `flyToInputShape` (both tiers derive from it); model-facing descriptions live in [`flyTo.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/flyto-tool.ts) backend-only and are never bundled into the client.

See the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for the full step-by-step walkthrough.

### Enabling MCP tools

MCP tools are a separate, opt-in tool group — see [`@cesium-ai/mcp-tools`](packages/mcp-tools/README.md) for the full API and security model. Nothing below is required for the app to run; without an `mcp.config.json` file, no MCP client is ever created.

List servers in a dedicated `mcp.config.json` file at the repo root (see [`mcp.config.json.example`](mcp.config.json.example)). It is a plain JSON array, easier to read and edit than an inline environment value, and keeps server configuration out of shell history:

```json
[
  {
    "name": "docs",
    "transport": { "type": "http", "url": "https://example.com/mcp" },
    "allowedTools": ["search"]
  },
  { "name": "ion", "transport": { "type": "http", "url": "http://localhost:3000/mcp/" } }
]
```

There's no manual "does this need OAuth" flag to set. `backend/src/index.ts` attempts every configured server the same way at startup ([`createMcpTools`](packages/mcp-tools/README.md)):

- **Connects successfully** (e.g. the `docs` server above, using a static header/API key or no auth at all) — shared by every visitor from then on. Tools are namespaced `mcp__<name>__<toolName>` and merged into the same registry `flyTo`/`executeCesiumCode` live in ([`backend/src/app.ts`](backend/src/app.ts)) — **every MCP tool is approval-gated by default** (`toolApproval: "user-approval"`), the same human-in-the-loop checkpoint `executeCesiumCode` uses, since MCP tools run arbitrary third-party server code this app doesn't control.
- **Fails with a 401** (e.g. the `ion` server above) — auto-detected as needing per-user authentication, and automatically offered through the chat panel's interactive Connect flow instead: credentials and MCP clients are scoped to the browser session, kept in backend memory only, and discarded on disconnect or restart. See the mcp-tools README's [session-scoped OAuth](packages/mcp-tools/README.md#session-scoped-oauth) section.
- **Fails any other way** (network unreachable, bad URL, etc.) — recorded as a genuine connection failure (surfaced on `GET /health` as `mcpServers`) and never prevents the rest of the app from starting.

The full resolved tool registry for a given request — including any connected MCP tools, which aren't knowable statically at build time — can be inspected via `GET /api/tools` (rate-limited the same as `/api/chat`); the frontend's `ChatPanel` shows this list in a small "Tools (N)" disclosure so it's visible which tools (built-in and MCP) are actually available in a running instance.

If a connected server's tool declares an ["MCP Apps"](https://modelcontextprotocol.io) `ui://` widget resource (e.g. an interactive asset-import launcher), `GET /api/tools` reports it via that tool's `mcpApp` field and the chat panel renders it inline in a sandboxed iframe (`packages/chat-element/src/McpAppWidget.tsx`) — including a bridge that lets the widget call tools back on its own server, gated behind an explicit inline Approve/Reject prompt. See the mcp-tools README's [MCP Apps widgets](packages/mcp-tools/README.md#mcp-apps-widgets) section for the full architecture.

### Registering WebMCP tools

Separately from the MCP client bridge above, this app also registers its viewer tools on `document.modelContext` — the browser-native [WebMCP](https://developer.chrome.com/docs/ai/webmcp) standard — via [`@cesium-ai/webmcp-cesium`](packages/webmcp-cesium/README.md) (wired in `frontend/src/tools/webmcp-tools.ts` / `frontend/src/App.tsx`). This lets an agent already running **inside the browser tab** call these tools directly against the live `Viewer`; it does **not** make them callable from VS Code Copilot's or Claude Desktop's MCP configuration, which speak MCP over stdio/HTTP/SSE to a separate server process instead. See the [Registering WebMCP Tools tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/webmcp-cesium-tutorial/) for how to enable and test it in Chrome.

---

## Environment Variables

The most commonly configured variables:

| Variable                       | Required | Description                                                                                                                              |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | No       | Cesium Ion token, baked into the client bundle at build time. Improves terrain/imagery quality.                                          |
| `AI_PROVIDER`                  | No       | `openai` (default) \| `anthropic` \| `google`                                                                                            |
| `OPENAI_API_KEY`               | Yes\*    | Required when `AI_PROVIDER=openai`.                                                                                                      |
| `ANTHROPIC_API_KEY`            | Yes\*    | Required when `AI_PROVIDER=anthropic`.                                                                                                   |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes\*    | Required when `AI_PROVIDER=google`.                                                                                                      |
| `AI_MODEL`                     | No       | Override the default model for the selected provider.                                                                                    |
| `RATE_LIMIT_RPM`               | No       | Per-IP requests/minute for `/api/chat` (default `20`).                                                                                   |
| `VITE_API_BASE_URL`            | No       | Dev default `http://localhost:3001`. Built as `""` under `docker compose`, so the frontend calls relative `/api/chat`, proxied by nginx. |

\* Only the key matching your chosen `AI_PROVIDER` is required — the rest can stay blank.

See [`.env.example`](.env.example) for the complete, fully-commented list — including Cesium Ion server overrides, `executeCesiumCode`'s codegen tuning (`CODEGEN_*`), the sandbox's network allowlist, MCP tool timeouts, and OpenTelemetry logs/traces/metrics settings (`OTEL_*`/`VITE_OTEL_*`).

All `VITE_*` vars are read from this single repo-root `.env` for both `npm run dev` (via `frontend/vite.config.ts`'s `envDir`) and `docker compose up` (via `compose.yaml`'s build-arg substitution) — there is no separate `frontend/.env` to keep in sync.

Copy `.env.example` to `.env` and fill in your values. The `.env` file is git-ignored.

---

## Scripts

| Command                  | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run dev`            | Build packages, then start packages (watch), backend, and frontend together |
| `npm run dev:frontend`   | Vite dev server only                                                        |
| `npm run dev:backend`    | Build packages, then run backend + packages in watch mode                   |
| `npm run build:packages` | Type-check and build the `@cesium-ai/*` workspace packages                  |
| `npm run build`          | Build packages, frontend bundle, and backend                                |
| `npm run preview`        | Serve the production frontend bundle locally                                |
| `npm run format`         | Format the whole workspace with Prettier (writes in place)                  |
| `npm run format:check`   | Verify formatting without writing (used in CI)                              |

---

## Project Structure

```
cesiumjs-ai-starter-app/
├── frontend/              # Vite + React SPA (CesiumJS globe + chat panel)
├── backend/               # Thin Express host (provider selection, tool registry, API key)
├── packages/
│   ├── server/            # @cesium-ai/server — chat router + agent loop
│   ├── tools-schemas/     # @cesium-ai/tools-schemas — viewer tool schemas
│   ├── tools/             # @cesium-ai/tools — default client-side tool executors
│   ├── codegen-cesium/    # @cesium-ai/codegen-cesium — codegen pipeline + executeCesiumCode tool
│   ├── codegen-sandbox/   # @cesium-ai/codegen-sandbox — frontend sandbox for generated code
│   ├── mcp-tools/         # @cesium-ai/mcp-tools — optional MCP client bridge
│   ├── webmcp-cesium/     # @cesium-ai/webmcp-cesium — registers viewer tools on document.modelContext
│   └── chat-element/      # @cesium-ai/chat-element — reusable chat panel component
├── shared/                # @cesium-ai/sample-config — enabled tools + flyTo args contract
├── compose.yaml           # Docker Compose — frontend + backend on internal network
└── .env.example           # Environment variable template
```

---

## Code Style

Formatted with [Prettier](https://prettier.io) (`printWidth: 100`, otherwise defaults). Run before committing — CI fails on unformatted files.

```bash
npm run format        # format in place
npm run format:check  # verify (CI)
```

---

## Contributing & License

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Apache 2.0 — see [LICENSE](LICENSE).
