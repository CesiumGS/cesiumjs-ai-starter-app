# Shared (`@cesium-ai/sample-config`)

A small workspace package: this sample app's tool selection, shared as the single source of truth between the [`backend/`](../backend) and [`frontend/`](../frontend). It holds app-level configuration, not tool implementations — those live in `packages/tools-schemas`.

## Structure

```
src/
├── enabled-tools.ts        # ENABLED_CESIUM_TOOLS — which Cesium tools this app turns on
├── tools/
│   └── flyto-schema.ts       # flyToShape — this app's flyTo args contract (base shape + duration/easingFunction)
└── index.ts                # Public exports
```

## `ENABLED_CESIUM_TOOLS`

The allowlist both tiers read:

- the **backend** builds its tool registry from it — `createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })` — so the model is only ever offered these tools;
- the **frontend** keys its `TOOL_EXECUTORS` map off it, so it only acts on tool calls this app actually enabled.

To enable or disable a tool, edit the array in `enabled-tools.ts`. Each entry is checked against `CesiumToolName` (`satisfies`), so a typo fails to build. See [Working with Cesium Tools](../README.md#working-with-cesium-tools) in the top-level README for the full walkthrough, including the compile-time guards and the contract test (`enabled-tools.spec.ts`).

## `flyToShape`

This app's structural `flyTo` args contract: the library's base shape (`flyToInputShape` from `@cesium-ai/tools-schemas/schemas`) extended with the two fields this app adds — `duration` and `easingFunction`. It carries no model-facing description text, so the frontend can import it (via `flyToLocation`'s validation) without pulling LLM-facing hints into the client bundle. The backend layers `.describe()` hints on top of this same shape in `backend/src/tools/flyto-tool.ts` to build the model-facing schema.

## Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run build`          | Type-check and compile to `dist/`            |
| `npm run dev`            | Compile in watch mode                        |
| `npm run typecheck:test` | Type-check source and tests without emitting |
| `npm run clean`          | Remove `dist/`                               |

Consumed by `backend` and `frontend` as `@cesium-ai/sample-config`; rebuild with `npm run build:packages` from the repo root (or leave `npm run dev` running — it watches) after editing.
