# Workspace Packages

This repo is an npm workspace monorepo. Each workspace is documented in its own section below.
See [Architecture](../architectures/architecture.md) for how the pieces fit together at runtime.

## Workspace map

```
cesiumjs-ai-starter-app/
├── packages/
│   ├── tools-schemas/    @cesium-ai/tools-schemas     — CesiumJS viewer tool schemas (server + client)
│   ├── tools/            @cesium-ai/tools              — default client-side viewer tool executors (frontend only)
│   ├── webmcp-cesium/    @cesium-ai/webmcp-cesium     — registers viewer tools on document.modelContext (WebMCP, frontend only)
│   ├── codegen-cesium/   @cesium-ai/codegen-cesium    — intent-to-code generation pipeline (server only)
│   ├── codegen-sandbox/  @cesium-ai/codegen-sandbox   — QuickJS-wasm execution sandbox (frontend only)
│   ├── mcp-tools/        @cesium-ai/mcp-tools          — optional MCP client tool bridge (server only)
│   ├── turf-tools/       @cesium-ai/turf-tools         — server-only Turf.js spatial-analysis tools
│   ├── server/           @cesium-ai/server             — Express chat router + agent loop
│   └── chat-element/     @cesium-ai/chat-element       — React chat panel UI component
├── shared/                @cesium-ai/sample-config     — this app's tool selection/config
├── frontend/              (app) Vite SPA               — CesiumJS viewer + chat panel host
└── backend/               (app) Node/Express API        — provider wiring + tool registry host
```

`frontend` and `backend` are **host apps**, not reusable packages — they compose the library
packages into a working product.

## Dependency graph

```mermaid
%%{init: {"themeVariables": {"fontSize": "28px"}, "flowchart": {"nodeSpacing": 80, "rankSpacing": 110, "padding": 28}}}%%
flowchart TD
    subgraph cesium_native["CesiumJS-native tools"]
        tools_schemas["@cesium-ai/tools-schemas"]
        tools["@cesium-ai/tools"]
        webmcp["@cesium-ai/webmcp-cesium"]
        codegen["@cesium-ai/codegen-cesium"]
        sandbox["@cesium-ai/codegen-sandbox"]
    end
    subgraph non_cesium["Non-Cesium tools (no Viewer dependency)"]
        mcp["@cesium-ai/mcp-tools"]
        turf["@cesium-ai/turf-tools"]
    end
    server["@cesium-ai/server"]
    chatel["@cesium-ai/chat-element"]
    shared["@cesium-ai/sample-config"]
    backend["backend (app)"]
    frontend["frontend (app)"]

    backend --> server
    backend --> tools_schemas
    backend --> codegen
    backend --> mcp
    backend --> turf
    backend --> shared
    frontend --> tools_schemas
    frontend --> tools
    frontend --> webmcp
    frontend --> chatel
    frontend --> shared
    frontend --> sandbox
    tools --> tools_schemas
    webmcp --> tools_schemas
    webmcp --> tools
    shared --> tools_schemas
    server --> tools_schemas

    classDef cesiumNode fill:#c3fae8,stroke:#0c8599,stroke-width:1px,color:#003847
    classDef nonCesiumNode fill:#fff3bf,stroke:#e8590c,stroke-width:1px,color:#663c00
    classDef hostNode fill:#d3f9d8,stroke:#2f9e44,stroke-width:1px,color:#1b4d2e
    classDef appNode fill:#e5dbff,stroke:#5f3dc4,stroke-width:1px,color:#2c1a6b
    class tools_schemas,tools,webmcp,codegen,sandbox cesiumNode
    class mcp,turf nonCesiumNode
    class server,chatel,shared hostNode
    class backend,frontend appNode
    style cesium_native fill:#e3fafc,stroke:#0c8599,stroke-width:2px,color:#000000
    style non_cesium fill:#fff9db,stroke:#e8590c,stroke-width:2px,color:#000000
```

`tools-schemas` is the shared foundation everything builds on; `tools` is its default,
ready-to-use client-side executor implementation (frontend-only, depends only on `tools-schemas`
and `cesium`); `webmcp-cesium` (frontend-only) registers that same catalogue on
`document.modelContext` for the browser-native WebMCP standard, depending on both
`tools-schemas` (descriptions/schemas) and `tools` (executors); `codegen-cesium`
(intent-to-code generation + static verification) is also part of the **CesiumJS-native tools**
group — every package in it either depends on `tools-schemas` or drives a live `Viewer`.
`codegen-sandbox` (execution of already-verified code against a live `Viewer`) is frontend-only
(depends on `cesium` + `quickjs-emscripten`) and never imported server-side; it's grouped with
the CesiumJS-native tools since it exists solely to run generated Cesium code.
`mcp-tools` (optional MCP client bridge) and `turf-tools`
(Turf.js spatial-analysis tools backed by a session-scoped GeoJSON dataset store) form the
**non-Cesium tools** group — both are server-only and neither depends on `tools-schemas` or a
live `Viewer`; `turf-tools`'s tools run entirely in-process on the backend. `backend` and
`frontend` are leaves — they depend on everything and nothing depends on them.

## Build order

Because of the graph above, packages must be built before the apps that depend on them:

| Command                  | What it does                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:packages` | Builds `tools-schemas` → `tools` → `webmcp-cesium` → `codegen-cesium` → `codegen-sandbox` → `mcp-tools` → `turf-tools` → `sample-config` → `server` in dependency order |
| `npm run build`          | `build:packages`, then builds `frontend` and `backend`                                                                                                                  |
| `npm run dev`            | Builds packages once, then runs all dev processes concurrently (watch mode)                                                                                             |
| `npm test`               | Runs the [Vitest](https://vitest.dev) suite across the workspace                                                                                                        |
| `npm run test:e2e`       | Runs the [Playwright](https://playwright.dev) end-to-end suite                                                                                                          |

## Packages

- [tools-schemas](tools-schemas/index.md) — CesiumJS viewer tool library
- [tools](tools/index.md) — default client-side viewer tool executors
- [webmcp-cesium](webmcp-cesium/index.md) — registers viewer tools on `document.modelContext` (WebMCP)
- [codegen-cesium](codegen-cesium/index.md) — intent-to-code generation pipeline
- [codegen-sandbox](codegen-sandbox/index.md) — QuickJS-wasm execution sandbox for generated code
- [mcp-tools](mcp-tools/index.md) — optional Model Context Protocol client tool bridge
- [turf-tools](turf-tools/index.md) — server-only Turf.js spatial-analysis tools + session-scoped dataset store
- [server](server/index.md) — Express chat router and agent loop
- [chat-element](chat-element/index.md) — React chat panel component
- [sample-config](sample-config/index.md) — this app's tool selection and config
- [backend](backend.md) — backend app (Node/Express)
- [frontend](frontend.md) — frontend app (Vite/React)
