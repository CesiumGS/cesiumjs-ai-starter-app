# @cesium-ai/tools-schemas

Zod-schemed CesiumJS viewer tool definitions for the AI SDK, covering camera, entity, animation, and imagery control. These are **schemas only** — no tool defines `execute`. The AI SDK streams a tool call to the browser, which runs it against the live `Viewer` instance and posts the result back to the agent loop (see `@cesium-ai/server`).

## Tool catalogue

| Domain    | Tools                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera    | `flyTo`, `cameraSetView`, `cameraLookAtTransform`, `cameraStartOrbit`, `cameraStopOrbit`, `cameraGetPosition`, `cameraSetControllerOptions`                                                                                                                            |
| Entity    | `entityAddPoint`, `entityAddBillboard`, `entityAddLabel`, `entityAddModel`, `entityAddPolygon`, `entityAddPolyline`, `entityAddBox`, `entityAddCorridor`, `entityAddCylinder`, `entityAddEllipse`, `entityAddRectangle`, `entityAddWall`, `entityList`, `entityRemove` |
| Animation | `animationCreate`, `animationControl`, `animationRemove`, `animationListActive`, `animationUpdatePath`, `animationCameraTracking`, `clockControl`, `globeSetLighting`                                                                                                  |
| Imagery   | `imageryAdd`, `imageryRemove`, `imageryList`                                                                                                                                                                                                                           |

Every tool follows the exact same shape as `flyTo` (see below): a `<toolName>.schema.ts` with no description text, a `<toolName>.ts` with the default description/field hints and a `create<ToolName>` factory, an entry in `CESIUM_TOOL_NAMES`, and a corresponding key on `CesiumToolsConfig`.

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

| Subpath                            | Exports                                                                   | Who imports it                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@cesium-ai/tools-schemas`         | Everything below — full tool definitions, incl. model-facing descriptions | Backend only. **Never** import the root entry point from client code — it pulls in the human-readable descriptions the LLM reads, which should not ship in the client bundle. |
| `@cesium-ai/tools-schemas/names`   | `CESIUM_TOOL_NAMES`, `CesiumToolName`                                     | Both. Schema-free — safe for the frontend to key its tool-call executors off of.                                                                                              |
| `@cesium-ai/tools-schemas/schemas` | `flyToInputShape`, `FlyToInput`                                           | Both. Structural shape only, no `.describe()` hints — safe for the frontend to validate untrusted tool-call args against.                                                     |

## Security

A `flyTo` tool call is **attacker-influenceable input**: the model produces the arguments, they stream from server to browser unauthenticated over the chat connection, and the client hands them straight to the live `Viewer`. Two separate protections follow from that:

- **Validate before executing.** The client must re-validate every tool call against `flyToInputShape` (via `/schemas`) before acting on it — never trust that a value the server accepted (or the model claims to have sent) is safe to feed to `Viewer.camera.flyTo` unchecked. This is what keeps a malformed or malicious tool call from reaching Cesium's APIs.
- **Keep descriptions server-side.** The root entry point carries the `.describe()` text and natural-language tool `description` the LLM reads. That text can hint at capabilities or internal behavior beyond what the structural schema exposes, so it must never ship in the client bundle — import only `/schemas` or `/names` from frontend code, never the package root.

The `flyTo.schema-sync.test.ts` suite (and its per-app extensions, e.g. `backend/src/flyto-tool.test.ts`) exists specifically to guarantee these two schemas can't silently diverge — if the server ever accepts an input the client's copy rejects (or vice versa), that's either a tool call the browser wrongly executes or one it wrongly refuses.

## Configuring or overriding defaults

### Enable only a subset of tools

`createCesiumTools` accepts a `CesiumToolsConfig` object. Pass `enabled` to register only a chosen allowlist (omit it to include every tool):

```ts
createCesiumTools({ enabled: ["flyTo"] });
```

Or drop a specific tool via its own config, using `false`:

```ts
createCesiumTools({ flyTo: false });
```

### Override a tool's description or field hints

Every per-tool config accepts a `description` override, a `fieldDescriptions` override (merged over the defaults), or a full `inputSchema` replacement. For `flyTo`:

```ts
createCesiumTools({
  flyTo: {
    description: "Move the camera to a named place on the globe.",
    fieldDescriptions: {
      altitude: "Height above the ground in metres. Defaults to a wide overview shot.",
    },
  },
});
```

- `description` replaces `DEFAULT_FLY_TO_DESCRIPTION` wholesale.
- `fieldDescriptions` is shallow-merged over `DEFAULT_FLY_TO_FIELD_DESCRIPTIONS` — omit a field to keep its default hint.
- `inputSchema` fully replaces the model-facing schema (takes precedence over `fieldDescriptions`). It only changes what the **model** sees — it does not by itself change what the client validates against (see below).

### Extending the validated args contract from both sides at once

To add fields on top of the stock contract (e.g. this repo's sample app adds `duration`/`easingFunction`) and have the frontend validator agree with it, don't hand-edit two schemas — build one extended shape from `flyToInputShape` and share it between the server config and the client executor, the way `shared/src/flyto-schema.ts` does:

```ts
// shared module, imported by both server and client code
import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

export const flyToShape = z.object({
  ...flyToInputShape.shape,
  duration: z.number().positive().optional(),
});
```

```ts
// server — layer `.describe()` hints on top, then pass the whole schema as `inputSchema`
createCesiumTools({ flyTo: { inputSchema: extendedSchemaWithDescriptions } });
```

```ts
// client
flyToShape.safeParse(rawArgs);
```

Because both sides parse the same `flyToShape` object, they can't silently drift apart the way two hand-kept-in-sync copies could. Use `flyToInputShape` directly (no extension) when the stock contract is enough.

The defaults are exported so a host can extend rather than fully rewrite them:

```ts
import {
  DEFAULT_FLY_TO_DESCRIPTION,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
} from "@cesium-ai/tools-schemas";

createCesiumTools({
  flyTo: {
    description: `${DEFAULT_FLY_TO_DESCRIPTION} Prefer landmarks over city centers when both are named.`,
    fieldDescriptions: { ...DEFAULT_FLY_TO_FIELD_DESCRIPTIONS, altitude: "Custom altitude hint." },
  },
});
```

You can also call `createFlyTo(config)` / `buildFlyToInputSchema(descriptions)` directly if you need a standalone tool object outside of `createCesiumTools` (e.g. to compose a custom registry).

### Changing the validated args contract

The structural shape — which fields exist, their types, and range checks (lat ∈ [-90, 90], lon ∈ [-180, 180], altitude positive) — lives in exactly one place: `flyToInputShape` in `src/tools/flyTo/flyTo.schema.ts`. It carries no model-facing description text on purpose, so the frontend can import it (via `/schemas`) to validate untrusted tool-call args without pulling tool descriptions into the client bundle. The backend's model-facing schema (`buildFlyToInputSchema`) derives its structural rules from this shape and only layers `.describe()` hints on top — so a contract change (e.g. tightening a range) is a single edit here that both tiers pick up automatically.

## File layout

Each tool gets its own folder under `src/tools/<toolName>/`, containing the structural shape (`<toolName>.schema.ts`, no description text) and the tool definition (`<toolName>.ts`, description + `create<ToolName>` factory). Two shared building blocks live in `src/lib/` so adding a tool doesn't mean re-deriving them:

- `mergeDescriptions` (`src/lib/merge-descriptions.ts`) — merges a per-field `.describe()` override object over a tool's defaults.
- `buildDescribedSchema` / `describeShape` (`src/lib/describe-shape.ts`) — merges the descriptions then applies them to a zod object shape, producing the model-facing schema. Every `buildXInputSchema` is just this call with its own shape and defaults plugged in.
- `createClientTool` / `ClientToolConfig` (`src/lib/client-tool.ts`) — the no-`execute` `tool({ description, inputSchema })` wrapper and the `{ description?, fieldDescriptions?, inputSchema? }` config shape every client-side tool accepts.
- `createToolFactory` (`src/lib/client-tool.ts`) — builds a tool's `createX(config)` function from its default description and `buildXInputSchema`. Every `createX` in this package (e.g. `createFlyTo`) is just `createToolFactory(DEFAULT_X_DESCRIPTION, buildXInputSchema)` — no per-tool `??` boilerplate to rewrite.
- `cartographicShape`, `orientationShape`, `pixelOffsetShape`, `materialOutlineShape` (`src/lib/shared-shapes.ts`) — reusable structural zod fragments (position, heading/pitch/roll, screen-space offset, material/outline styling) shared across multiple tools' `.schema.ts` shapes via `.extend()`, so a change to a shared field only needs to happen once.

`src/tool-names.ts` (the name registry) and `src/schemas.ts` (the `/schemas` subpath aggregator) stay flat at the package root — each just grows one line per new tool.

## Exports

| Export                                | From                     | Description                                                                           |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `createCesiumTools`                   | `./index.js`             | Builds the `ToolSet` registry, applying `CesiumToolsConfig`.                          |
| `CesiumToolsConfig`                   | `./index.js`             | Type for `createCesiumTools`'s options (`enabled`, per-tool overrides).               |
| `createFlyTo`                         | `./index.js`             | Builds a standalone `flyTo` tool from a `FlyToConfig`.                                |
| `flyTo`                               | `./index.js`             | Ready-to-use `flyTo` tool with every default applied.                                 |
| `FlyToConfig`                         | `./index.js`             | Type for `createFlyTo`'s options (`description`, `fieldDescriptions`, `inputSchema`). |
| `DEFAULT_FLY_TO_DESCRIPTION`          | `./index.js`             | Default model-facing `flyTo` description string.                                      |
| `DEFAULT_FLY_TO_FIELD_DESCRIPTIONS`   | `./index.js`             | Default per-field `.describe()` hints (`latitude`, `longitude`, `altitude`).          |
| `buildFlyToInputSchema`               | `./index.js`             | Builds the model-facing schema from `flyToInputShape` + field hints.                  |
| `defaultFlyToInputSchema`             | `./index.js`             | `buildFlyToInputSchema()` with every default hint applied.                            |
| `CESIUM_TOOL_NAMES`, `CesiumToolName` | `./index.js`, `/names`   | Canonical tool name constants / union type.                                           |
| `flyToInputShape`, `FlyToInput`       | `./index.js`, `/schemas` | The structural args contract (no descriptions) and its inferred type.                 |
