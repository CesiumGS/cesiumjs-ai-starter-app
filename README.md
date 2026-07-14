# CesiumJS AI Sample App

![Cesium](https://github.com/CesiumGS/cesium/wiki/logos/Cesium_Logo_Color.jpg)

A ready-to-run starter pairing a [CesiumJS](https://cesium.com/platform/cesiumjs/) 3D globe with an LLM-powered chat interface. The LLM drives the globe through structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the browser** — all inference runs behind a Node.js API server.

---

[**Getting Started**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/getting-started/) &nbsp;·&nbsp; [**Architecture**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/architecture/) &nbsp;·&nbsp; [**Packages**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/) &nbsp;·&nbsp; [**Viewer Tools Tutorial**](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/)

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

For richer requests like **`drop a pin at the Eiffel Tower`**, the app routes through `executeCesiumCode`: the chat panel shows you the assistant's intent and waits for you to **approve or reject** before any code is generated (human-in-the-loop). The backend then generates and AST-verifies a CesiumJS snippet for your intent.

If no provider key is configured, the globe still runs as a plain viewer with a "AI is not configured" banner.

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

Viewer tools (camera, entities) are streamed to the browser and executed against the live `Viewer`. The workspace packages provide the reusable pieces:

| Package                                                 | Role                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`@cesium-ai/server`](packages/server/)                 | Express router — mounts `POST /api/chat`, runs the `streamText` agent loop                       |
| [`@cesium-ai/tools-schemas`](packages/tools-schemas/)   | Zod-schemed viewer tool definitions (`flyTo`, entities, imagery, …) — schemas only, no `execute` |
| [`@cesium-ai/codegen-cesium`](packages/codegen-cesium/) | Intent → AST-verified CesiumJS code pipeline; owns the `executeCesiumCode` tool definition       |
| [`@cesium-ai/sample-config`](shared/)                   | App-level tool allowlist and shared `flyTo` args contract                                        |

See [Architecture](https://cesiumgs.github.io/cesiumjs-ai-starter-app/architecture/) for more detail.

---

## Working with Cesium Tools

**Enable or disable a tool:** edit `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](shared/src/enabled-tools.ts). Both the backend registry and frontend executor map derive from this array — a typo fails to build, and enabling a tool without a client-side executor also fails to compile.

**Update a tool's schema:** structural args rules live in `flyToInputShape` (both tiers derive from it); model-facing descriptions live in `flyTo.ts` backend-only and are never bundled into the client.

See the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for the full step-by-step walkthrough.

---

## Environment Variables

| Variable                       | Required          | Description                                                                   |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------- |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Yes               | Cesium Ion token — baked into the client bundle at build time.                |
| `AI_PROVIDER`                  | No                | `openai` (default) \| `anthropic` \| `google`                                 |
| `OPENAI_API_KEY`               | When chat enabled | Required when `AI_PROVIDER=openai`.                                           |
| `ANTHROPIC_API_KEY`            | When chat enabled | Required when `AI_PROVIDER=anthropic`.                                        |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When chat enabled | Required when `AI_PROVIDER=google`.                                           |
| `AI_MODEL`                     | No                | Override the default model for the selected provider.                         |
| `RATE_LIMIT_RPM`               | No                | Per-IP requests/minute for `/api/chat` (default `20`).                        |
| `CODEGEN_MAX_SKILLS`           | No                | Max BM25-matched skill domains inlined in the codegen prompt (default `1`).   |
| `CODEGEN_MAX_ATTEMPTS`         | No                | Max regeneration attempts on AST verification failure (default `3`).          |
| `VITE_API_BASE_URL`            | No                | Backend URL. In Docker this is `""` so nginx proxies `/api/*` to the backend. |

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
