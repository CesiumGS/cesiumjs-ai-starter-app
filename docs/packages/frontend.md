# frontend (app)

The Vite + React single-page app. Renders the CesiumJS `Viewer` and `<AiChatPanel>`
side by side and wires tool calls from the chat panel to client-side executors.

**Location:** [`frontend/`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/tree/main/frontend)

## Responsibilities

- **`ChatPanel.tsx`** — wires `AiChatPanel`'s `onToolCall` to per-tool client-side
  executors (`TOOL_EXECUTORS: Record<EnabledCesiumTool, ToolExecutor>`), gated by
  `ENABLED_CESIUM_TOOLS` as defense-in-depth against stale or spoofed tool calls.
- **`src/tools/camera.ts`** — the `flyTo` executor: re-validates untrusted args against
  `flyToShape` before driving `viewer.camera.flyTo`.
- **Cesium asset serving** — CesiumJS's static assets are copied into the build via
  `vite-plugin-static-copy`.

## Key files

| File                           | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `src/components/ChatPanel.tsx` | Tool call dispatch — `TOOL_EXECUTORS` map        |
| `src/tools/camera.ts`          | `flyTo` client-side executor                     |
| `src/utils/config.ts`          | Runtime config (API endpoint, Cesium Ion token)  |
| `vite.config.ts`               | Vite config with Cesium asset copy plugin        |
| `nginx.conf`                   | nginx config used in the production Docker image |

## Adding a new tool executor

See the [Cesium Viewer Tools Tutorial](../../tutorials/cesium-viewer-tools-tutorial.md) — enabling a tool requires adding it to
`ENABLED_CESIUM_TOOLS`, writing an executor in `src/tools/`, and registering it in
`ChatPanel.tsx`.

## Running

```bash
# Development (watch mode, started automatically by npm run dev)
npm run dev -w frontend

# Production build
npm run build -w frontend
```

In production the frontend is served by nginx inside a Docker container — see
[Architecture](../architecture.md) for the Docker Compose topology.
