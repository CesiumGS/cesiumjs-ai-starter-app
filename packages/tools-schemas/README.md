# @cesium-ai/tools-schemas

[Zod](https://zod.dev)-schemed CesiumJS viewer tool definitions for the [AI SDK](https://sdk.vercel.ai/docs) — schemas only, no `execute`. The AI SDK streams tool calls to the browser, which runs them against the live `Viewer` and posts results back to the agent loop.

## Tool catalogue

| Domain    | Tools                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera    | `flyTo`, `cameraSetView`, `cameraLookAtTransform`, `cameraStartOrbit`, `cameraStopOrbit`, `cameraGetPosition`, `cameraSetControllerOptions`                                                                                                                            |
| Entity    | `entityAddPoint`, `entityAddBillboard`, `entityAddLabel`, `entityAddModel`, `entityAddPolygon`, `entityAddPolyline`, `entityAddBox`, `entityAddCorridor`, `entityAddCylinder`, `entityAddEllipse`, `entityAddRectangle`, `entityAddWall`, `entityList`, `entityRemove` |
| Animation | `animationCreate`, `animationControl`, `animationRemove`, `animationListActive`, `animationUpdatePath`, `animationCameraTracking`, `clockControl`, `globeSetLighting`                                                                                                  |
| Imagery   | `imageryAdd`, `imageryRemove`, `imageryList`                                                                                                                                                                                                                           |

See the [full Tool Catalogue](../../docs/packages/tools-schemas/tools.md) for per-tool details.

## Usage

```ts
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { createChatRouter } from "@cesium-ai/server";

createChatRouter({
  model,
  tools: createCesiumTools(),
});
```

## Entry points

| Subpath                            | Exports                                 | Consumer     |
| ---------------------------------- | --------------------------------------- | ------------ |
| `@cesium-ai/tools-schemas`         | Full tool definitions with descriptions | Backend only |
| `@cesium-ai/tools-schemas/names`   | `CESIUM_TOOL_NAMES`, `CesiumToolName`   | Both         |
| `@cesium-ai/tools-schemas/schemas` | `flyToInputShape`, `FlyToInput`         | Both         |

Never import the root from client code — it pulls in model-facing descriptions that should not ship in the client bundle.

## Security

Tool call args are attacker-influenceable: the model produces them, they stream unauthenticated, and the client hands them to a live `Viewer`. Two rules follow:

- **Validate before executing.** Re-validate every tool call against `flyToInputShape` (via `/schemas`) before acting on it.
- **Keep descriptions server-side.** Import only `/schemas` or `/names` from frontend code, never the package root.

## Configuring tools

### Enable a subset

```ts
createCesiumTools({ enabled: ["flyTo"] });

// or disable a specific tool:
createCesiumTools({ flyTo: false });
```

### Override descriptions or field hints

```ts
createCesiumTools({
  flyTo: {
    description: "Move the camera to a named place on the globe.",
    fieldDescriptions: {
      altitude: "Height above the ground in metres.",
    },
  },
});
```

`description` replaces the default wholesale. `fieldDescriptions` is shallow-merged over defaults. `inputSchema` fully replaces the model-facing schema.

The defaults are exported so you can extend rather than replace:

```ts
import {
  DEFAULT_FLY_TO_DESCRIPTION,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
} from "@cesium-ai/tools-schemas";
```

### Extend the validated args contract

To add fields and keep both sides in sync, build one shared shape and import it from both server and client — the way `shared/src/flyto-schema.ts` does:

```ts
// shared module
import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

export const flyToShape = z.object({
  ...flyToInputShape.shape,
  duration: z.number().positive().optional(),
});
```

```ts
// server — layer .describe() hints, pass as inputSchema
createCesiumTools({ flyTo: { inputSchema: extendedSchemaWithDescriptions } });

// client
flyToShape.safeParse(rawArgs);
```

## Why `executeCesiumCode` isn't here

This package is for tools whose args are bounded, typed data a client can validate and pass directly to a `Viewer` method. `executeCesiumCode` takes a natural-language `intent` that generates arbitrary code — it needs its own generation, verification, and runtime isolation pipeline. See [`@cesium-ai/codegen-cesium`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/codegen-cesium/).
