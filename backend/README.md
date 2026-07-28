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

The backend builds its tool registry from `ENABLED_CESIUM_TOOLS` (`@cesium-ai/sample-config`, in [`shared/`](../shared)) via `createCesiumTools` (`@cesium-ai/tools-schemas`), so the model is only ever offered tools this app turned on. `flyTo`'s model-facing input schema is this app's extended `flyToInputSchema` (`src/tools/flyto-tool.ts`), which layers `.describe()` hints onto the shared structural shape (`flyToShape` in `@cesium-ai/sample-config`) that the frontend also validates against — see [Working with Cesium Tools](../README.md#working-with-cesium-tools) in the top-level README.

### `executeCesiumCode`: code generation and verification

`executeCesiumCode` is built in `src/tools/execute-cesium-code-tool.ts` and wraps the code generation from `@cesium-ai/codegen-cesium`. The backend generates and verifies code (AST-based), then the frontend receives the verified code and executes it directly against the live Viewer. When the frontend sandbox reports an `executionError`, the next tool execution automatically extracts the latest `{ code, executionError }` result from the AI SDK message history and appends it to the nested codegen prompt as runtime correction context. A later successful execution clears older feedback. AST-based verification remains the server-side security gate; the frontend sandbox provides the independent runtime boundary.

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
