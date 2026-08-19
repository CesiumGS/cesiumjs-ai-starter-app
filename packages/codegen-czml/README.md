# @cesium-ai/codegen-czml

Intent-to-verified-CZML generation pipeline, plus the `generateCzml` tool definition. CZML is declarative data, not code — generation is grounded by an inlined CZML reference ([`czml-reference.ts`](./src/pipeline/czml-reference.ts)) and structured via the AI SDK's `generateObject`, and verification runs the result through Cesium's own `CzmlDataSource` parser (parse-only — this package never constructs a `Viewer` or renders anything).

## Architecture

```mermaid
%%{init: {"themeVariables": {"fontSize": "18px"}, "flowchart": {"nodeSpacing": 45, "rankSpacing": 65, "padding": 12}}}%%
graph TD
    A["🧑 User Intent"] -->|input| C["Prompt Building<br/>buildCzmlPrompt"]
    C -->|grounded prompt| D["Model Generation<br/>generateObject (caller-supplied model)"]
    D -->|"{ czml, description }"| E["Verification<br/>verifyCzml (zod + CzmlDataSource.load)"]
    E -->|violations?| E_retry["Retry (up to 3 attempts)"]
    E_retry -->|feedback| D
    E -->|verified| F["✅ GATE 1: Structural + semantic verification<br/>No rendering"]
    F --> BOUNDARY["@cesium-ai/codegen-czml boundary<br/>Nothing above touches a live Viewer"]
    BOUNDARY --> G["Backend Tool Execution"]
    G -->|stream to browser| H["🌐 GATE 2: Frontend CzmlDataSource load"]
    H --> I["Output: entities added to the Viewer"]
    E -->|fails| REJECT["❌ Return violations"]

    style F fill:#20B2AA,stroke:#008B8B,color:#fff
    style H fill:#9370DB,stroke:#6A0DAD,color:#fff
    style BOUNDARY fill:#E6E6FA,stroke:#9370DB,stroke-dasharray: 5 5
    style E_retry fill:#FFA500,stroke:#FF8C00,color:#000
    style REJECT fill:#FF6B6B,stroke:#CC0000,color:#fff
```

Unlike `@cesium-ai/codegen-cesium`'s `executeCesiumCode` (arbitrary JavaScript, needing AST verification and a runtime sandbox), CZML is declarative data Cesium already knows how to parse safely — so GATE 1 doubles as both the structural check and the real semantic parse (via `CzmlDataSource`, headless, no `Viewer` needed), and GATE 2 is just loading the already-verified document into the live `Viewer`.

## Supported dynamic behaviors

Grounded by [`czml-reference.ts`](./src/pipeline/czml-reference.ts), which is inlined into every generation prompt:

| Dynamic behavior              | CZML mechanism                                                        | Example use case                                                    |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Time-varying position         | `position` with `epoch` + sampled `cartographicDegrees` offsets       | Satellite orbit, moving vehicle/aircraft                            |
| Motion trail                  | `path` (`resolution`, `leadTime`, `trailTime`, `material`, `width`)   | Ground track drawn behind a moving satellite                        |
| Scheduled appear/disappear    | `availability` (ISO8601 interval)                                     | Entity only exists during part of the scene's clock                 |
| Global timeline & playback    | document `clock` (`interval`, `currentTime`, `multiplier`, `range`)   | Populates the Cesium timeline widget; loop/clamp/unbounded playback |
| Static multi-point geometry   | `polyline` with a fixed `positions` array (not time-sampled)          | Fixed flight path or route line                                     |
| Point/billboard/label styling | `point`, `billboard`, `label` (`color`, `pixelSize`, `scale`, `show`) | Markers and text that ride along a dynamic position                 |

Anything outside this set (e.g. custom materials, sensor cones, 3D models, CZML interpolation/extrapolation tuning) is not covered by the current reference and generation will fall back to whatever the model infers, which is not guaranteed to pass verification.

## Entry points

| Subpath                           | Exports                                                           | Consumer     |
| --------------------------------- | ----------------------------------------------------------------- | ------------ |
| `@cesium-ai/codegen-czml`         | Full pipeline + `generateCzml` tool with model-facing description | Backend only |
| `@cesium-ai/codegen-czml/names`   | `CODEGEN_CZML_TOOL_NAMES`, `CodegenCzmlToolName`                  | Both         |
| `@cesium-ai/codegen-czml/schemas` | `generateCzmlInputShape`, `GenerateCzmlInput`                     | Both         |

Never import the root from client code — it pulls in `ai` and model-facing descriptions.

## Usage

```ts
import { generateVerifiedCzml } from "@cesium-ai/codegen-czml";

const result = await generateVerifiedCzml({
  intent: "animate a satellite orbit over Europe for 24 hours",
  model,
});

if (result.verified) {
  // result.czml, result.description, result.entityCount
}
```

A host application wraps this in its own executable AI SDK tool (see this repo's sample app's `backend/src/tools/generate-czml-tool.ts`), merging it into the tool registry alongside `@cesium-ai/tools-schemas`'s viewer tools.

## Security

- **GATE 1 — Verification (this package):** `verifyCzml` caps document size/packet count, structurally validates via zod (document packet first, unique ids), then parses the document with Cesium's own `CzmlDataSource.load` — catching anything Cesium itself would reject before it ever reaches the client. This never constructs a `Viewer` or renders anything.
- **GATE 2 — Frontend load:** The host application loads the already-verified CZML into the live `Viewer` via `CzmlDataSource` and reports the real entity count/any load error back to the agent loop.
- Verified CZML is still attacker-influenceable model output until the frontend actually loads it — treat a `{ czml }` result as "passed verification", not "is on the globe", exactly like `executeCesiumCode`'s `{ code }` result.
