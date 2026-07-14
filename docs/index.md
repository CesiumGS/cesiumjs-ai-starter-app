# CesiumJS AI Starter App

A ready-to-run starter that pairs a [CesiumJS](https://cesium.com/platform/cesiumjs/)
3D globe viewer with an LLM-powered chat interface. The LLM drives the globe through
structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the
browser** — all inference runs behind a Node.js API server.

## Docs

- [Getting Started](getting-started.md) — clone, configure, and run
- [Architecture](architectures/architecture.md) — component layout, request flow, Docker topology

## Tutorials

- [Cesium Viewer Tools Tutorial](tutorials/cesium-viewer-tools-tutorial.md) — enable a tool from the library, write its executor, wire it into the chat panel

## Packages

- [tools-schemas](packages/tools-schemas/index.md) — CesiumJS viewer tool library
- [codegen-cesium](../packages/codegen-cesium/README.md) — intent-to-code generation pipeline
- [server](../packages/server/README.md) — Express chat router and agent loop
- [chat-element](../packages/chat-element/README.md) — React chat panel component
- [sample-config](../shared/README.md) — this app's tool selection and config

## Source

[github.com/CesiumGS/cesiumjs-ai-starter-app](https://github.com/CesiumGS/cesiumjs-ai-starter-app)
