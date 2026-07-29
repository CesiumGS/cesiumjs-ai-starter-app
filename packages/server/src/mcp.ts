/**
 * Separate entry point (`@cesium-ai/server/mcp`) for the MCP-related routers
 * — kept OUT of the package's main `.` entry (`index.ts`) so a host that only
 * wants `createChatRouter` never pulls in `@cesium-ai/mcp-tools` at all: ESM
 * imports are eager, so re-exporting these from `index.ts` would force
 * `@cesium-ai/mcp-tools` to resolve at load time for every consumer of this
 * package, whether or not they use MCP. A host that DOES want MCP support
 * imports from this subpath instead, and must have `@cesium-ai/mcp-tools`
 * installed itself (see this package's `peerDependencies`).
 */
export { createMcpAppRouter, type McpAppRouterOptions } from "./routers/mcp-app-router.js";
export { createMcpSessionRouter } from "./routers/mcp-session-router.js";
