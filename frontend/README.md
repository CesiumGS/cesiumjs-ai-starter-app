# Frontend

Vite + React SPA. Renders the CesiumJS globe and the AI chat panel, and executes tool calls streamed from the backend against the live `Viewer`. The LLM API key and model-facing tool descriptions never reach this bundle — see [Smoke Test](../README.md#smoke-test) in the top-level README.

## Structure

```
src/
├── App.tsx                     # Root component — mounts the globe + chat panel
├── components/
│   ├── CesiumGlobe.tsx          # CesiumJS Viewer lifecycle wrapper
│   └── ChatPanel.tsx            # Host-side tool-call listener — TOOL_EXECUTORS map
├── tools/
│   └── camera.ts                 # flyToLocation — client-side flyTo executor
├── utils/
│   ├── cesium-loader.ts          # Viewer initialization (terrain, imagery, defaults)
│   └── config.ts                 # Reads VITE_* env vars (Ion token, chat API base URL)
└── main.tsx                     # React entry point
```

## Tool execution

`ChatPanel.tsx` keys `TOOL_EXECUTORS` by `EnabledCesiumTool` (from `ENABLED_CESIUM_TOOLS` in `@cesium-ai/sample-config`, see [`shared/`](../shared)), so it's self-checking in both directions: it fails to compile unless there's a client-side executor for every enabled tool, and it rejects an executor for any non-enabled tool. It also gates every incoming tool call against that same allowlist at runtime as defense-in-depth, so a disabled or spoofed tool call never drives the live `Viewer`.

The frontend imports only two schema-free pieces from `@cesium-ai/tools-cesium`: tool **names** (`/names`, to wire executors) and structural input **shapes** (`/schemas`, to validate untrusted args) — never the model-facing descriptions, which stay backend-only.

## Environment

Copy [`.env.example`](.env.example) to `.env` and set `VITE_CESIUM_ION_ACCESS_TOKEN` (get one free at [ion.cesium.com](https://ion.cesium.com)). It's baked into the client bundle at build time — intentionally client-visible, so scope it in the Ion console. Optionally set `VITE_API_BASE_URL` to point at a non-default backend (see `src/utils/config.ts`).

## Scripts

| Command                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server with HMR                    |
| `npm run build`          | Type-check (`tsc -b`) and build the production bundle |
| `npm run typecheck:test` | Type-check without building                           |
| `npm run preview`        | Serve the production bundle locally                   |

Run from the repo root with `npm run dev:frontend` for just the Vite server, or `npm run dev` to also start the backend and workspace packages.
