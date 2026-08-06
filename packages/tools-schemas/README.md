# @cesium-ai/tools-schemas

[Zod](https://zod.dev)-schemed CesiumJS viewer tool definitions for the [AI SDK](https://sdk.vercel.ai/docs) — schemas only, no `execute`. The AI SDK streams tool calls to the browser, which runs them against the live `Viewer` and posts results back to the agent loop.

## Supported viewer tools

The model-facing catalogue currently contains 19 tools (`CESIUM_TOOL_NAMES`):

| Domain    | Tool                         | Notes                                                                 |
| --------- | ---------------------------- | --------------------------------------------------------------------- |
| Camera    | `flyTo`                      | Fly camera to lon/lat/altitude.                                       |
| Camera    | `cameraSetView`              | Set destination and orientation.                                      |
| Camera    | `cameraLookAtTransform`      | Look at a transform with an offset.                                   |
| Camera    | `cameraOrbit`                | Start or stop orbiting via `action`.                                  |
| Camera    | `cameraGetPosition`          | Read geodetic camera state.                                           |
| Camera    | `cameraSetControllerOptions` | Configure controller behavior flags.                                  |
| Entity    | `entityAdd`                  | Discriminated-union tool by `type` (point, model, polygon, and more). |
| Entity    | `entityList`                 | List entities visible to the tool layer.                              |
| Entity    | `entityRemove`               | Remove an entity by id.                                               |
| Animation | `animationCreate`            | Create an animation track/entity.                                     |
| Animation | `animationRemove`            | Remove animation by id.                                               |
| Animation | `animationListActive`        | List active animations.                                               |
| Animation | `animationUpdatePath`        | Update animation path settings.                                       |
| Animation | `animationCameraTracking`    | Toggle camera tracking for animation.                                 |
| Animation | `clockControl`               | Control viewer clock behavior.                                        |
| Animation | `globeSetLighting`           | Toggle globe lighting.                                                |
| Imagery   | `imageryAdd`                 | Add imagery layer/provider.                                           |
| Imagery   | `imageryRemove`              | Remove imagery layer(s).                                              |
| Imagery   | `imageryList`                | List imagery layers.                                                  |

Every tool follows the exact same shape as `flyTo` (see below): a `<toolName>.schema.ts` with no description text, a `<toolName>.ts` with the default description/field hints and a `create<ToolName>` factory, an entry in `CESIUM_TOOL_NAMES`, and a corresponding key on `CesiumToolsConfig`. `entityAdd`'s per-variant payload shapes (`entityAddPoint`, `entityAddBillboard`, and others) still exist as internal schema modules under `src/tools/entityAdd*/` and are re-exported from the `/schemas` subpath, but are no longer separately registered `CESIUM_TOOL_NAMES` entries or model-facing tools. `entityAdd`'s `type` field is the single model entry point for all entity variants.

See the [full Tool Catalogue](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/tools-schemas/tools/) for per-tool details.

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

| Subpath                            | Exports                                                                                            | Who imports it                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@cesium-ai/tools-schemas`         | Everything below — full tool definitions, incl. model-facing descriptions                          | Backend only. **Never** import the root entry point from client code — it pulls in the human-readable descriptions the LLM reads, which should not ship in the client bundle. |
| `@cesium-ai/tools-schemas/names`   | `CESIUM_TOOL_NAMES`, `CesiumToolName`                                                              | Both. Schema-free — safe for the frontend to key its tool-call executors off of.                                                                                              |
| `@cesium-ai/tools-schemas/schemas` | All `*InputShape`/`*Input` exports (for every tool, e.g. `flyToInputShape`, `entityAddInputShape`) | Both. Structural shapes only, no `.describe()` hints — safe for the frontend to validate untrusted tool-call args against.                                                    |

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
