# Tutorial: Using the CZML Generation Tool

<img src="https://raw.githubusercontent.com/CesiumGS/cesiumjs-ai-starter-app/main/docs/assets/ty-book.png" alt="Ty mascot with book" align="right" width="200" class="doc-illustration" />

This tutorial covers the `generateCzml` tool provided by the [`@cesium-ai/codegen-czml`](../packages/codegen-czml/index.md) package. The tool lets users describe a time-dynamic scene in plain English — an orbiting satellite, a moving vehicle, a scheduled appear/disappear — and turns that description into a verified [CZML](https://github.com/CesiumGS/cesium/wiki/CZML-Guide) document, which the browser then loads into the live `Viewer` via `CzmlDataSource`.

Unlike [`executeCesiumCode`](codegen-tool-tutorial.md), `generateCzml` never generates or executes code: CZML is declarative JSON data, so the pipeline only has to verify the _data_, not sandbox arbitrary JavaScript.

---

## What is CZML?

[CZML](https://github.com/CesiumGS/cesium/wiki/CZML-Guide) is a JSON-based document format for describing time-dynamic graphics scenes in CesiumJS. A CZML document is a list of packets, each describing one entity (a point, billboard, model, satellite, path, ...) along with properties — position, orientation, color, availability — that can be constant or vary over time via time-tagged samples. Cesium's `CzmlDataSource` parses this data and renders it on the `Viewer`, interpolating between samples as the clock advances.

Typical workflows this tool covers:

- **Orbits and trajectories** — a satellite, aircraft, or vehicle following a time-sampled path, optionally with a trailing ground track.
- **Scheduled scenes** — entities that only appear/disappear during part of a mission timeline, driven by the document's `clock` and each entity's `availability`.
- **Styled markers and annotations** — points, billboards, and labels placed on the globe, static or riding along a moving position.
- **Static geometry** — fixed polylines, polygons, and other shapes that don't need to be time-dynamic at all.

Anything that isn't inherently time-dynamic (a single static marker, for example) can usually also be done with the viewer's `entityAdd` tool — `generateCzml` is worth reaching for specifically when the scene needs to _change over time_.

---

## 1. How it works end to end

Type a natural-language, time-dynamic intent in the chat panel — for example, _"animate a satellite orbiting Earth every 90 minutes"_ or _"show a marker that only appears for the next hour"_. Here is what happens:

1. The chat panel sends the message to `/api/chat`.
2. The model decides to call `generateCzml` and fills in the `intent` field with your request.
3. **Before the backend runs**, the browser shows an approval prompt — the raw intent is displayed so you can confirm or reject it.
4. On approval, the backend runs the generation pipeline (prompt building, grounded by an inlined CZML reference and per-intent skill matching → LLM generation via `generateObject` → structural/schema/semantic verification → optional retry).
5. The verified CZML document is streamed back to the browser, which loads it via a real `CzmlDataSource` and reports the resulting entity count (or any load error) back to the agent loop.

For the pipeline's internal architecture, see [`@cesium-ai/codegen-czml`'s README](../packages/codegen-czml/index.md#architecture).

---

## 2. Enabling the tool

`generateCzml` is enabled by default in this starter app, alongside every viewer tool, via `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/shared/src/enabled-tools.ts):

```ts
// shared/src/enabled-tools.ts
import { CODEGEN_CZML_TOOL_NAMES } from "@cesium-ai/codegen-czml/names";

export const ENABLED_CESIUM_TOOLS = [
  ...(Object.values(CESIUM_TOOL_NAMES) as CesiumToolName[]),
  CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode,
  CODEGEN_CZML_TOOL_NAMES.generateCzml, // ← enabled here
] as const;
```

The backend also requires a model to be configured — at least one of `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` must be set. If no model is available,
`generateCzml` is silently omitted from the registry even if listed in `ENABLED_CESIUM_TOOLS`.

To disable the tool, remove its name from the array. The backend immediately stops registering it
and the frontend gate rejects any stale call.

---

## 3. Human-in-the-loop approval

`generateCzml` runs with `toolApproval: "user-approval"`, the same human-in-the-loop gate as
`executeCesiumCode`. Before the backend generates any CZML, the browser shows the raw `intent`
string and waits for an explicit click — even though the result is verified declarative data
rather than code, it's still model-authored content the user hasn't seen yet before it's loaded
into the live `Viewer`.

The approval check is wired in [`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts):

```ts
// backend/src/app.ts (simplified)
resolveToolApproval: (resolvedTools) => ({
  [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval",
  [CODEGEN_CZML_TOOL_NAMES.generateCzml]: "user-approval",
  // ...
}),
```

If the user rejects, the agent loop receives a rejection result and no CZML is generated or loaded.

---

## 4. Configuration options

### Environment variables

These are validated through [Zod](https://zod.dev) in [`backend/src/utils/env.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/env.ts) and read at startup.

| Variable                          | Default   | Description                                                                                                        |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `CODEGEN_CZML_MAX_ATTEMPTS`       | `3`       | How many times to retry generation if verification fails. Each retry feeds the violation list back to the model.   |
| `CODEGEN_CZML_MAX_PACKETS`        | `200`     | Maximum packet count allowed by verification (`verifyCzml` `maxPackets`).                                          |
| `CODEGEN_CZML_MAX_LENGTH`         | `20000`   | Maximum serialized CZML size in characters allowed by verification (`verifyCzml` `maxLength`).                     |
| `CODEGEN_CZML_EXTRA_INSTRUCTIONS` | _(unset)_ | Optional operator-supplied instructions appended to the generation prompt (for app-specific constraints or style). |

Set them in your `.env` file:

```bash
CODEGEN_CZML_MAX_ATTEMPTS=5
CODEGEN_CZML_MAX_PACKETS=400
CODEGEN_CZML_MAX_LENGTH=40000
CODEGEN_CZML_EXTRA_INSTRUCTIONS=Prefer short entity ids and avoid unnecessary description HTML.
```

### Programmatic options

`createGenerateCzmlTool` (used in [`backend/src/tools/generate-czml-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/generate-czml-tool.ts)) accepts the same options
programmatically, letting you override env defaults without changing environment configuration:

```ts
// backend/src/tools/generate-czml-tool.ts
const generateCzmlTool = createGenerateCzmlTool({
  model,
  maxAttempts: 5, // override CODEGEN_CZML_MAX_ATTEMPTS
  maxPackets: 400, // override CODEGEN_CZML_MAX_PACKETS
  maxLength: 40000, // override CODEGEN_CZML_MAX_LENGTH
  extraInstructions: "Prefer short entity ids and avoid unnecessary description HTML.",
});
```

The function signature for the underlying pipeline entry point is:

```ts
generateVerifiedCzml({
  intent: string, // natural-language description of the time-dynamic scene
  model: LanguageModel, // AI SDK LanguageModel — caller supplies this
  maxAttempts?: number, // default 3
  maxPackets?: number, // default 200
  maxLength?: number, // default 20000
  extraInstructions?: string, // default unset
}): Promise<
  | { verified: true; czml: Record<string, unknown>[]; description: string; entityCount: number }
  | { verified: false; error: string }
>
```

---

## 5. What CZML documents can express

Grounded by an inlined CZML reference plus per-intent, BM25-matched feature skills, the pipeline supports:

| Dynamic behavior              | CZML mechanism                                                        | Example use case                                                    |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Time-varying position         | `position` with `epoch` + sampled `cartographicDegrees` offsets       | Satellite orbit, moving vehicle/aircraft                            |
| Motion trail                  | `path` (`resolution`, `leadTime`, `trailTime`, `material`, `width`)   | Ground track drawn behind a moving satellite                        |
| Scheduled appear/disappear    | `availability` (ISO8601 interval)                                     | Entity only exists during part of the scene's clock                 |
| Global timeline & playback    | document `clock` (`interval`, `currentTime`, `multiplier`, `range`)   | Populates the Cesium timeline widget; loop/clamp/unbounded playback |
| Static multi-point geometry   | `polyline` with a fixed `positions` array (not time-sampled)          | Fixed flight path or route line                                     |
| Point/billboard/label styling | `point`, `billboard`, `label` (`color`, `pixelSize`, `scale`, `show`) | Markers and text that ride along a dynamic position                 |

Billboard/label, polygon, polyline, orientation, clock/viewFrom, box, cylinder, corridor, ellipse,
ellipsoid, rectangle, wall, 3D models, 3D Tiles, custom/reference properties, and more are covered
by per-intent feature skills — see [`@cesium-ai/codegen-czml`'s README](../packages/codegen-czml/index.md#supported-dynamic-behaviors)
for the full list. Anything with no matching skill still falls back to whatever the model infers,
which is not guaranteed to pass verification.

---

## 6. Verification gates

Verification (`verifyCzml` in [`packages/codegen-czml/src/pipeline/czml-verifier.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-czml/src/pipeline/czml-verifier.ts)) runs four stages in order, never rendering anything:

1. **Size cap** — rejects documents over `maxLength` serialized characters before any parsing.
2. **Structural validation** ([Zod](https://zod.dev)) — the first packet must be the document packet, and every other packet must have a unique `id`.
3. **Official schema validation** ([ajv](https://ajv.js.org) against the vendored [czml-writer](https://github.com/CesiumGS/cesium/wiki/CZML-Guide) JSON Schema) — checks each packet's property shapes and gives the model precise per-property feedback on retry.
4. **Semantic parse** — the document is handed to Cesium's own `CzmlDataSource.load`, the same code path the browser uses to load it, catching anything Cesium itself would reject (malformed epochs, mismatched sample-array lengths, unknown property shapes, ...).

Verification does **not** check that referenced image/model/tileset URLs are safe, or that a
packet's `description` HTML is benign — see the package README's
[Security](../packages/codegen-czml/index.md#security) section for what's out of scope.

---

## 7. How results flow back to the browser

The tool's `execute` handler in [`backend/src/tools/generate-czml-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/generate-czml-tool.ts) returns either:

```ts
{
  czml: (Record < string, unknown > []);
  description: string;
} // generation succeeded and passed verification
{
  error: string;
} // generation failed or all retries were exhausted
```

The browser receives this as a tool result in the SSE stream. The starter app validates the result
shape and then loads the verified `czml` into the live `Viewer` via `CzmlDataSource`, reporting the
real entity count (or a load error) back to the agent loop in a follow-up request — the model's
first reply is suppressed until that real outcome is known (see `backend/src/app.ts`'s
`stopAfterTools`).

---

## 8. Quick reference

| I want to…                                | Where to look                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Enable the tool                           | `shared/src/enabled-tools.ts` — enabled by default via `CODEGEN_CZML_TOOL_NAMES.generateCzml` |
| Disable the tool                          | Same file — remove the name                                                                   |
| Change how many retries are allowed       | `CODEGEN_CZML_MAX_ATTEMPTS` env var or `maxAttempts` in `createGenerateCzmlTool`              |
| Change max packet count                   | `CODEGEN_CZML_MAX_PACKETS` env var or `maxPackets` in `createGenerateCzmlTool`                |
| Change max generated CZML size            | `CODEGEN_CZML_MAX_LENGTH` env var or `maxLength` in `createGenerateCzmlTool`                  |
| Append operator prompt rules              | `CODEGEN_CZML_EXTRA_INSTRUCTIONS` env var or `extraInstructions` in `createGenerateCzmlTool`  |
| See which dynamic behaviors are supported | [Section 5](#5-what-czml-documents-can-express) above                                         |
| Review the verification stages            | [Section 6](#6-verification-gates) above                                                      |
| Review the security threat model          | [`@cesium-ai/codegen-czml`'s README — Security](../packages/codegen-czml/index.md#security)   |
| Compare with the code-generation tool     | [Codegen Tool Tutorial](codegen-tool-tutorial.md)                                             |
