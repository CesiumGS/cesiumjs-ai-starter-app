/** Every dynamically-connected MCP tool is namespaced `mcp__<server>__<tool>`. */
export const MCP_TOOL_PREFIX = "mcp__";

/** An `mcp__<server>__<tool>`-namespaced tool name, split into its parts. */
export interface ParsedMcpToolName {
  server: string;
  /** The bare, un-namespaced tool name (the part after the server segment). */
  displayName: string;
}

/**
 * Splits an `mcp__<server>__<tool>`-namespaced tool name into its `server`
 * and bare `displayName` parts, or `null` if `name` doesn't start with
 * {@link MCP_TOOL_PREFIX} or otherwise doesn't match that shape.
 */
export function parseMcpToolName(name: string): ParsedMcpToolName | null {
  if (!name.startsWith(MCP_TOOL_PREFIX)) return null;
  const rest = name.slice(MCP_TOOL_PREFIX.length);
  const separatorIndex = rest.indexOf("__");
  if (separatorIndex === -1) return null;
  return { server: rest.slice(0, separatorIndex), displayName: rest.slice(separatorIndex + 2) };
}
