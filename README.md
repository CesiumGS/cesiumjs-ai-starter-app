# CesiumJS AI Tools Sample

A production-ready starter that pairs a [CesiumJS](https://cesium.com/platform/cesiumjs/) 3D globe viewer with an LLM-powered chat interface. The LLM drives the globe through structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the browser** — all inference runs behind a Node.js API server.

---

## Get Started

To run the AI-powered chat with the CesiumJS globe, you need an **LLM API key** from one of: OpenAI, Anthropic, or Google Generative AI.

Optionally, add a free [Cesium Ion](https://ion.cesium.com) access token for high-quality terrain and imagery (without it, the globe displays basic imagery).

This sample lives in its own standalone repo, [`CesiumGS/cesiumjs-ai-starter-app`](https://github.com/CesiumGS/cesiumjs-ai-starter-app). Grab it with [`degit`](https://github.com/Rich-Harris/degit) (no git history, just the files; requires Node.js for `npx`):

```bash
npx degit CesiumGS/cesiumjs-ai-starter-app cesiumjs-ai-starter-app
cd cesiumjs-ai-starter-app
```

Every command below runs from this folder. First, create your `.env` file:

```bash
cp .env.example .env
```

Then open `.env` and set `AI_PROVIDER` with its matching API key (e.g. `OPENAI_API_KEY` for OpenAI). Optionally, also set `VITE_CESIUM_ION_ACCESS_TOKEN` for better terrain and imagery.

Now pick one of the two ways to run it below.

### Option A — Docker (no Node.js needed) ⭐ recommended

The only prerequisite is [Docker Desktop](https://docs.docker.com/get-docker/) (includes Compose v2). Node.js, npm, and all dependencies live inside the containers — nothing is installed on your machine.

```bash
docker compose up --build --wait
```

`--wait` returns only once both containers report **healthy**, so you know exactly when to open the app:

**→ http://localhost:8080**

Stop it with `Ctrl+C` (or `docker compose down`). To rebuild after changing `.env`, re-run the same command.

### Option B — Local dev (hot reload)

For active development with hot module reload. Requires **Node.js ≥ 20** and **npm ≥ 9**.

```bash
npm install
npm run dev
```

- Globe (with HMR): **http://localhost:5173**
- Chat API: `http://localhost:3001`

---

## Try It Out

Open the app, type a place into the chat panel — e.g. **`fly to Paris`** — and send it. The camera flies there and the assistant confirms on arrival. Any city, country, landmark, or address the model knows works: try **London**, **Mount Everest**, or **1600 Pennsylvania Avenue**.

For requests that don't fit a single fly-to, try something like **`drop a pin at the Eiffel Tower`** — this routes through `executeCesiumCode` instead, which is gated behind AI SDK's native tool-approval mechanism (`toolApproval` configured in `backend/src/app.ts` — see `backend/src/tools/execute-cesium-code-tool.ts`): the chat panel shows you the assistant's raw intent for the call and waits for you to **approve or reject it** (a human-in-the-loop checkpoint — see `frontend/src/components/ChatPanel.tsx`'s `onApprovalRequired` handler) _before_ any code is generated. After approval, the backend generates and statically verifies a CesiumJS snippet; the frontend then executes it in a fresh QuickJS-WASM sandbox with memory/deadline limits and a guarded bridge to the live `Viewer`.

If no provider API key is configured, the chat panel shows a banner — _"AI is not configured. Add a supported provider API key to your .env file."_ — and the globe still runs as a plain viewer.

---

## How Docker Serves It

nginx serves the app at `http://localhost:8080` and proxies `/api/*` to the backend over an internal Docker network. **The backend port is never published to the host** — it's only reachable from the frontend container.

Both `frontend/Dockerfile` and `backend/Dockerfile` are self-contained, multi-stage builds: each compiles its own source (Vite SPA / TypeScript API) and packages the result in a single `docker build` — no local `npm run build` needed first. The frontend serves static assets via nginx (gzip, cache headers, SPA fallback, `/api/*` proxy); the backend runs on a slim `node:lts-alpine` runner as a non-root user. Both build from the **repo root** as context (Compose handles this) because the app is an npm workspace monorepo that shares `@cesium-ai/*` packages across the frontend and backend.

**Viewer-only mode:** leave all provider API keys blank in `.env` to run just the globe with no LLM backend. See the comment block at the top of [`compose.yaml`](compose.yaml) for how to drop the backend container entirely.

**Smoke test:**

```bash
curl -f http://localhost:8080/                   # frontend serves the SPA shell
curl -f http://localhost:8080/api/chat -X POST \
  -H "Content-Type: application/json" -d '{}'     # proxied to the backend (expect a 4xx, not a connection error)
docker compose ps                                 # both services should show "healthy"
```

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
         │ Viewer tool results               │ MCP / LLM API key (server only)
         └───────────────────────────────────┘
```

**Split-execution model:** Viewer tools (camera navigation, entity manipulation) are streamed to the browser and executed against the live `Viewer` instance. MCP tools run entirely server-side and are never streamed as client tool calls.

**Workspace packages:** The reusable, model-agnostic pieces live in `packages/` and are consumed by the `backend/` host app:

- **`@cesium-ai/server`** — an Express router that mounts the AI SDK chat key-layer (`/api/chat`). It accepts a tool registry and a resolved language model and runs the `streamText` agent loop server-side, so the LLM API key never reaches the browser. The host app owns provider selection.
- **`@cesium-ai/tools-schemas`** — Zod-schemed CesiumJS viewer tool definitions (`flyTo`, …). Schemas only, no `execute`, and scoped strictly to tools that run directly against a live `Viewer`.
- **`@cesium-ai/tools`** — default, ready-to-use **client-side executors** for every tool in `@cesium-ai/tools-schemas`'s catalogue (`flyTo`, camera, entity, animation, and imagery tools) — the browser-side "other half" of that schema-only package, so a host app doesn't have to hand-write an executor for every tool before it can turn one on. `createCesiumToolExecutors({ ... })` lets a host override or extend any individual tool (e.g. this app's own `flyTo`, which validates against an extended shape — see below) without forking the rest. See [`packages/tools/README.md`](packages/tools/README.md).
- **`@cesium-ai/codegen-cesium`** — backend-only pipeline that turns `executeCesiumCode`'s natural-language `intent` into statically-verified CesiumJS code (skills-grounded generation + an AST verifier), and also owns `executeCesiumCode`'s tool definition itself (schema-only, no `execute`) — that tool can't run directly against a `Viewer` like `flyTo` does, so it lives here rather than in `tools-schemas`. Parse-only — it never executes generated code itself.
- **`@cesium-ai/mcp-tools`** — optional, server-only [Model Context Protocol](https://modelcontextprotocol.io) client bridge. Connects to MCP servers (SSE/HTTP — stdio is deliberately unsupported), namespaces + allowlist-filters their tools, and merges them into an AI SDK `ToolSet` a host app spreads alongside `createCesiumTools()` — this is the "MCP-backed tool group" the split-execution diagram above refers to. Entirely opt-in through an `mcp.config.json` file, with no MCP client created when the file is absent. See [`packages/mcp-tools/README.md`](packages/mcp-tools/README.md) for the full security model and API.

This app builds its own executable `executeCesiumCode` tool on top of the library's schema (`backend/src/tools/execute-cesium-code-tool.ts`, wrapping `@cesium-ai/codegen-cesium`), the same "app extends the shared schema" pattern `flyTo` uses via `backend/src/tools/flyto-tool.ts`. Because `executeCesiumCode` is a "Code Mode" tool — the model's output is arbitrary generated code, not bounded typed args like `flyTo`'s lat/lon/altitude — it needs a materially different security posture than `flyTo`. The backend's AST verification (see [`packages/codegen-cesium/README.md`](packages/codegen-cesium/README.md)) is defense-in-depth only, not a substitute for runtime isolation; the frontend independently executes verified snippets through `@cesium-ai/codegen-sandbox`, a fresh QuickJS-WASM interpreter with memory/deadline limits and a guarded host bridge. See [`packages/tools-schemas/README.md`](packages/tools-schemas/README.md) and [`packages/codegen-cesium/README.md`](packages/codegen-cesium/README.md) for the full generation/verification pipeline.

---

## Working with Cesium Tools

Two common changes — turning a tool on or off, and editing a tool's schema — each have a single, well-defined place to edit. Both sides (backend registry, frontend executors) follow from there.

### Enable or disable a tool

The app's tool surface is curated in **one** array: `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](shared/src/enabled-tools.ts) (the `@cesium-ai/sample-config` package). It is the single source of truth that both tiers read:

- the **backend** builds its registry from it — `createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })` in [`backend/src/index.ts`](backend/src/index.ts) — so the model is only ever offered these tools;
- the **frontend** keys its executor handling off it — `ChatPanel.tsx` gates every incoming tool call on this set as defense-in-depth, so a disabled (or stale/spoofed) tool call never drives the live `Viewer`.

To **disable** a tool, remove its name from the array. To **enable** one, add its name:

```ts
// shared/src/enabled-tools.ts
export const ENABLED_CESIUM_TOOLS = [
  CESIUM_TOOL_NAMES.flyTo,
  CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode,
  // CESIUM_TOOL_NAMES.someOtherViewerTool,   // ← add to enable
] as const satisfies readonly (CesiumToolName | CodegenCesiumToolName)[];
```

Two compile-time guards keep this honest:

- Each entry is checked against `CesiumToolName | CodegenCesiumToolName` (`satisfies`), so a typo or a name that isn't a real Cesium tool fails to build.
- The frontend's `TOOL_EXECUTORS` map in [`frontend/src/components/ChatPanel.tsx`](frontend/src/components/ChatPanel.tsx) is typed `Record<EnabledCesiumTool, ToolExecutor>`. Enabling a tool **without** adding a client-side executor for it fails to compile — so the app can never offer the model a tool the browser can't run.

After editing, rebuild the shared package so both tiers pick up the change: `npm run build:packages` (or just leave `npm run dev` running — it watches). Then guard the contract with the allowlist test:

```bash
npm test -- enabled-tools
```

> **Adding a brand-new tool** is a superset of the above: (1) register its canonical name in `CESIUM_TOOL_NAMES` ([`packages/tools-schemas/src/tool-names.ts`](packages/tools-schemas/src/tool-names.ts)) if it runs directly against the live `Viewer`, or add it to `@cesium-ai/codegen-cesium` instead if — like `executeCesiumCode` — it needs the codegen/verification pipeline first; (2) add its schema/definition module under that package's `src/` and wire it into `createCesiumTools` ([`packages/tools-schemas/src/index.ts`](packages/tools-schemas/src/index.ts)) if it's a viewer tool; (3) add its default executor to `@cesium-ai/tools` ([`packages/tools/src/index.ts`](packages/tools/src/index.ts)) — or, for an app-specific tool that shouldn't ship as a package default, write it directly under `frontend/src/tools/` and pass it as an override to `createCesiumToolExecutors`; (4) add the name to `ENABLED_CESIUM_TOOLS` to turn it on.

### Update a tool's schema

A tool's schema lives in **two layers**, split so the LLM-facing hints never ship to the browser. Pick the layer that matches what you're changing:

| You want to change…                                                                                               | Edit                                                                                                                                                                                                 | Who sees it                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **The args contract** — structural rules (lat/lon ranges, which fields exist, optional vs. required)              | `flyToInputShape` in [`packages/tools-schemas/src/schemas.ts`](packages/tools-schemas/src/schemas.ts)                                                                                                | Both tiers — backend derives from it, frontend validates against it |
| **The model-facing hints** — the human-readable tool `description` and per-field `.describe()` text the LLM reads | `DEFAULT_FLY_TO_DESCRIPTION` / `DEFAULT_FLY_TO_FIELD_DESCRIPTIONS` / `buildFlyToInputSchema` in [`packages/tools-schemas/src/tools/flyTo/flyTo.ts`](packages/tools-schemas/src/tools/flyTo/flyTo.ts) | Backend (model) only — never bundled into the client                |

The structural shape (`schemas.ts`) is the **single source of truth for the args contract**. The frontend imports it directly (via the `/schemas` subpath) to validate untrusted args; the backend's model-facing schema is _derived_ from it in `buildFlyToInputSchema` (`flyToInputShape.shape.*.describe(...)`), layering the LLM hints on without redefining the rules. So a contract change — e.g. tightening the lat/lon ranges — is a **single edit** to `flyToInputShape` that both tiers pick up automatically.

After editing, rebuild the package (`npm run build:packages`, or rely on `npm run dev`'s watch) and run the drift guard, which asserts the backend's model-facing schema and the frontend's validation shape reach the same accept/reject verdict across a battery of boundary inputs:

```bash
npm test -- flyTo.schema-sync
```

> Per-host tweaks without forking the tool: `createFlyTo` accepts a `FlyToConfig` (`description`, `fieldDescriptions`, or a full `inputSchema`). Note the `inputSchema` override replaces only the **model-facing** schema — use it for model-facing tweaks, not to change the validated contract. To change the contract, edit `flyToInputShape`.

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

---

## Environment Variables

| Variable                       | Required          | Description                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Yes               | Cesium Ion token — baked into the client bundle at build time. Intentionally client-visible; scope it in the Ion console to restrict allowed assets and HTTP referrers.                                                                                                                                               |
| `VITE_CESIUM_ION_SERVER_URL`   | No                | Cesium ion API server the token above was issued by. Only needed for a token from a non-production ion server (e.g. an internal or staging ion environment) — leave unset for a normal ion.cesium.com token. A mismatched/missing value here causes every asset request to 401 against the default production server. |
| `OPENAI_API_KEY`               | When chat enabled | LLM API key — server-side only, never `VITE_` prefixed. Required when `AI_PROVIDER=openai`.                                                                                                                                                                                                                           |
| `ANTHROPIC_API_KEY`            | When chat enabled | Required when `AI_PROVIDER=anthropic`.                                                                                                                                                                                                                                                                                |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When chat enabled | Required when `AI_PROVIDER=google`.                                                                                                                                                                                                                                                                                   |
| `AI_PROVIDER`                  | No                | `openai` (default) \| `anthropic` \| `google`                                                                                                                                                                                                                                                                         |
| `AI_MODEL`                     | No                | Override the default model for the selected provider.                                                                                                                                                                                                                                                                 |
| `RATE_LIMIT_RPM`               | No                | Per-IP requests/minute for `/api/chat` (default `20`).                                                                                                                                                                                                                                                                |
| `CODEGEN_MAX_SKILLS`           | No                | Max BM25-matched `cesiumjs-skills` domains inlined as grounding context in the `executeCesiumCode` tool's generation prompt (default `1`).                                                                                                                                                                            |
| `CODEGEN_MAX_ATTEMPTS`         | No                | Max regeneration attempts if a generated `executeCesiumCode` snippet fails static AST verification (default `3`).                                                                                                                                                                                                     |
| `MCP_TOOL_TIMEOUT_MS`          | No                | Per-tool-call timeout for MCP tools, in ms (default `30000`).                                                                                                                                                                                                                                                         |

| `VITE_API_BASE_URL` | No | Dev default `http://localhost:3001`. In `compose.yaml` this is built as `""` so the frontend calls relative `/api/chat`, which nginx proxies to the backend. |
| `VITE_LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` \| `silent` for this app's console loggers (currently just the codegen sandbox's). Defaults to `debug` in dev builds, `silent` in production. |
| `VITE_SANDBOX_ALLOWED_NETWORK_ORIGINS` | No | Comma-separated exact HTTP(S) origins generated Cesium code may load assets from. Empty/unset denies guest-provided network URLs. |

See [`.env.example`](.env.example) for the complete list, including `AI_BASE_URL` and telemetry settings.

All `VITE_*` vars are read from this single repo-root `.env` for both `npm run dev` (via `frontend/vite.config.ts`'s `envDir`) and `docker compose up` (via `compose.yaml`'s build-arg substitution) — there is no separate `frontend/.env` to keep in sync.

Copy `.env.example` to `.env` and fill in your values. The `.env` file is git-ignored.

---

## Scripts

| Command                  | Description                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Build the workspace packages, then start the packages (watch), backend, and frontend concurrently |
| `npm run dev:frontend`   | Start only the Vite dev server with HMR                                                           |
| `npm run dev:backend`    | Build the packages, then run the backend API and packages in watch mode (no frontend)             |
| `npm run build:packages` | Type-check and build the reusable workspace packages (`@cesium-ai/*`)                             |
| `npm run build`          | Build the packages, then type-check and build the frontend bundle and the backend                 |
| `npm run preview`        | Serve the production frontend bundle locally                                                      |
| `npm run format`         | Format the whole workspace with Prettier (writes in place)                                        |
| `npm run format:check`   | Verify formatting without writing — the check CI runs                                             |

---

## Project Structure

```
cesiumjs-ai-tools-sample/
├── frontend/                   # Vite + React SPA
│   ├── src/
│   │   ├── App.tsx             # Root component — mounts Viewer + chat panel
│   │   ├── CesiumGlobe.tsx     # CesiumJS Viewer lifecycle wrapper
│   │   ├── components/
│   │   │   └── ChatPanel.tsx   # Host-side tool-call listener — TOOL_EXECUTORS map
│   │   ├── tools/
│   │   │   ├── camera.ts          # flyToLocation — client-side flyTo executor
│   │   │   └── execute-cesium-code.ts # Result-shape validation for executeCesiumCode
│   │   ├── cesium-loader.ts    # Viewer initialization (terrain, defaults)
│   │   ├── config.ts           # Reads VITE_* env vars
│   │   └── main.tsx            # React entry point
│   ├── vite.config.ts          # Vite config (copies CesiumJS static assets)
│   ├── Dockerfile              # Self-contained: Vite build -> nginx static serve
│   └── nginx.conf              # gzip, cache headers, SPA fallback, /api/* proxy
├── backend/                    # Thin Node.js host app (Express)
│   ├── src/
│   │   ├── index.ts            # Wires @cesium-ai/server + tools, CORS, listen
│   │   ├── app.ts              # Express app (CORS, rate limiter, /health, chat router)
│   │   ├── tools/
│   │   │   ├── flyto-tool.ts   # Backend-only flyTo input schema extensions
│   │   │   └── execute-cesium-code-tool.ts # Server-executed executeCesiumCode tool
│   │   └── utils/
│   │       ├── env.ts          # Zod-validated, typed environment config
│   │       ├── providers.ts    # LLM provider factory (createModel)
│   │       └── rate-limit.ts   # In-process per-IP sliding-window limiter
│   ├── tsconfig.json
│   └── Dockerfile              # Self-contained: tsc build -> slim non-root runner
├── packages/                   # Reusable workspace packages
│   ├── server/                 # @cesium-ai/server — Express chat key-layer
│   │   └── src/
│   │       ├── chat-router.ts  # createChatRouter — POST /api/chat (SSE)
│   │       └── agent.ts        # Agent loop — streamText with tool registry
│   ├── tools-schemas/          # @cesium-ai/tools-schemas — viewer tool schemas
│   │   └── src/
│   │       ├── tool-names.ts   # CESIUM_TOOL_NAMES — canonical viewer tool identifiers
│   │       ├── schemas.ts      # flyToInputShape — shared args contract (structural)
│   │       ├── tools/flyTo/flyTo.ts # flyTo tool (model-facing schema + hints, no execute)
│   │       └── index.ts        # createCesiumTools registry (enabled allowlist)
│   ├── tools/                  # @cesium-ai/tools — default client-side tool executors
│   │   └── src/
│   │       ├── tools/          # One default executor per tool, grouped by domain
│   │       └── index.ts        # DEFAULT_CESIUM_TOOL_EXECUTORS, createCesiumToolExecutors
│   └── codegen-cesium/         # @cesium-ai/codegen-cesium — intent -> verified CesiumJS code pipeline + the executeCesiumCode tool
│       └── src/
│           ├── tool-names.ts   # CODEGEN_CESIUM_TOOL_NAMES — canonical codegen tool identifiers
│           ├── schemas.ts      # executeCesiumCodeInputShape — shared args contract (structural)
│           ├── tools/executeCesiumCode/executeCesiumCode.ts # executeCesiumCode tool (schema-only by design)
│           ├── generate-verified-cesium-code.ts # generateVerifiedCesiumCode orchestration entry point
│           ├── ast-verifier.ts  # Parse-only static verifier (acorn/acorn-walk)
│           └── skills-loader.ts # Loads SKILL.md from the @cesium/cesiumjs-skills package dependency
├── shared/                     # @cesium-ai/sample-config — app's tool selection
│   └── src/
│       └── enabled-tools.ts    # ENABLED_CESIUM_TOOLS — enable/disable a tool here
├── .prettierrc.json            # Prettier config (code formatting rules)
├── .editorconfig               # Editor defaults (indent, charset, EOL)
├── .env.example                # Environment variable template
├── compose.yaml                # Docker Compose — frontend + backend, internal network
├── .dockerignore               # Keeps node_modules/dist/etc. out of the build context
└── package.json                # npm workspace root
```

---

## Cesium Ion Token

The Ion token is required to load Cesium World Terrain and Cesium World Imagery. Get one free at [ion.cesium.com](https://ion.cesium.com). Scope the token in the Ion console (allowed assets + HTTP referrers) before deploying to production.

---

## Code Style

Formatting is enforced with [Prettier](https://prettier.io). Rules live in [`.prettierrc.json`](.prettierrc.json) (the only override is `printWidth: 100`; everything else is Prettier defaults — 2-space indent, double quotes, trailing commas), with [`.editorconfig`](.editorconfig) covering indentation, charset, and line endings for editors. [`.prettierignore`](.prettierignore) excludes build output and the vendored CesiumJS assets.

```bash
npm run format        # format the whole workspace in place
npm run format:check  # verify formatting (fails if anything is unformatted)
```

Run `npm run format` before committing — CI runs `npm run format:check` and fails on unformatted files.

---

## CI

GitHub Actions runs on every push or pull request that touches files under this directory ([`.github/workflows/sample-app-ci.yml`](../../.github/workflows/sample-app-ci.yml)):

- **Format check** — `npm run format:check` (Prettier).
- **Build** — installs dependencies, then builds the workspace packages, the frontend bundle, and the backend (each as a separate, type-checked step).

## 🤝 Contributing

Interested in contributing? Please read [CONTRIBUTING.md](CONTRIBUTING.md). We also ask that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## 📗 License

Apache 2.0. See [LICENSE](LICENSE).
