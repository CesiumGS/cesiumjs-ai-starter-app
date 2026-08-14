# @cesium-ai/webmcp-cesium [Experimental]

Registers every tool in [`@cesium-ai/tools-schemas`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/tools-schemas/)'s catalogue (`flyTo`, camera, entity, animation, imagery) on `document.modelContext` — the browser-native [WebMCP](https://developer.chrome.com/docs/ai/webmcp) Imperative API — backed by [`@cesium-ai/tools`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/tools/)'s executors running against a live CesiumJS `Viewer`. Browser-only.

## What this is (and isn't)

[WebMCP](https://webmachinelearning.github.io/webmcp/) is a **proposed web standard**, not the [Model Context Protocol](https://modelcontextprotocol.io) this repo's [`@cesium-ai/mcp-tools`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/mcp-tools/) package speaks. It lets a web page register tools directly on `document.modelContext`, so an agent **already running inside the same browser tab** — Chrome's built-in AI, or a browser extension like the [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) — can discover and call them against the live page, no network hop required.

This is a **different transport** than the one VS Code Copilot's or Claude Desktop's MCP configuration connects to (stdio/HTTP/SSE to a separate server process). Registering a tool here does **not** make it callable from those clients — see [Testing](#testing) and the note at the bottom of this README for what to use instead if that's what you need.

## Usage

```ts
import { registerCesiumWebMcpTools } from "@cesium-ai/webmcp-cesium";

// viewer: a live CesiumJS Viewer instance
const { toolNames, unregister } = await registerCesiumWebMcpTools(viewer);

// Later, e.g. on unmount:
unregister();
```

`registerCesiumWebMcpTools` is safe to call unconditionally — in a browser without WebMCP support it logs a warning (if a `logger` is passed) and resolves `{ toolNames: [], unregister: () => {} }` instead of throwing.

### Options

```ts
await registerCesiumWebMcpTools(viewer, {
  // Only register these tools (default: every CESIUM_TOOL_NAMES entry).
  enabled: ["flyTo", "entityAdd", "entityList"],
  // Same shape as @cesium-ai/tools' createCesiumToolExecutors overrides.
  executors: { flyTo: myCustomFlyToExecutor },
  // Override a tool's description/input schema, or set `false` to exclude it.
  toolConfig: { flyTo: { description: "Custom description." } },
  logger: createConsoleWebMcpToolsLogger("info"),
});
```

`buildCesiumWebMcpTools(viewer, options)` builds the same tool payloads without registering them — useful for tests or for calling `document.modelContext.registerTool` yourself with options this helper doesn't expose (e.g. `exposedTo` for cross-origin iframes).

`isWebMcpSupported()` feature-detects `document.modelContext` if you want to branch on support elsewhere in your app.

## Testing

WebMCP isn't shipped by default yet. To try it locally in Chrome:

1. Open `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and relaunch Chrome. (Or join the [WebMCP origin trial](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241) for a non-flag deployment.)
2. Run this app (`npm run dev`) and open `http://localhost:5173`.
3. Install the [Model Context Tool Inspector extension](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) and open it on that tab.
4. Confirm the Cesium tools (`flyTo`, `cameraSetView`, `entityAdd`, ...) show up under "registered tools", then either call one manually from the extension's UI or type a natural-language prompt (e.g. _"fly to Paris"_) and confirm the extension picks the right tool and the globe actually moves.

You can also check support/registration from the page's own DevTools console:

```js
"modelContext" in document; // true once the flag/origin trial is active
await document.modelContext.getTools(); // lists every tool this package registered
```

## Using this with VS Code Copilot or Claude Desktop

Not directly: VS Code Copilot's and Claude Desktop's MCP configuration only speaks real MCP over stdio/HTTP/SSE to a separate server _process_; WebMCP's `document.modelContext` only exists inside a browser tab's DOM and has no server counterpart to point that config at.

Bridging the two needs something in between that drives a real browser and relays the calls over MCP. As of Chrome 150 + a recent release, [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) is exactly that bridge: it's a real MCP server with an **experimental WebMCP category** (`list_webmcp_tools` / `execute_webmcp_tool`) that lists and calls whatever the page it's driving has registered on `document.modelContext` — including this package's tools, once the app is running and the agent has navigated to it. See [§4 of the WebMCP tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/webmcp-cesium-tutorial/#4-using-this-with-vs-code-copilot-or-claude-desktop) for the config and step-by-step. Treat it as an experimental, actively-changing demo path, not a stable integration.

This repo also has the _opposite_-direction bridge already, unrelated to WebMCP: [`@cesium-ai/mcp-tools`](https://cesiumgs.github.io/cesiumjs-ai-starter-app/packages/mcp-tools/) lets this app's own backend connect _out_ to external MCP servers. See the [Adding an MCP Server tutorial](https://cesiumgs.github.io/cesiumjs-ai-starter-app/tutorials/mcp-server-tutorial/) for that.

## Exports

| Export                                                                         | Description                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `registerCesiumWebMcpTools`                                                    | Registers enabled tools on `document.modelContext`. Resolves `{ toolNames, unregister }`. |
| `buildCesiumWebMcpTools`                                                       | Builds the same tool payloads without registering them.                                   |
| `isWebMcpSupported`                                                            | Feature-detects `document.modelContext`.                                                  |
| `RegisterCesiumWebMcpToolsOptions`                                             | Type: `{ enabled?, executors?, toolConfig?, logger?, document? }`.                        |
| `RegisteredCesiumWebMcpTools`                                                  | Type: `{ toolNames: string[]; unregister: () => void }`.                                  |
| `CesiumWebMcpToolConfig`                                                       | Type: per-tool `{ description?, inputSchema? }` override.                                 |
| `WebMcpToolsLogger`, `noopWebMcpToolsLogger`, `createConsoleWebMcpToolsLogger` | Same opt-in logging convention as every other package in this repo.                       |
| `WebMcpTool`, `WebMcpModelContext`, ...                                        | Minimal ambient types for the WebMCP Imperative API (not yet in TypeScript's DOM lib).    |

## Security

Same principle as `@cesium-ai/tools`: a WebMCP tool's arguments come from whatever agent is calling it — untrusted input from this package's point of view. Every registered tool's `execute` still runs through `@cesium-ai/tools`' validating executors, so invalid input resolves `{ success: false, error }` instead of touching the live `Viewer` unchecked. WebMCP itself gates tool registration behind [origin isolation and the `tools` Permissions Policy](https://developer.chrome.com/docs/ai/webmcp#security-and-permissions) — nothing extra to configure for a same-origin, non-iframed app like this one.
