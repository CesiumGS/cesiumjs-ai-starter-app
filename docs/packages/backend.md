# backend (app)

The Node/Express API host. Composes the reusable packages into a running server.

**Location:** [`backend/`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/tree/main/backend)

## Responsibilities

- **Provider selection** — reads `AI_PROVIDER`, `*_API_KEY`, `AI_MODEL`, and `AI_BASE_URL`
  from the environment and instantiates the matching AI SDK provider (`@ai-sdk/openai`,
  `@ai-sdk/anthropic`, `@ai-sdk/google`).
- **Tool registry** — builds `createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS, flyTo: { inputSchema } })`
  from the shared allowlist and mounts it via `createChatRouter`.
- **Express wiring** — CORS, JSON body parsing, `/health`, and a per-IP rate limiter.
- **Environment validation** — [`backend/src/utils/env.ts`](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/utils/env.ts)
  fails fast on misconfiguration.

## Key files

| File                      | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `src/app.ts`              | Express app setup, router mounting                |
| `src/providers.ts`        | AI SDK provider factory (reads `AI_PROVIDER`)     |
| `src/tools/flyto-tool.ts` | Builds the `flyTo` model-facing schema with hints |
| `src/utils/env.ts`        | Environment variable validation                   |
| `src/utils/rate-limit.ts` | Per-IP rate limiter                               |

## Running

```bash
# Development (watch mode, started automatically by npm run dev)
npm run dev -w backend

# Production build
npm run build -w backend
node backend/dist/index.js
```

In production the backend runs inside a Docker container — see
[Architecture](../architecture.md) for the Docker Compose topology.
