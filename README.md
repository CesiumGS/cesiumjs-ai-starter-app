# CesiumJS AI Sample App

![Cesium](https://github.com/CesiumGS/cesium/wiki/logos/Cesium_Logo_Color.jpg)

A ready-to-run starter pairing a [CesiumJS](https://cesium.com/platform/cesiumjs/) 3D globe with an LLM-powered chat interface. The LLM drives the globe through structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the browser** — all inference runs behind a Node.js API server.

---

[**Getting Started**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/getting-started/) &nbsp;·&nbsp; [**Architecture**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/architectures/architecture/) &nbsp;·&nbsp; [**Packages**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/) &nbsp;·&nbsp; [**Viewer Tools Tutorial**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/)

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

Requires **Node.js ≥ 20** and **npm ≥ 9**.

```bash
npm install
npm run dev
```

- Globe + HMR: **http://localhost:5173**
- Chat API: `http://localhost:3001`

---

## Try It Out

Type a place into the chat panel — e.g. **`fly to Paris`** — and the camera flies there. Any city, landmark, or address works.

For requests that don't fit a single fly-to, try something like **`drop a pin at the Eiffel Tower`** — this routes through `executeCesiumCode` instead, which is gated behind AI SDK's native tool-approval mechanism (`toolApproval` configured in `backend/src/app.ts` — see `backend/src/tools/execute-cesium-code-tool.ts`): the chat panel shows you the assistant's raw intent for the call and waits for you to **approve or reject it** (a human-in-the-loop checkpoint — see `frontend/src/components/ChatPanel.tsx`'s `onApprovalRequired` handler) _before_ any code is generated. After approval, the backend generates and statically verifies a CesiumJS snippet; the frontend then executes it in a fresh QuickJS-WASM sandbox with memory/deadline limits and a guarded bridge to the live `Viewer`.

If no provider key is configured, the globe still runs as a plain viewer with a "AI is not configured. Add a supported provider API key to your .env file." banner.

---

## Architecture

```
Browser                          Server
┌─────────────────────────┐      ┌────────────────────────────┐
│  Vite SPA               │      │  Node.js API               │
│  ├─ CesiumJS Viewer     │◄────►│  ├─ /api/chat              │
│  └─ Chat Panel          │ SSE  │  ├─ Agent loop (streamText) │
│     └─ onToolCall ──────┼─────►│  └─ Tool registry          │
└─────────────────────────┘      └────────────────────────────┘
         ▲                                   │
         │ Viewer tool results               │ LLM API key (server only)
         └───────────────────────────────────┘
```

Viewer tools (camera, entities) are streamed via [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) to the browser and executed against the live `Viewer`. The workspace packages provide the reusable pieces:

| Package                                                 | Role                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@cesium-ai/server`](packages/server/)                 | [Express](https://expressjs.com) router — mounts `POST /api/chat`, runs the [`streamText`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text) agent loop |
| [`@cesium-ai/tools-schemas`](packages/tools-schemas/)   | [Zod](https://zod.dev)-schemed viewer tool definitions (`flyTo`, entities, imagery, …) — schemas only, no `execute`                                                 |
| [`@cesium-ai/codegen-cesium`](packages/codegen-cesium/) | Intent → [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree)-verified CesiumJS code pipeline; owns the `executeCesiumCode` tool definition                    |
| [`@cesium-ai/sample-config`](shared/)                   | App-level tool allowlist and shared `flyTo` args contract                                                                                                           |

- **`@cesium-ai/server`** — an Express router that mounts the AI SDK chat key-layer (`/api/chat`). It accepts a tool registry and a resolved language model and runs the `streamText` agent loop server-side, so the LLM API key never reaches the browser. The host app owns provider selection.
- **`@cesium-ai/tools-schemas`** — Zod-schemed CesiumJS viewer tool definitions (`flyTo`, …). Schemas only, no `execute`, and scoped strictly to tools that run directly against a live `Viewer`.
- **`@cesium-ai/codegen-cesium`** — backend-only pipeline that turns `executeCesiumCode`'s natural-language `intent` into statically-verified CesiumJS code (skills-grounded generation + an AST verifier), and also owns `executeCesiumCode`'s tool definition itself (schema-only, no `execute`) — that tool can't run directly against a `Viewer` like `flyTo` does, so it lives here rather than in `tools-schemas`. Parse-only — it never executes generated code itself.
- **`@cesium-ai/mcp-tools`** — optional, server-only [Model Context Protocol](https://modelcontextprotocol.io) client bridge. Connects to MCP servers (SSE/HTTP — stdio is deliberately unsupported), namespaces + allowlist-filters their tools, and merges them into an AI SDK `ToolSet` a host app spreads alongside `createCesiumTools()` — this is the "MCP-backed tool group" the split-execution diagram above refers to. Entirely opt-in via the backend's `MCP_SERVERS` env var (unset by default). See [`packages/mcp-tools/README.md`](packages/mcp-tools/README.md) for the full security model and API.

This app builds its own executable `executeCesiumCode` tool on top of the library's schema (`backend/src/tools/execute-cesium-code-tool.ts`, wrapping `@cesium-ai/codegen-cesium`), the same "app extends the shared schema" pattern `flyTo` uses via `backend/src/tools/flyto-tool.ts`. Because `executeCesiumCode` is a "Code Mode" tool — the model's output is arbitrary generated code, not bounded typed args like `flyTo`'s lat/lon/altitude — it needs a materially different security posture than `flyTo`. The backend's AST verification (see [`packages/codegen-cesium/README.md`](packages/codegen-cesium/README.md)) is defense-in-depth only, not a substitute for runtime isolation; the frontend independently executes verified snippets through `@cesium-ai/codegen-sandbox`, a fresh QuickJS-WASM interpreter with memory/deadline limits and a guarded host bridge. See [`packages/tools-schemas/README.md`](packages/tools-schemas/README.md) and [`packages/codegen-cesium/README.md`](packages/codegen-cesium/README.md) for the full generation/verification pipeline.

See [Architecture](https://cesiumgs.github.io/cesiumjs-ai-starter-app/architectures/architecture/) for more detail.

---

## Working with Cesium Tools

**Enable or disable a tool:** edit `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](shared/src/enabled-tools.ts). Both the backend registry and frontend executor map derive from this array — a typo fails to build, and enabling a tool without a client-side executor also fails to compile.

**Update a tool's schema:** structural args rules live in `flyToInputShape` (both tiers derive from it); model-facing descriptions live in [`flyTo.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/flyto-tool.ts) backend-only and are never bundled into the client.

See the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for the full step-by-step walkthrough.

### Enabling MCP tools

MCP tools are a separate, opt-in tool group — see [`@cesium-ai/mcp-tools`](packages/mcp-tools/README.md) for the full API and security model. Nothing below is required for the app to run; `MCP_SERVERS` is unset by default and no MCP client is ever created.

Set `MCP_SERVERS` in `.env` to a JSON array of servers to connect to at backend startup ([`backend/src/index.ts`](backend/src/index.ts)):

```bash
MCP_SERVERS=[{"name":"docs","transport":{"type":"http","url":"https://example.com/mcp"},"allowedTools":["search"]}]
```

Each configured server's tools are namespaced `mcp__<name>__<toolName>` and merged into the same registry `flyTo`/`executeCesiumCode` live in ([`backend/src/app.ts`](backend/src/app.ts)) — **every MCP tool is approval-gated by default** (`toolApproval: "user-approval"`), the same human-in-the-loop checkpoint `executeCesiumCode` uses, since MCP tools run arbitrary third-party server code this app doesn't control. Connection failures are isolated per server (surfaced on `GET /health` as `mcpServers`) and never prevent the rest of the app from starting.

---

## Environment Variables

| Variable                       | Required          | Description                                                                                                                                                                 |
| ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Yes               | Cesium Ion token — baked into the client bundle at build time. Intentionally client-visible; scope it in the Ion console to restrict allowed assets and HTTP referrers.     |
| `OPENAI_API_KEY`               | When chat enabled | LLM API key — server-side only, never `VITE_` prefixed. Required when `AI_PROVIDER=openai`.                                                                                 |
| `ANTHROPIC_API_KEY`            | When chat enabled | Required when `AI_PROVIDER=anthropic`.                                                                                                                                      |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When chat enabled | Required when `AI_PROVIDER=google`.                                                                                                                                         |
| `AI_PROVIDER`                  | No                | `openai` (default) \| `anthropic` \| `google`                                                                                                                               |
| `AI_MODEL`                     | No                | Override the default model for the selected provider.                                                                                                                       |
| `RATE_LIMIT_RPM`               | No                | Per-IP requests/minute for `/api/chat` (default `20`).                                                                                                                      |
| `CODEGEN_MAX_SKILLS`           | No                | Max BM25-matched `cesiumjs-skills` domains inlined as grounding context in the `executeCesiumCode` tool's generation prompt (default `1`).                                  |
| `CODEGEN_MAX_ATTEMPTS`         | No                | Max regeneration attempts if a generated `executeCesiumCode` snippet fails static AST verification (default `3`).                                                           |
| `MCP_SERVERS`                  | No                | JSON array (or a `mcp.config.json` file at the repo root) of MCP servers to connect to (default: none). See [`packages/mcp-tools/README.md`](packages/mcp-tools/README.md). |
| `MCP_TOOL_TIMEOUT_MS`          | No                | Per-tool-call timeout for MCP tools, in ms (default `30000`).                                                                                                               |
| `VITE_API_BASE_URL`            | No                | Dev default `http://localhost:3001`. In `compose.yaml` this is built as `""` so the frontend calls relative `/api/chat`, which nginx proxies to the backend.                |

See [`.env.example`](.env.example) for the complete list.

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
│   └── codegen-cesium/    # @cesium-ai/codegen-cesium — codegen pipeline + executeCesiumCode tool
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
