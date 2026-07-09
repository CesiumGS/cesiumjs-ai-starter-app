# Backend

Thin Node.js/Express host app. It resolves the environment and LLM provider, curates this app's Cesium tool surface, and wires everything into `@cesium-ai/server`'s chat router. This is where the LLM API key lives — it never reaches the browser.

See the [top-level README](../README.md) for architecture, quick start, and the full smoke test.

## Structure

```
src/
├── app.ts                 # Express app: CORS, JSON body parsing, /health, rate limiter, chat router
├── tools/
│   ├── flyto-tool.ts       # This app's model-facing flyTo input schema (extends the shared shape with descriptions)
│   └── execute-cesium-code-tool.ts # This app's server-executed executeCesiumCode tool (wraps @cesium-ai/codegen-cesium)
└── utils/
    ├── env.ts              # Zod-validated, typed environment config (loads .env)
    ├── providers.ts        # LLM provider factory — resolves an AI SDK LanguageModel from Env
    └── rate-limit.ts        # In-process per-IP sliding-window rate limiter
```

`app.ts` is split out from the process entry point (env/model resolution + `listen`) so the fully-wired app — real middleware in real order, real tool registry — can be started on an ephemeral port and driven over HTTP in `app.integration.test.ts`.

## Tool surface

The backend builds its viewer tool registry from `ENABLED_CESIUM_TOOLS` (`@cesium-ai/sample-config`, in [`shared/`](../shared)) via `createCesiumTools` (`@cesium-ai/tools-cesium`), so the model is only ever offered viewer tools this app turned on. `flyTo`'s model-facing input schema is this app's extended `flyToInputSchema` (`src/tools/flyto-tool.ts`), which layers `.describe()` hints onto the shared structural shape (`flyToShape` in `@cesium-ai/sample-config`) that the frontend also validates against — see [Working with Cesium Tools](../README.md#working-with-cesium-tools) in the top-level README.

### `executeCesiumCode`: this app's own server-executed tool

`executeCesiumCode` isn't a viewer tool — it lives in `@cesium-ai/codegen-cesium`, not `@cesium-ai/tools-cesium`, and `createCesiumTools` never builds it (the two packages are decoupled; see `@cesium-ai/tools-cesium`'s README for why). `@cesium-ai/codegen-cesium`'s own copy of the tool ships schema-only (no `execute`) by design. This app builds its own executable version instead: `src/tools/execute-cesium-code-tool.ts` (`createExecuteCesiumCodeTool`) wraps `@cesium-ai/codegen-cesium`'s `generateVerifiedCesiumCode` in an AI SDK `tool({ execute })`, using that library's model-facing description/schema so the model-facing contract stays identical to the schema-only version it replaces. It's merged into `app.ts`'s tool registry (alongside the viewer tools from `createCesiumTools`) only when a model is configured and the tool is enabled (`ENABLED_CESIUM_TOOLS.includes(CODEGEN_CESIUM_TOOL_NAMES.executeCesiumCode)`).

Because this tool has a real backend `execute`, the AI SDK resolves it server-side and streams its result as a `tool-output-available` chunk (not the `tool-input-available` call `flyTo` streams) — the frontend has a second dispatch path for this (`onServerToolResult` in `ChatPanel.tsx`; see [`frontend/README.md`](../frontend/README.md)), which currently just reports that execution isn't supported yet rather than running the verified code. The backend's AST-based verification (parse-only, never executing the generated code — see `@cesium-ai/codegen-cesium`'s README) is defense-in-depth intended to sit on top of a real runtime isolation boundary, not a substitute for one; that boundary is planned for a follow-up PR.

## Environment

Environment variables are parsed and validated by `src/utils/env.ts` (Zod). See the [Environment Variables](../README.md#environment-variables) table in the top-level README for the full list (`AI_PROVIDER`, provider API keys, `RATE_LIMIT_RPM`, `ALLOWED_ORIGIN`, etc.).

## Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Run the backend with `tsx watch`             |
| `npm run build`          | Type-check and compile to `dist/`            |
| `npm run typecheck:test` | Type-check source and tests without emitting |
| `npm run start`          | Run the compiled `dist/index.js`             |

Run from the repo root with `npm run dev:backend` to also build/watch the workspace packages it depends on.
