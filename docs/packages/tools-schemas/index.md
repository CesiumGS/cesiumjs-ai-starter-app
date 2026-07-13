# @cesium-ai/tools-schemas

Zod-schemed CesiumJS viewer tool definitions for the AI SDK. Ships a catalogue of 34
ready-made tools covering camera control, entity management, animation, imagery, and more.
These are **schemas only** — no tool defines `execute`. The AI SDK streams a tool call to
the browser, which runs it against the live `Viewer` and posts the result back to the agent
loop (see [`@cesium-ai/server`](../server/index.md)).

See the [Tool Catalogue](tools.md) for the full list of available tools, and the
[Cesium Viewer Tools Tutorial](../../tutorials/cesium-viewer-tools-tutorial.md) for a step-by-step
guide to enabling them in the starter app.

## Entry points

The package splits into three subpaths so tool _descriptions_ (LLM-facing text) never
leak into the client bundle:

| Subpath                            | Exports                                | Who imports it                                   |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------ |
| `@cesium-ai/tools-schemas`         | Full definitions incl. descriptions    | **Backend only.** Never import from client code. |
| `@cesium-ai/tools-schemas/names`   | `CESIUM_TOOL_NAMES`, `CesiumToolName`  | Both sides. String constants only.               |
| `@cesium-ai/tools-schemas/schemas` | `<toolName>InputShape`, inferred types | Both sides. Structural shapes, no descriptions.  |

## Basic usage

```ts
import { createCesiumTools } from "@cesium-ai/tools-schemas";
import { createChatRouter } from "@cesium-ai/server";

createChatRouter({
  model,
  tools: createCesiumTools(),
});
```

## Enabling a subset of tools

Pass `enabled` to register only a chosen allowlist. Omit it to include every tool.

```ts
createCesiumTools({ enabled: ["flyTo", "entityAddPoint"] });
```

Drop a specific tool with `false`:

```ts
createCesiumTools({ flyTo: false });
```

## Overriding descriptions

Every per-tool config accepts a `description` override, a `fieldDescriptions` override
(merged over defaults), or a full `inputSchema` replacement:

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

The package exports its defaults so a host can extend rather than replace them:

```ts
import {
  DEFAULT_FLY_TO_DESCRIPTION,
  DEFAULT_FLY_TO_FIELD_DESCRIPTIONS,
} from "@cesium-ai/tools-schemas";

createCesiumTools({
  flyTo: {
    description: `${DEFAULT_FLY_TO_DESCRIPTION} Prefer landmarks over city centres.`,
    fieldDescriptions: { ...DEFAULT_FLY_TO_FIELD_DESCRIPTIONS, altitude: "Custom hint." },
  },
});
```

## Extending the args contract

To add fields on top of a stock schema (e.g. adding `duration`/`easingFunction` to `flyTo`)
and keep both sides in sync, build one extended shape and share it between server and client
instead of maintaining two separate copies:

```ts
// shared module — imported by both sides
import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

export const flyToShape = z.object({
  ...flyToInputShape.shape,
  duration: z.number().positive().optional(),
});
```

```ts
// server — layer .describe() hints on top
createCesiumTools({ flyTo: { inputSchema: extendedSchemaWithDescriptions } });

// client — validate the untrusted tool-call payload
flyToShape.safeParse(rawArgs);
```

## Security

Tool-call arguments are **attacker-influenceable input**: the model produces them, they
stream from server to browser, and the client passes them to the live `Viewer`. Two
protections follow:

- **Validate before executing.** The client must re-validate every tool call against its
  `<toolName>InputShape` (from `/schemas`) before acting on it. Never trust that a value
  the server accepted is safe to feed to Cesium's APIs unchecked.
- **Keep descriptions server-side.** The root entry point carries the `.describe()` text
  the LLM reads. That text must never ship in the client bundle — import only `/schemas`
  or `/names` from frontend code.

## API reference

| Export                                    | Subpath          | Description                                                     |
| ----------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `createCesiumTools(config?)`              | root             | Builds the `ToolSet` registry with optional `enabled` allowlist |
| `CesiumToolsConfig`                       | root             | Options type for `createCesiumTools`                            |
| `CESIUM_TOOL_NAMES`, `CesiumToolName`     | root, `/names`   | Canonical tool name constants and union type                    |
| `<toolName>InputShape`, `<ToolName>Input` | root, `/schemas` | Structural args shape (no descriptions) and inferred type       |
| `DEFAULT_<TOOL>_DESCRIPTION`              | root             | Default model-facing description string for each tool           |
| `DEFAULT_<TOOL>_FIELD_DESCRIPTIONS`       | root             | Default per-field `.describe()` hints for each tool             |
| `build<ToolName>InputSchema(descs?)`      | root             | Builds the model-facing schema from the shape + field hints     |
| `create<ToolName>(config?)`               | root             | Builds a standalone tool instance from a per-tool config        |

## File layout

Each tool gets its own folder under `src/tools/<toolName>/`:

- `<toolName>.schema.ts` — structural shape, no description text; exported via `/schemas`
- `<toolName>.ts` — description text + `create<ToolName>` factory; backend only

Shared building blocks in `src/lib/`:

- `createToolFactory` — builds a `create<ToolName>(config)` function; every `create*` in
  this package is just this called with defaults plugged in
- `buildDescribedSchema` / `describeShape` — merges field descriptions onto a Zod shape
- `mergeDescriptions` — merges a per-field override object over defaults
- `createClientTool` — the no-`execute` `tool({ description, inputSchema })` wrapper
