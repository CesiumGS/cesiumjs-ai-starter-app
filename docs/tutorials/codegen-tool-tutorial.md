# Tutorial: Using the Codegen Tool

<img src="../../assets/ty-book.png" alt="Ty mascot with book" class="doc-illustration" />

This tutorial covers the `executeCesiumCode` tool provided by the [`@cesium-ai/codegen-cesium`](../packages/codegen-cesium/index.md) package. The tool lets users describe what they want to see on the globe in plain English. The backend translates that description into verified CesiumJS JavaScript, which the browser then executes against the live `Viewer`. This tutorial explains how to use the tool, what you can configure, and how to tune its behaviour.

For a deep-dive into the internal generation pipeline, see the companion
[How Codegen Works](codegen-pipeline.md) guide.

---

## 1. How it works end to end

Type a natural-language intent in the chat panel — for example, _"add a polygon over France"_ or
_"draw a red point at the Eiffel Tower"_. Here is what happens:

1. The chat panel sends the message to `/api/chat`.
2. The model decides to call `executeCesiumCode` and fills in the `intent` field with your request.
3. **Before the backend runs**, the browser shows an approval prompt — the raw intent is displayed so you can confirm or reject it.
4. On approval, the backend runs the full generation pipeline (domain matching → prompt building → LLM generation → AST verification → optional retry).
5. Verified code is streamed back to the browser, which executes it against the live `Viewer`.

![Codegen tool adding 3D buildings over New York](../assets/codegen-new-york.gif)

For the full request lifecycle sequence diagram, see [Codegen Architecture — Request lifecycle](../architectures/architecture-codegen.md#request-lifecycle).

---

## 2. Enabling the tool

The `executeCesiumCode` tool is enabled like any other tool in this starter — by adding its name to `ENABLED_CESIUM_TOOLS` in [`shared/src/enabled-tools.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/shared/src/enabled-tools.ts):

```ts
// shared/src/enabled-tools.ts
import { CODEGEN_CESIUM_TOOL_NAMES } from "@cesium-ai/codegen-cesium/names";

export const ENABLED_CESIUM_TOOLS = [
  CESIUM_TOOL_NAMES.flyTo,
  CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode, // ← add
] as const satisfies readonly (CesiumToolName | CodegenCesiumToolName)[];
```

The backend also requires a model to be configured — at least one of `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` must be set. If no model is available,
`executeCesiumCode` is silently omitted from the registry even if listed in `ENABLED_CESIUM_TOOLS`.

To disable the tool, remove its name from the array. The backend immediately stops registering it
and the frontend gate rejects any stale call.

---

## 3. Human-in-the-loop approval

`executeCesiumCode` is the only tool in this starter that runs with `toolApproval: "user-approval"`.
Before the backend generates any code, the browser shows the raw `intent` string and waits for an
explicit click. This approval step exists because code generation is irreversible from the model's
perspective — once the LLM runs, tokens are spent and code may be applied to the live globe.

The approval check is wired in [`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts):

```ts
// backend/src/app.ts (simplified)
const toolApproval = {
  [CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode]: "user-approval",
};
```

If the user rejects, the agent loop receives a rejection result and may ask the user to clarify or
abandon the request. No code is generated or executed.

---

## 4. Configuration options

### Environment variables

These are validated through [Zod](https://zod.dev) in [`backend/src/utils/env.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/env.ts) and read at startup.

| Variable               | Default | Description                                                                                                                                                                            |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODEGEN_MAX_SKILLS`   | `1`     | Number of top BM25-matched skill domains injected into the generation prompt as context. Increasing this gives the model broader CesiumJS API coverage at the cost of a larger prompt. |
| `CODEGEN_MAX_ATTEMPTS` | `3`     | How many times to retry generation if AST verification fails. Each retry feeds the violation list back to the model as a correction prompt.                                            |

Set them in your `.env` file:

```bash
CODEGEN_MAX_SKILLS=2
CODEGEN_MAX_ATTEMPTS=5
```

### Programmatic options

`createExecuteCesiumCodeTool` (used in [`backend/src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts)) accepts the same options
programmatically, letting you override env defaults without changing environment configuration:

```ts
// backend/src/app.ts
import { createExecuteCesiumCodeTool } from "./tools/execute-cesium-code-tool";

const executeCesiumCodeTool = createExecuteCesiumCodeTool({
  model,
  maxSkills: 2, // override CODEGEN_MAX_SKILLS
  maxAttempts: 5, // override CODEGEN_MAX_ATTEMPTS
});
```

The function signature for the underlying pipeline entry point is:

```ts
generateVerifiedCesiumCode({
  intent: string,     // natural-language description from the user
  model: LanguageModel, // AI SDK LanguageModel — caller supplies this
  maxSkills?: number, // default 1
  maxAttempts?: number, // default 3
}): Promise<{ verified: true; code: string } | { verified: false; error: string; violations?: string[] }>
```

---

## 5. AST verifier rules

The verifier (`verifyCesiumCode` in [`packages/codegen-cesium/src/pipeline/ast-verifier.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-cesium/src/pipeline/ast-verifier.ts))
runs **parse-only static analysis** — it never executes the candidate code. All violations
are collected before the result is returned, so a single failing code block reports every
problem at once.

### Size limits

| Limit                 | Default          | Override            |
| --------------------- | ---------------- | ------------------- |
| Maximum source length | 4 000 characters | `options.maxLength` |
| Maximum line count    | 100 lines        | `options.maxLines`  |

### Parse check

The code is parsed with [`acorn`](https://github.com/acornjs/acorn) (`ecmaVersion: "latest"`, `sourceType: "script"`). A parse
error is a violation. If parsing fails entirely, remaining checks are skipped.

### Banned constructs

| Construct                                                         | Why                            |
| ----------------------------------------------------------------- | ------------------------------ |
| `eval(...)` / bare `eval` reference                               | Dynamic code execution         |
| `Function(...)` / `new Function(...)` / bare `Function` reference | Dynamic code execution         |
| Dynamic `import(...)`                                             | Dynamic module loading         |
| Computed member access `obj[expr]`                                | Bypasses static API allowlists |

### Banned browser globals

The following identifiers are rejected whether referenced directly or as the root of a member
chain (e.g., `window.fetch` is also rejected):

`fetch` · `XMLHttpRequest` · `WebSocket` · `window` · `document` · `localStorage` ·
`sessionStorage` · `indexedDB` · `navigator` · `Worker` · `SharedWorker` · `postMessage`

### Free-identifier allowlist (optional)

`verifyCesiumCode` accepts an optional `allowedSymbols` set. When provided, any free identifier
not in the set and not in the built-in safe globals list (`Math`, `console`, `Array`, `Object`,
etc.) is a violation. The default pipeline does **not** pass `allowedSymbols`, so only the
denylist above is enforced. To enable positive allowlisting, call the verifier directly:

```ts
import { verifyCesiumCode } from "@cesium-ai/codegen-cesium";

const result = verifyCesiumCode(code, {
  allowedSymbols: new Set(["viewer", "Cesium", "scene"]),
});
```

### Unbounded loop heuristic

`while (true) { }`, `for (;;) { }`, and `do { } while (true)` are rejected if the loop body
contains no `break` statement anywhere in its subtree. This is a heuristic — it prevents the
most obvious infinite loops but is not a termination proof.

---

## 6. How results flow back to the browser

The tool's `execute` handler in [`backend/src/tools/execute-cesium-code-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/execute-cesium-code-tool.ts) returns either:

```ts
{
  code: string;
} // generation succeeded and passed verification
{
  error: string;
} // generation failed or all retries were exhausted
```

The browser receives this as a tool result in the SSE stream. The starter app validates the
result shape and then executes the verified `code` after user approval, isolated inside a
fresh QuickJS-wasm interpreter provided by
[`@cesium-ai/codegen-sandbox`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/packages/codegen-sandbox/README.md)
(see the [Security Considerations](../architectures/codegen-tool-security-attacks-vectors.md) document for
the full sandbox architecture).

---

## 7. Quick reference

| I want to…                                | Where to look                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Enable the tool                           | `shared/src/enabled-tools.ts` — add `CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode`    |
| Disable the tool                          | Same file — remove the name                                                          |
| Change the number of skills in the prompt | `CODEGEN_MAX_SKILLS` env var or `maxSkills` in `createExecuteCesiumCodeTool`         |
| Change how many retries are allowed       | `CODEGEN_MAX_ATTEMPTS` env var or `maxAttempts` in `createExecuteCesiumCodeTool`     |
| Understand how the pipeline works         | [How Codegen Works](codegen-pipeline.md)                                             |
| Review the security threat model          | [Security Considerations](../architectures/codegen-tool-security-attacks-vectors.md) |
| Understand the architecture               | [Codegen Architecture](../architectures/architecture-codegen.md)                     |
