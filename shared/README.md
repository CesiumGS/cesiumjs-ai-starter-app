# Shared (`@cesium-ai/sample-config`)

Shared tool configuration between backend and frontend: the enabled-tools allowlist and the `flyTo` args contract.

## Structure

```
src/
├── enabled-tools.ts    # ENABLED_CESIUM_TOOLS — which tools this app turns on
├── tools/
│   └── flyto-schema.ts # flyToShape — flyTo args contract (base + duration/easingFunction)
└── index.ts            # Public exports
```

## `ENABLED_CESIUM_TOOLS`

The allowlist both tiers read:

- The **backend** builds its tool registry from it via `createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })`.
- The **frontend** keys its `TOOL_EXECUTORS` map off it, so it only acts on enabled tool calls.

To toggle a tool, edit `enabled-tools.ts`. Each entry is type-checked against `CesiumToolName` — a typo fails to build. See the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for the full walkthrough.

## `flyToShape`

This app's structural `flyTo` args contract — `flyToInputShape` from `@cesium-ai/tools-schemas/schemas` extended with `duration` and `easingFunction`. It carries no model-facing text, so the frontend can import it safely. The backend layers `.describe()` hints on top in `backend/src/tools/flyto-tool.ts`.

## Scripts

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `npm run build`          | Type-check and compile to `dist/` |
| `npm run dev`            | Compile in watch mode             |
| `npm run typecheck:test` | Type-check without emitting       |
| `npm run clean`          | Remove `dist/`                    |

Rebuild with `npm run build:packages` from the repo root after editing, or keep `npm run dev` running.
