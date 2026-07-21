# Frontend

[Vite](https://vitejs.dev) + [React](https://react.dev) SPA. Renders the CesiumJS globe and AI chat panel, and executes verified tool calls from the backend against the live `Viewer`. The LLM API key never reaches this bundle.

## Structure

| File                                                                                                                                          | Description                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`src/App.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/App.tsx)                                           | Root: globe + chat panel                  |
| [`src/components/CesiumGlobe.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/CesiumGlobe.tsx)     | CesiumJS Viewer lifecycle wrapper         |
| [`src/components/ChatPanel.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/ChatPanel.tsx)         | Tool-call listener — `TOOL_EXECUTORS` map |
| [`src/tools/camera.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/tools/camera.ts)                           | `flyTo` client-side executor              |
| [`src/tools/execute-cesium-code.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/tools/execute-cesium-code.ts) | `executeCesiumCode` result handler        |
| [`src/utils/cesium-loader.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/utils/cesium-loader.ts)             | Viewer initialization                     |
| [`src/utils/config.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/utils/config.ts)                           | `VITE_*` env vars                         |
| [`src/main.tsx`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/main.tsx)                                         | React entry point                         |

## Tool execution

`ChatPanel.tsx` keys `TOOL_EXECUTORS` by `EnabledCesiumTool` from `ENABLED_CESIUM_TOOLS` (see [`@cesium-ai/sample-config`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/sample-config/)). It is compile-time checked in both directions — a missing executor or a non-enabled tool both fail to build — and gates every incoming tool call at runtime as defense-in-depth.

The frontend imports only tool **names** (`/names`) and structural **shapes** (`/schemas`) from shared packages — never model-facing descriptions, which stay backend-only.

`executeCesiumCode` is handled via `handleServerToolResult`: the backend streams AST-verified code, the user approves, and `executeApprovedCesiumCode` executes it via `new Function("viewer", "Cesium", code)`. See the [backend](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/backend/) for the verification pipeline.

## Environment

Copy `.env.example` to `.env` and set `VITE_CESIUM_ION_ACCESS_TOKEN` ([get one free](https://ion.cesium.com)). Optionally set `VITE_API_BASE_URL` to point at a non-default backend.

## Scripts

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start Vite dev server with HMR             |
| `npm run build`          | Type-check and build the production bundle |
| `npm run typecheck:test` | Type-check without building                |
| `npm run preview`        | Serve the production bundle locally        |

Run from the repo root with `npm run dev:frontend`, or `npm run dev` to also start the backend.
