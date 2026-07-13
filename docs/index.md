# CesiumJS AI Starter App

A production-ready starter that pairs a [CesiumJS](https://cesium.com/platform/cesiumjs/)
3D globe viewer with an LLM-powered chat interface. The LLM drives the globe through
structured tool calls (e.g. _"fly to Paris"_) while the **LLM API key never reaches the
browser** — all inference runs behind a Node.js API server.

## Docs

- [Getting Started](getting-started.md) — clone, configure, and run
- [Architecture](architecture.md) — component layout, request flow, Docker topology

## Tutorials

- [Cesium Viewer Tools Tutorial](tutorials/cesium-viewer-tools-tutorial.md) — enable a tool from the library, write its executor, wire it into the chat panel

## Packages

- [tools-schemas](packages/tools-schemas/index.md) — CesiumJS viewer tool library
- [server](packages/server/index.md) — Express chat router and agent loop
- [chat-element](packages/chat-element/index.md) — React chat panel component
- [sample-config](packages/sample-config/index.md) — this app's tool selection and config

## Source

[github.com/CesiumGS/cesiumjs-ai-starter-app](https://github.com/CesiumGS/cesiumjs-ai-starter-app)
