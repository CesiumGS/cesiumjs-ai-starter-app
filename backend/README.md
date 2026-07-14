# Backend

Thin Node.js/Express host. Resolves the LLM provider, builds the tool registry, and mounts `@cesium-ai/server`'s chat router — the API key never reaches the browser.

See [Getting Started](https://cesiumgs.github.io/cesiumjs-ai-starter-app/getting-started/) for setup and the smoke test.

## Structure

| File                                                                                                                                                   | Description                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`src/app.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts)                                                       | [Express](https://expressjs.com) app: CORS, rate limiting, `/health`, chat router |
| [`src/tools/flyto-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/flyto-tool.ts)                             | `flyTo` input schema with model-facing descriptions                               |
| [`src/tools/execute-cesium-code-tool.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/tools/execute-cesium-code-tool.ts) | `executeCesiumCode` tool (wraps `@cesium-ai/codegen-cesium`)                      |
| [`src/utils/env.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/env.ts)                                           | [Zod](https://zod.dev)-validated env config                                       |
| [`src/utils/providers.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/providers.ts)                               | LLM provider factory                                                              |
| [`src/utils/rate-limit.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/rate-limit.ts)                             | Per-IP sliding-window rate limiter                                                |

## Tool registry

The backend builds its tool registry from `ENABLED_CESIUM_TOOLS` (defined in [`shared/`](../shared)) via `createCesiumTools`, so the model is only ever offered the tools this app enables. The `executeCesiumCode` tool generates and AST-verifies CesiumJS snippets server-side; the frontend receives verified code and executes it against the live Viewer.

See the [Cesium Viewer Tools Tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/cesium-viewer-tools-tutorial/) for the full walkthrough.

## Environment

Parsed and validated by [`src/utils/env.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/env.ts) ([Zod](https://zod.dev)). See [Getting Started](https://cesiumgs.github.io/cesiumjs-ai-starter-app/getting-started/) for the full variable list (`AI_PROVIDER`, API keys, `RATE_LIMIT_RPM`, `ALLOWED_ORIGIN`, etc.).

## Scripts

| Command                  | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `npm run dev`            | Run with [`tsx`](https://github.com/privatenumber/tsx) watch |
| `npm run build`          | Type-check and compile to `dist/`                            |
| `npm run typecheck:test` | Type-check without emitting                                  |
| `npm run start`          | Run compiled `dist/index.js`                                 |

Run from the repo root with `npm run dev:backend` to also build/watch workspace packages.
