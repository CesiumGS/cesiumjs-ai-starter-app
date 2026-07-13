# @cesium-ai/sample-config (shared/)

A small workspace package holding **this sample app's** tool selection and configuration.
Not tool implementations (those live in `@cesium-ai/tools-schemas`) — just the app-level
choices that both `backend/` and `frontend/` need to agree on.

**Location:** [`shared/`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/tree/main/shared)

## Structure

```
shared/src/
├── enabled-tools.ts      ENABLED_CESIUM_TOOLS — which tools this app turns on
├── tools/
│   └── flyto-schema.ts   flyToShape — flyTo args extended with duration/easingFunction
└── index.ts              public exports
```

## `ENABLED_CESIUM_TOOLS`

The allowlist both tiers read from. Adding a name exposes that tool; removing it retires it.

```ts
// shared/src/enabled-tools.ts
import { CESIUM_TOOL_NAMES, type CesiumToolName } from "@cesium-ai/tools-schemas/names";

export const ENABLED_CESIUM_TOOLS = [
  CESIUM_TOOL_NAMES.flyTo,
] as const satisfies readonly CesiumToolName[];

export type EnabledCesiumTool = (typeof ENABLED_CESIUM_TOOLS)[number];
```

- The **backend** builds its registry from it:
  `createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })` — the model is never offered a
  tool not on this list.
- The **frontend** keys its `TOOL_EXECUTORS` map off `EnabledCesiumTool` — the TypeScript
  compiler requires an executor for every enabled tool and rejects executors for
  non-enabled ones, checked at compile time via `satisfies readonly CesiumToolName[]`.

Only the schema-free `/names` subpath is imported here, so no tool definitions or
descriptions leak into the client bundle.

## `flyToShape`

Demonstrates extending a stock tool's contract. The library's `flyToInputShape` covers
`latitude`, `longitude`, and `altitude`; this app adds `duration` and `easingFunction` on
top:

```ts
// shared/src/tools/flyto-schema.ts
import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

export const flyToShape = z.object({
  ...flyToInputShape.shape,
  duration: z.number().positive().optional(),
  easingFunction: z.enum(EASING_FUNCTION_NAMES).optional(),
});
```

Both the backend
([`backend/src/tools/flyto-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/flyto-tool.ts)
— layers `.describe()` hints on top) and the frontend executor
([`frontend/src/tools/camera.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/tools/camera.ts)
— validates raw args) import the same `flyToShape`, so the two sides can't silently drift
apart.

See [Extending a tool's input schema](../../tutorials/cesium-viewer-tools-tutorial.md#4-extending-a-tools-input-schema)
in the tutorial for the full pattern.
