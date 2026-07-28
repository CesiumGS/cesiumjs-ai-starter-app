/**
 * Minimal, local reader for the "MCP Apps" extension's tool metadata
 * (`_meta.ui`) — `@ai-sdk/mcp` implements the extension internally
 * (`splitMCPAppTools`/`readMCPAppResource`/`getMCPAppToolMeta`) but only
 * exports `splitMCPAppTools`/`readMCPAppResource`, not the per-tool metadata
 * reader itself. This mirrors its shape (`_meta.ui.resourceUri` starting with
 * `ui://`, optional `_meta.ui.visibility: ("model"|"app")[]`) closely enough
 * to interoperate with any MCP server implementing the same spec, without
 * depending on an unexported internal.
 *
 * Malformed metadata (wrong types, a `resourceUri` not starting with
 * `ui://`) is treated as "this tool has no app" rather than thrown — a
 * misbehaving/untrusted MCP server's tool metadata should never crash tool
 * discovery for every other tool.
 */
export interface McpAppToolMeta {
  /** The `ui://` resource URI to fetch (via `readMCPAppResource`) and render as this tool's widget. */
  resourceUri: string;
  /** Which surfaces the server intended this tool for. Absent means "no restriction stated". */
  visibility?: readonly ("model" | "app")[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts `McpAppToolMeta` from a discovered tool's raw `_meta` field, or
 * `undefined` if it doesn't declare a (validly-shaped) `ui://` app resource.
 */
export function getMcpAppToolMeta(meta: unknown): McpAppToolMeta | undefined {
  if (!isPlainObject(meta)) return undefined;
  const ui = meta.ui;
  if (!isPlainObject(ui)) return undefined;

  const resourceUri = ui.resourceUri;
  if (typeof resourceUri !== "string" || !resourceUri.startsWith("ui://")) return undefined;

  const rawVisibility = ui.visibility;
  const visibility = Array.isArray(rawVisibility)
    ? rawVisibility.filter((v): v is "model" | "app" => v === "model" || v === "app")
    : undefined;

  return {
    resourceUri,
    ...(visibility && visibility.length > 0 ? { visibility } : {}),
  };
}
