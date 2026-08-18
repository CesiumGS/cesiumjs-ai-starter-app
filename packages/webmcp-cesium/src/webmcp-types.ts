/**
 * Minimal ambient typings for the WebMCP Imperative API
 * (https://developer.chrome.com/docs/ai/webmcp/imperative-api). `document.modelContext` isn't
 * part of TypeScript's DOM lib yet (experimental/origin-trial API) — this package declares just
 * the surface it uses rather than pulling in a third-party typings package.
 */

/** A tool payload accepted by `WebMcpModelContext.registerTool`. */
export interface WebMcpTool<Args extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  /** A JSON Schema object (not a Zod schema) describing `execute`'s input. */
  inputSchema: Record<string, unknown>;
  execute: (args: Args) => Promise<unknown>;
  annotations?: WebMcpToolAnnotations;
}

/** Optional hints about a tool's behavior, surfaced to the calling agent. */
export interface WebMcpToolAnnotations {
  /** True when the tool only reads state and never mutates the page. */
  readOnlyHint?: boolean;
  /** True when the tool's return value may contain untrusted/unreviewed content. */
  untrustedContentHint?: boolean;
}

/** A tool as returned by `WebMcpModelContext.getTools()` — adds discovery-only fields. */
export interface WebMcpDiscoveredTool extends WebMcpTool {
  origin: string;
  window: Window;
}

export interface WebMcpRegisterToolOptions {
  signal?: AbortSignal;
  /** Origins allowed to discover/execute this tool from a cross-origin document. */
  exposedTo?: string[];
}

export interface WebMcpGetToolsOptions {
  /** Cross-origin document origins to include tools from, in addition to same-origin ones. */
  fromOrigins?: string[];
}

export interface WebMcpExecuteToolOptions {
  signal?: AbortSignal;
}

/** The `document.modelContext` interface itself. */
export interface WebMcpModelContext extends EventTarget {
  registerTool(tool: WebMcpTool, options?: WebMcpRegisterToolOptions): Promise<void>;
  getTools(options?: WebMcpGetToolsOptions): Promise<WebMcpDiscoveredTool[]>;
  executeTool(
    tool: WebMcpDiscoveredTool,
    argsJson: string,
    options?: WebMcpExecuteToolOptions,
  ): Promise<unknown>;
}

declare global {
  interface Document {
    /** Present only in browsers that implement WebMCP (Chrome behind a flag/origin trial as of 2026). */
    modelContext?: WebMcpModelContext;
  }
}
