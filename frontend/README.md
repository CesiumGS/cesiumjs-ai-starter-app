# Frontend

[Vite](https://vitejs.dev) + [React](https://react.dev) SPA. Renders the CesiumJS globe and AI chat panel, and executes verified tool calls from the backend against the live `Viewer`. The LLM API key never reaches this bundle.

## Structure

```
src/
├── App.tsx                     # Root component — mounts the globe + chat panel
├── components/
│   ├── CesiumGlobe.tsx          # CesiumJS Viewer lifecycle wrapper
│   ├── ChatPanel.tsx            # Host-side tool-call listener — TOOL_EXECUTORS map
│   └── RegisteredToolsList.tsx  # "Tools (N)" disclosure listing the backend's full tool registry
├── tools/
│   ├── camera.ts                       # flyToLocation — client-side flyTo executor
│   ├── execute-cesium-code-result.ts    # Result-shape validation + isExecuteCesiumCodeTool tool-name check
│   ├── render-error-watch.ts           # waitForRenderError — delayed render-loop crash detection
│   └── execute-cesium-code.ts          # Sandbox execution (executeApprovedCesiumCode) + orchestration (handleExecuteCesiumCodeResult)
├── utils/
│   ├── cesium-loader.ts          # Viewer initialization (terrain, imagery, defaults)
│   ├── config.ts                 # Reads VITE_* env vars (Ion token, chat/tools API base URL)
│   └── fetch-registered-tools.ts # Fetches + validates the backend's GET /api/tools response
└── main.tsx                     # React entry point
```

## Tool execution

`ChatPanel.tsx` keys `TOOL_EXECUTORS` by `EnabledCesiumTool` from `ENABLED_CESIUM_TOOLS` (see [`@cesium-ai/sample-config`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/sample-config/)). It is compile-time checked in both directions — a missing executor or a non-enabled tool both fail to build — and gates every incoming tool call at runtime as defense-in-depth.

The frontend imports only tool **names** (`/names`) and structural **shapes** (`/schemas`) from shared packages — never model-facing descriptions, which stay backend-only.

## `executeCesiumCode`: server-verified, client-executed

`executeCesiumCode` is a "Code Mode" tool resolved server-side — `@cesium-ai/codegen-cesium` generates and verifies the snippet via AST inspection, then streams it to `ChatPanel.tsx`'s `handleServerToolResult` (see [`backend/README.md`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/README.md)). After user approval, the frontend validates the result and executes it in a fresh QuickJS-WASM runtime from `@cesium-ai/codegen-sandbox`. The sandbox has a memory/deadline budget, an opaque-handle bridge to the live Viewer, host-side collection caps, a per-session execution rate limit, and blocks lifecycle, DOM, private, and bulk-removal properties. Static verification and runtime isolation are independent gates.

## MCP Apps widget sandbox

`public/sandbox_proxy.html` is this app's host-served sandbox proxy for MCP Apps widgets (`@cesium-ai/chat-element`'s `McpAppWidget`/`AppRenderer`), created following the [mcp-ui "Set Up a Sandbox Proxy" guide](https://mcpui.dev/guide/client/walkthrough#_3-set-up-a-sandbox-proxy). It's served as a static asset at `/sandbox_proxy.html` on this app's own origin — see [`backend/README.md`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/backend/#mcp-apps-widget-bridge) for the full widget bridge/security model.

## Environment

There is no `frontend/.env` — `vite.config.ts` sets `envDir` to the repo root, so both `npm run dev` and `docker compose up` read the single top-level `.env` (see [`../.env.example`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/.env.example) and [top-level README § Environment Variables](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/README.md#environment-variables)). Copy `../.env.example` to `../.env` and set `VITE_CESIUM_ION_ACCESS_TOKEN` (get one free at [ion.cesium.com](https://ion.cesium.com)). It's baked into the client bundle at build time — intentionally client-visible, so scope it in the Ion console. Optionally set `VITE_API_BASE_URL` to point at a non-default backend, or `VITE_LOG_LEVEL` (`debug`/`info`/`warn`/`error`/`silent`) to control this app's console logging (currently just the codegen sandbox's logger) — defaults to `debug` in dev builds, `silent` in production (see `src/utils/config.ts`). Set `VITE_SANDBOX_ALLOWED_NETWORK_ORIGINS` to a comma-separated list of exact HTTP(S) origins when generated Cesium code must load external assets; leaving it empty denies guest-provided network URLs.

## Scripts

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start Vite dev server with HMR             |
| `npm run build`          | Type-check and build the production bundle |
| `npm run typecheck:test` | Type-check without building                |
| `npm run preview`        | Serve the production bundle locally        |

Run from the repo root with `npm run dev:frontend`, or `npm run dev` to also start the backend.
