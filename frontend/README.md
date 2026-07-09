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
│   ├── camera.ts                 # flyToLocation — client-side flyTo executor
│   └── execute-cesium-code.ts    # Result-shape validation + isExecuteCesiumCodeTool tool-name check
├── utils/
│   ├── cesium-loader.ts          # Viewer initialization (terrain, imagery, defaults)
│   └── config.ts                 # Reads VITE_* env vars (Ion token, chat API base URL)
└── main.tsx                     # React entry point
```

## Tool execution

`ChatPanel.tsx` keys `TOOL_EXECUTORS` by `EnabledCesiumTool` (from `ENABLED_CESIUM_TOOLS` in `@cesium-ai/sample-config`, see [`shared/`](../shared)), so it's self-checking in both directions: it fails to compile unless there's a client-side executor for every enabled tool, and it rejects an executor for any non-enabled tool. It also gates every incoming tool call against that same allowlist at runtime as defense-in-depth, so a disabled or spoofed tool call never drives the live `Viewer`.

The frontend imports only schema-free pieces from these packages: tool **names** (`/names`, to wire executors) and structural input **shapes** (`/schemas`, to validate untrusted args) — never the model-facing descriptions, which stay backend-only. `flyTo`'s name/shape come from `@cesium-ai/tools-cesium`; `executeCesiumCode`'s come from `@cesium-ai/codegen-cesium`, which owns that tool since it can't run directly against a `Viewer` the way `flyTo` does (see [`packages/tools-cesium/README.md`](../packages/tools-cesium/README.md)).

## `executeCesiumCode`: verified, not yet executed

`executeCesiumCode` is a "Code Mode" tool (arbitrary model-generated JavaScript, not bounded typed args like `flyTo`), and it is resolved **server-side**: the backend streams its result as a `tool-output-available` chunk once `@cesium-ai/codegen-cesium` has generated and statically verified a CesiumJS snippet (see [`backend/README.md`](../backend/README.md)). `ChatPanel.tsx`'s `handleServerToolResult` is the second dispatch path this creates (alongside the existing `onToolCall`/`tool-input-available` path `flyTo` uses) — it validates the result shape, then hands the verified code to `runApprovedCode`.

This initial build stops there: `runApprovedCode` doesn't execute the snippet anywhere, it just reports that execution isn't supported yet. The backend's static AST verification is defense-in-depth only, not a substitute for a real runtime isolation boundary — running arbitrary model-generated code against the live `Viewer` needs one (e.g. a sandboxed interpreter bound to a narrow, explicit, allowlisted capability proxy), which is planned for a follow-up PR.

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
