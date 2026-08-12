# @cesium-ai/tools

Default, ready-to-use **client-side executors** for every tool in `@cesium-ai/tools-schemas`'s `CESIUM_TOOL_NAMES` catalogue (`flyTo`, camera tools, `entityAdd`, animation tools, and imagery tools). Each executor validates the model's tool-call args against the tool's shared structural shape (from `@cesium-ai/tools-schemas/schemas`) and runs the corresponding action against a live CesiumJS `Viewer`.

This package is the missing "other half" of `@cesium-ai/tools-schemas`: that package only ever defines _what a tool call looks like_ (schema + description, model-facing) — it deliberately has no `execute`, since the AI SDK streams every one of these tool calls to the browser to run against the real `Viewer`. This package is the default implementation of that browser-side half, so a host app doesn't have to hand-write an executor for all model-facing tools before it can turn one on.

## Supported tools

### Default model-facing executors

These are the executors included in `DEFAULT_CESIUM_TOOL_EXECUTORS` and keyed by `CESIUM_TOOL_NAMES`:

| Domain    | Tool                         | Default executor             |
| --------- | ---------------------------- | ---------------------------- |
| Camera    | `flyTo`                      | `flyTo`                      |
| Camera    | `cameraSetView`              | `cameraSetView`              |
| Camera    | `cameraLookAtTransform`      | `cameraLookAtTransform`      |
| Camera    | `cameraOrbit`                | `cameraOrbit`                |
| Camera    | `cameraGetPosition`          | `cameraGetPosition`          |
| Camera    | `cameraSetControllerOptions` | `cameraSetControllerOptions` |
| Entity    | `entityAdd`                  | `entityAdd`                  |
| Entity    | `entityList`                 | `entityList`                 |
| Entity    | `entityRemove`               | `entityRemove`               |
| Animation | `animationCreate`            | `animationCreate`            |
| Animation | `animationRemove`            | `animationRemove`            |
| Animation | `animationListActive`        | `animationListActive`        |
| Animation | `animationUpdatePath`        | `animationUpdatePath`        |
| Animation | `animationCameraTracking`    | `animationCameraTracking`    |
| Animation | `clockControl`               | `clockControl`               |
| Animation | `globeSetLighting`           | `globeSetLighting`           |
| Imagery   | `imageryAdd`                 | `imageryAdd`                 |
| Imagery   | `imageryRemove`              | `imageryRemove`              |
| Imagery   | `imageryList`                | `imageryList`                |

## Usage

```ts
import { createCesiumToolExecutors } from "@cesium-ai/tools";

const executors = createCesiumToolExecutors();

// Somewhere in your tool-call dispatcher (see e.g. this repo's ChatPanel.tsx):
const result = await executors.flyTo(viewer, rawArgsFromTheModel);
```

`createCesiumToolExecutors()` with no arguments returns `DEFAULT_CESIUM_TOOL_EXECUTORS` — one function per {@link CESIUM_TOOL_NAMES} entry, covering the entire catalogue with zero configuration.

## Logging

This package has no logging of its own by default — every executor just resolves a plain `{ success, error? }` result, so a caller that never reads `error` never finds out a tool call failed. Pass a `logger` as `createCesiumToolExecutors`'s second argument to have every executor's outcome (success, a resolved `{ error }`, or a thrown rejection) reported through it:

```ts
import { createCesiumToolExecutors, createConsoleToolsLogger } from "@cesium-ai/tools";

const executors = createCesiumToolExecutors({}, createConsoleToolsLogger("warn"));
```

Implement your own `ToolsLogger` (e.g. backed by an OTEL-wired app logger — see this repo's `frontend/src/tools/cesium-tool-executors.ts` for the worked example) to route this package's logging through your own telemetry instead of `console`.

## Customizing a tool: two mechanisms

### 1. Full override — works for every tool

Pass a replacement executor for any tool name; every other tool keeps its default. This always works, for **every** tool in the catalogue, whether or not it also has a dedicated extend-factory (below):

```ts
const executors = createCesiumToolExecutors({
  flyTo: myCustomFlyTo,
  entityAdd: myCustomEntityAdd,
  globeSetLighting: myCustomGlobeSetLighting,
});
```

You never need to fork or wrap the other defaults to do this — `createCesiumToolExecutors` is just `{ ...DEFAULT_CESIUM_TOOL_EXECUTORS, ...overrides }`.

### 2. Extend via a `createXExecutor` factory — available for `flyTo`, `cameraSetView`, and every `entityAdd*` tool

A handful of tools share one shape: validate args, then make **one** Cesium API call with an options object built from those args. For these, a `createXExecutor(config)` factory lets you extend the accepted shape and add extra native options **without re-deriving the validation/conversion/error-handling plumbing** the default already has:

| Tool                    | Factory                       | What `config` can extend                                                                                   |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `flyTo`                 | `createFlyToExecutor`         | `shape`, `buildFlyToOptions` (extra `Camera.flyTo` options)                                                |
| `cameraSetView`         | `createCameraSetViewExecutor` | `shape`, `buildSetViewOptions` (extra `Camera.setView` options)                                            |
| every `entityAdd*` tool | `createEntityAddXExecutor`    | `shape`, `extendEntityOptions` (extra top-level `Entity.ConstructorOptions` fields — see the caveat below) |

`entityAdd` itself is additive and dispatches to those same `entityAdd*` executors by `type`, so hosts can choose one consolidated tool name without losing the existing per-type contracts.

Every other tool (`cameraLookAtTransform`, `cameraOrbit`, `cameraGetPosition`, `cameraSetControllerOptions`, `entityList`/`entityRemove`, every `animation*` tool, `clockControl`, `globeSetLighting`, `imageryAdd`/`Remove`/`List`) has **no** dedicated factory — either it has no natural "options object" to extend (`cameraLookAtTransform` takes two positional args; `entityList`/`entityRemove` have almost no input at all), or it does multi-step/registry-backed work that a single merged-options object can't capture (`animationCreate`, `imageryAdd`). Full override (above) is the way to customize these.

#### Worked example: extending `flyTo` with extra fields

This package's default `flyTo` executor only validates the **base** `flyToInputShape` (latitude/longitude/altitude) — it has no `duration` or `easingFunction`. Rather than hand-writing a whole new executor, extend it with `createFlyToExecutor`: it reuses all of the validation/`Cartesian3`-conversion/promise/error-handling plumbing and only lets you change the accepted shape and the extra `Camera.flyTo` options derived from it.

```ts
// shared module, imported by both the server tool config and this client executor —
// see shared/src/tools/flyto-schema.ts in this repo for the real version.
import { z } from "zod";
import { flyToInputShape } from "@cesium-ai/tools-schemas/schemas";

export const flyToShape = z.object({
  ...flyToInputShape.shape,
  duration: z.number().positive().optional(),
  easingFunction: z.enum(EASING_FUNCTION_NAMES).optional(),
});
export type FlyToShapeInput = z.infer<typeof flyToShape>;
```

```ts
// your own client-side executor — see frontend/src/tools/camera.ts's `flyToLocation`
// in this repo for the full real version, including EasingFunction resolution.
import { createFlyToExecutor } from "@cesium-ai/tools";

export const flyToLocation = createFlyToExecutor<FlyToShapeInput>({
  shape: flyToShape,
  buildFlyToOptions: ({ duration, easingFunction }) => ({
    duration,
    easingFunction: easingFunction ? EasingFunction[easingFunction] : undefined,
  }),
});
```

```ts
// wire it in — every other tool still uses this package's default:
const executors = createCesiumToolExecutors({
  flyTo: flyToLocation,
});
```

`createFlyToExecutor`'s generic type parameter is the validated args type (defaulting to the base `FlyToInput`) — pass your extended type explicitly (as above) so `buildFlyToOptions` gets the extra fields typed, rather than relying on inference from `shape` alone. `shape`'s inferred type just needs to include every base `FlyToInput` field, which any shape built by spreading `flyToInputShape.shape` (or `.extend(...)`) already does. `createCameraSetViewExecutor` follows the exact same shape (`shape`/`buildSetViewOptions`), and every `createEntityAddXExecutor` follows it too (`shape`/`extendEntityOptions`, see below) — same generic-type-parameter convention throughout.

#### Worked example: extending an `entityAdd*` tool

`entityAdd` is the only model-facing entity tool (`CESIUM_TOOL_NAMES.entityAdd`) — its `type` field dispatches internally to one of the 12 `entityAdd*` executors below by name. Each still has its own `createXExecutor` (`shape`, `extendEntityOptions`), so you can extend one variant's behavior without forking `entityAdd` itself:

```ts
import { z } from "zod";
import { entityAddPointInputShape } from "@cesium-ai/tools-schemas/schemas";
import { createEntityAddPointExecutor } from "@cesium-ai/tools";

const extendedShape = z.object({ ...entityAddPointInputShape.shape, tag: z.string().optional() });

const entityAddPointWithTag = createEntityAddPointExecutor({
  shape: extendedShape,
  extendEntityOptions: (data) => ({ properties: { tag: data.tag } }),
});
```

**Caveat**: `extendEntityOptions`'s merge is shallow at the `Entity` level — it can add new top-level fields, but can't reach _into_ the tool's own nested graphics object (e.g. add a field to the already-built `point`/`polygon`/`label`/... sub-object) without replacing it entirely. If you need that, do a full override instead (mechanism 1).

### Extending `imageryAdd`'s provider support

`imageryAdd`'s default executor doesn't implement `GoogleEarthEnterpriseImageryProvider` (its construction flow — fetch metadata, then build the provider from it — doesn't fit the other providers' one-step shape). Its provider-building logic is exported separately so you can add to it without reimplementing `imageryAdd` itself:

```ts
import { IMAGERY_PROVIDER_FACTORIES, imageryAdd } from "@cesium-ai/tools";

IMAGERY_PROVIDER_FACTORIES.GoogleEarthEnterpriseImageryProvider = async (args) => {
  const metadata = await GoogleEarthEnterpriseMetadata.fromUrl(args.url);
  return new GoogleEarthEnterpriseImageryProvider({ metadata });
};

// `imageryAdd` picks up the change immediately — no override needed for it.
```

## Security

Same principle as `@cesium-ai/tools-schemas`: a tool call's arguments are **attacker-influenceable input** — the model produces them, and they stream from server to browser unauthenticated over the chat connection before reaching the live `Viewer`. Every executor in this package validates `rawArgs` against the tool's shared zod shape _before_ touching Cesium with it, and resolves `{ success: false, error }` (never throws) on invalid input. If you replace an executor, keep this same validate-then-execute shape.

## Known limitations / extension points

A few tools' defaults are intentionally simple starting points rather than exhaustive implementations — each is called out in its own JSDoc comment, summarized here:

| Tool                      | Limitation                                                                                                                                 | Extension point                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `cameraOrbit`             | Cesium has no built-in continuous orbit API; the default `action: "start"` is a simple `camera.rotateRight` nudge per `clock.onTick`.      | Override `cameraOrbit`.                                                    |
| `animationCreate`         | `modelPreset` (a named preset like `"car"`) isn't resolved to a real asset URI; `clampToGround` and `loopMode: "pingpong"` aren't applied. | Pass `modelUri` directly, or override `animationCreate`.                   |
| `animationCameraTracking` | `range`/`pitch`/`heading` aren't applied — only `trackedEntity` is toggled.                                                                | Override `animationCameraTracking` for a custom chase-cam offset.          |
| `imageryAdd`              | `GoogleEarthEnterpriseImageryProvider` isn't implemented.                                                                                  | Add an entry to the exported `IMAGERY_PROVIDER_FACTORIES` map (see above). |

## File layout

Executors are grouped by domain rather than one file per tool (unlike `@cesium-ai/tools-schemas`) — `src/tools/camera.ts`, `entities.ts`, `animation.ts`, `imagery.ts` — since there's no per-tool description/schema pair to keep isolated here, just a plain function per tool. Each function is still exported individually by name, so overriding or reading one doesn't require importing the whole registry.

- `src/types.ts` — `ToolExecutor`, `ToolExecutionResult`, `CesiumToolExecutors`, `CesiumToolExecutorOverrides`.
- `src/utils/validate.ts` — `parseArgs`, the shared "validate against a zod shape, never throw" helper every executor calls first.
- `src/utils/result.ts` — `ok`/`fail` result-builder helpers.
- `src/utils/cesium-values.ts` — small conversions from schema-shaped plain data (a `{longitude, latitude, height?}` position, a CSS color string) into real Cesium types (`Cartesian3`, `Color`, ...).
- `src/utils/animation-registry.ts`, `src/utils/imagery-registry.ts` — per-`Viewer` `WeakMap`-based bookkeeping the animation and imagery tools need (which entity ids/imagery layers this package itself created), so `animationListActive`/`imageryList`/etc. only ever report on state they created.
- `src/utils/create-entity-add-executor.ts` — `createEntityAddExecutor`, the generic validate/build/add/error-handling plumbing every `entityAdd*` tool's own `createXExecutor` (in `entities.ts`) is built from.
- `src/logger.ts` — `ToolsLogger`, `noopToolsLogger`, `createConsoleToolsLogger` — see "Logging" above.
- `src/index.ts` — `DEFAULT_CESIUM_TOOL_EXECUTORS`, `createCesiumToolExecutors`.

## Exports

| Export                                                                  | Description                                                                                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCesiumToolExecutors`                                             | Builds a `CesiumToolExecutors` registry, applying per-tool overrides over the defaults. Optional second `logger` argument reports every executor's outcome \u2014 see "Logging" above.        |
| `DEFAULT_CESIUM_TOOL_EXECUTORS`                                         | The full default registry, one executor per `CesiumToolName`.                                                                                                    |
| `ToolExecutor`                                                          | Type: `(viewer, rawArgs) => Promise<ToolExecutionResult>`.                                                                                                       |
| `ToolExecutionResult`                                                   | Type: `{ success: boolean; error?: string; [key: string]: unknown }`.                                                                                            |
| `CesiumToolExecutors`                                                   | Type: `Record<CesiumToolName, ToolExecutor>`.                                                                                                                    |
| `CesiumToolExecutorOverrides`                                           | Type: `Partial<CesiumToolExecutors>`.                                                                                                                            |
| `IMAGERY_PROVIDER_FACTORIES`                                            | Per-`imageryAdd.type` provider-construction map — extend to add a provider type.                                                                                 |
| `createFlyToExecutor`                                                   | Builds a `flyTo` executor from an (optionally extended) shape + extra `Camera.flyTo` options — see "Extending flyTo" above.                                      |
| `FlyToExecutorConfig`                                                   | Type: `createFlyToExecutor`'s config (`shape`, `buildFlyToOptions`).                                                                                             |
| `FlyToCameraOptions`                                                    | Type: the `Camera.flyTo` options `buildFlyToOptions` may return.                                                                                                 |
| `createCameraSetViewExecutor`                                           | Builds a `cameraSetView` executor from an (optionally extended) shape + extra `Camera.setView` options.                                                          |
| `CameraSetViewExecutorConfig`                                           | Type: `createCameraSetViewExecutor`'s config (`shape`, `buildSetViewOptions`).                                                                                   |
| `CameraSetViewOptions`                                                  | Type: the `Camera.setView` options `buildSetViewOptions` may return.                                                                                             |
| `createEntityAddPointExecutor`, `createEntityAddBillboardExecutor`, ... | Every `entityAdd*` tool's factory (`shape`, `extendEntityOptions`) — see "Extending an entityAdd* tool" above.                                                   |
| `createEntityAddExecutor`                                               | The lower-level generic every `createEntityAddXExecutor` above is built from — only needed if you're building a brand-new `entityAdd*`-shaped tool from scratch. |
| `EntityAddExecutorConfig`                                               | Type: an `entityAdd*` factory's config (`shape`, `extendEntityOptions`).                                                                                         |
| `flyTo`, `cameraSetView`, ...                                           | Every individual default executor, exported by name (one per tool).                                                                                              |
| `ToolsLogger`                                                           | Type: the console-shaped logger interface (`debug`/`info`/`warn`/`error`) `createCesiumToolExecutors`'s `logger` argument accepts. See "Logging" above.          |
| `ToolsLogLevel`                                                         | Type: `"debug" \| "info" \| "warn" \| "error" \| "silent"`, accepted by `createConsoleToolsLogger`.                                                              |
| `createConsoleToolsLogger`                                              | Builds a `console`-backed `ToolsLogger`, prefixed `[cesium-tools]`, filtered by level (default `"warn"`).                                                        |
| `noopToolsLogger`                                                       | A `ToolsLogger` whose methods are all no-ops — pass explicitly if you want `createCesiumToolExecutors`'s wrapping without any actual output.                     |
