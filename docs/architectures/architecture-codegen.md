# Codegen Architecture

This document describes the architecture of the `executeCesiumCode` code generation system:
where it lives in the overall component model, how its internal pieces fit together, and which
security gates are in place. For the threat model and recommended mitigations, see the
[Security Considerations](Codegen-tool-security-attacks-vectors.md) document.

---

## 1. Where codegen fits in the system

The codegen system is an additional path through the existing backend. A normal tool call
(e.g., `flyTo`) goes: browser → backend → model → tool call → browser executor. The codegen
path adds a server-side generation sub-system that runs before any code reaches the browser.

```mermaid
flowchart LR
    subgraph Browser
        UI["Chat Panel"]
        Viewer["CesiumJS Viewer"]
    end

    subgraph Backend["Backend Server"]
        API["/api/chat<br/>(rate limiter)"]
        Agent["Agent loop<br/>(streamText)"]

        subgraph Codegen["@cesium-ai/codegen-cesium"]
            DM["Domain matching"]
            PB["Prompt builder"]
            GEN["LLM generation"]
            VER["AST verifier<br/>(Gate 1)"]
        end
    end

    subgraph External
        LLM["LLM provider"]
        Skills["@cesium/cesiumjs-skills"]
    end

    UI -- "intent (approved)" --> API
    API --> Agent
    Agent --> DM
    Skills -.->|SKILL.md cache| DM
    DM --> PB
    PB --> GEN
    GEN <-->|prompt / completion| LLM
    GEN --> VER
    VER -- "verified code" --> Agent
    Agent -- "SSE" --> UI
    UI --> Viewer
```

The `@cesium-ai/codegen-cesium` package is a pure server-side dependency — it is never
bundled into the client.

### Request lifecycle

```mermaid
sequenceDiagram
    actor User
    participant UI as Chat Panel (React)
    participant Viewer as CesiumJS Viewer
    participant API as Backend API
    participant Codegen as Codegen Pipeline
    participant LLM as LLM Provider

    User->>UI: natural-language intent
    UI->>API: POST /api/chat
    API-->>UI: tool call: executeCesiumCode(intent)
    UI-->>User: approval prompt — show intent
    User->>UI: approve
    UI-->>API: tool result (approved)
    API->>Codegen: generateVerifiedCesiumCode(intent)
    Codegen->>LLM: buildCodegenPrompt + skills context
    LLM-->>Codegen: candidate JavaScript
    Codegen->>Codegen: verifyCesiumCode (AST)
    alt verified
        Codegen-->>API: verified true, code string
        API-->>UI: SSE: code string
        UI->>Viewer: execute code against viewer
        Viewer-->>UI: render updated
    else verification failed after retries
        Codegen-->>API: verified false, error
        API-->>UI: SSE: error message
    end
    UI-->>User: confirmation or error
```

---

## 2. Package structure

```
packages/codegen-cesium/
├── src/
│   ├── index.ts                    # Public entry point (backend only)
│   ├── tool-names.ts               # { executeCesiumCode }
│   ├── schemas.ts                  # executeCesiumCodeInputShape (re-export)
│   ├── tools/
│   │   └── executeCesiumCode/
│   │       ├── executeCesiumCode.schema.ts   # { intent: string } — no descriptions
│   │       └── executeCesiumCode.ts          # Model-facing description + factory
│   └── pipeline/
│       ├── generate-verified-cesium-code.ts  # Orchestration entry point
│       ├── domain-matcher.ts                 # BM25 skill ranking
│       ├── prompt-builder.ts                 # Prompt assembly
│       ├── ast-verifier.ts                   # verifyCesiumCode (acorn/acorn-walk)
│       └── skills-loader.ts                  # Loads + caches SKILL.md files
```

### Three-subpath export pattern

Like `@cesium-ai/tools-cesium`, the codegen package uses a three-subpath export to enforce
the server-only boundary for tool descriptions:

| Subpath                             | Exports                                              | Consumer         |
| ----------------------------------- | ---------------------------------------------------- | ---------------- |
| `@cesium-ai/codegen-cesium`         | Full pipeline + model-facing descriptions            | **Backend only** |
| `@cesium-ai/codegen-cesium/names`   | `CODEGEN_CESIUM_TOOL_NAMES`, `CodegenCesiumToolName` | Both tiers       |
| `@cesium-ai/codegen-cesium/schemas` | `executeCesiumCodeInputShape`, inferred types        | Both tiers       |

Importing from the root subpath in client code would bundle the generation pipeline and tool
descriptions into the browser — the package structure prevents this by design.

---

## 3. Component responsibilities

| Component           | File                                                                                                                                                                                     | Responsibility                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tool definition** | [`tools/executeCesiumCode/executeCesiumCode.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/tools/executeCesiumCode/executeCesiumCode.ts) | Declares the `executeCesiumCode` tool with its model-facing description. Schema-only — no `execute` handler here.                                                                             |
| **Tool wiring**     | [`backend/src/tools/execute-cesium-code-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/execute-cesium-code-tool.ts)                           | `createExecuteCesiumCodeTool` wraps the pipeline in an [AI SDK](https://sdk.vercel.ai/docs) `Tool`. Catches all exceptions and returns `{ error }` instead of throwing.                       |
| **Pipeline entry**  | [`pipeline/generate-verified-cesium-code.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/generate-verified-cesium-code.ts)       | Orchestrates the full domain-match → prompt → generate → verify → retry flow.                                                                                                                 |
| **Domain matching** | [`pipeline/domain-matcher.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/domain-matcher.ts)                                     | [BM25](https://en.wikipedia.org/wiki/Okapi_BM25)-ranks intent against SKILL.md descriptions. Returns top-N `CesiumSkill[]`.                                                                   |
| **Prompt builder**  | [`pipeline/prompt-builder.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/prompt-builder.ts)                                     | Assembles the generation prompt with skill context and output constraints.                                                                                                                    |
| **AST verifier**    | [`pipeline/ast-verifier.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/ast-verifier.ts)                                         | `verifyCesiumCode` — parse-only [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) analysis via [`acorn`](https://github.com/acornjs/acorn). Collects all violations before returning. |
| **Skills loader**   | [`pipeline/skills-loader.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/skills-loader.ts)                                       | Reads all `skills/cesiumjs-*/SKILL.md` files from the installed [`@cesium/cesiumjs-skills`](https://github.com/CesiumGS/cesiumjs-skills) package. Caches after first load.                    |

---

## 4. Security gates

The codegen system is designed around two security gates. Only Gate 1 is currently
implemented; Gate 2 is planned.

```mermaid
flowchart TB
    subgraph Server["Backend (trusted)"]
        subgraph GATE1["Gate 1 — Static AST Verification (implemented)"]
            VER["verifyCesiumCode<br/>parse-only · denylist · size limits · loop heuristic"]
        end
    end

    subgraph Browser["Browser (untrusted execution surface)"]
        subgraph GATE2["Gate 2 — Sandbox Isolation (planned)"]
            SBX["Sandboxed execution<br/>timeout · memory limit · resource caps"]
        end
        VIEWER["CesiumJS Viewer<br/>(proxied handles only)"]
    end

    VER -- "verified code" --> GATE2
    GATE2 --> VIEWER

    classDef gate fill:#e6f7f4,stroke:#008B8B,stroke-width:2px,color:#000;
    class GATE1,GATE2 gate;
```

**Gate 1 — Static AST Verification** runs server-side before any code leaves the backend.
It rejects code that contains banned constructs (`eval`, `Function`, dynamic `import`,
computed member access) or banned browser globals (`fetch`, `window`, `document`,
`localStorage`, etc.), code that exceeds size limits, and code with statically detectable
infinite loops. Unverified code is never returned as the verified result. The LLM API key
and raw skill bodies never cross the Backend → Browser boundary — both stay server-side.

**Gate 2 — Browser-side Sandbox Isolation** is not yet implemented. Currently, verified
code is returned to the chat panel but not automatically executed against the `Viewer`.
Enabling execution without Gate 2 means relying entirely on server-side static analysis.
The [Security Considerations](Codegen-tool-security-attacks-vectors.md) document covers the
recommended sandbox options (QuickJS WASM, iframe sandbox, and the recommended hybrid
approach) before Gate 2 is added.

---

## 5. How the tool is registered in the backend

[`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts) wires the codegen tool into the agent loop alongside the viewer tools via `createExecuteCesiumCodeTool`. The tool is only registered when a model is configured; if no API key is available it is silently omitted even if listed in `ENABLED_CESIUM_TOOLS`.

`executeCesiumCode` is registered with `toolApproval: "user-approval"`, making it the only tool in the starter app that pauses the agent loop and requires an explicit browser confirmation before the backend generates any code. See [Codegen Tool Tutorial — Human-in-the-loop approval](../tutorials/codegen-tool-tutorial.md#3-human-in-the-loop-approval) for the wiring details and configuration options.

---

## Related documents

- [Architecture](architecture.md) — overall system component model and sequence diagrams.
- [Codegen Tool Tutorial](tutorials/codegen-tool-tutorial.md) — how to use and configure the tool.
- [How Codegen Works](tutorials/codegen-pipeline.md) — step-by-step pipeline walkthrough with diagrams.
- [Security Considerations](Codegen-tool-security-attacks-vectors.md) — full threat model, attack vectors, and recommended mitigations for the generation pipeline.
