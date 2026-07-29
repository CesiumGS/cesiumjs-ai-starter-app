/**
 * Renders a tool's `result` payload for display. Plain values fall back to
 * normal JSON formatting, but top-level string fields (e.g. an
 * `executeCesiumCode` result's `code`) are printed as their raw text instead
 * of a JSON-escaped, single-line string — so multi-line source code renders
 * with real line breaks instead of literal `\n` characters.
 *
 * MCP tool results (`mcp__<server>__<tool>`, see `@cesium-ai/mcp-tools`) are a
 * special case: every MCP `CallToolResult` is `{ content: [{ type: "text",
 * text: "..." }, ...], isError?: boolean }` per the MCP spec — and that
 * `text` field is very often ITSELF a JSON-stringified blob (e.g. Cesium
 * ion's MCP server returning a list-assets result). Left to the generic
 * object-formatting path below, that blob would render as one giant
 * single-line, `\"`/`\n`-escaped string — unreadable. {@link formatMcpContent}
 * detects this shape and pretty-prints each text part (as JSON when it
 * parses as JSON, verbatim otherwise) instead.
 */
export function formatToolPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return JSON.stringify(payload, null, 2);
  }
  const mcpText = formatMcpContent(payload as Record<string, unknown>);
  if (mcpText !== undefined) return mcpText;
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) =>
      typeof value === "string" ? `${key}:\n${value}` : `${key}: ${JSON.stringify(value, null, 2)}`,
    )
    .join("\n\n");
}

/**
 * Recognizes an MCP `CallToolResult` shape (`{ content: [{type, text}, ...],
 * isError? }`) and renders it as readable text, or returns `undefined` if
 * `payload` doesn't match that shape (so the caller falls back to generic
 * formatting for every other tool's result).
 */
function formatMcpContent(payload: Record<string, unknown>): string | undefined {
  const { content } = payload;
  if (!Array.isArray(content) || content.length === 0) return undefined;

  const parts: string[] = [];
  for (const item of content) {
    if (item === null || typeof item !== "object") return undefined;
    const { type, text } = item as Record<string, unknown>;
    if (type !== "text" || typeof text !== "string") return undefined;
    parts.push(prettyPrintIfJson(text));
  }

  const rendered = parts.join("\n\n");
  return payload.isError === true ? `[error]\n${rendered}` : rendered;
}

/** Pretty-prints `text` as indented JSON if it parses as JSON, verbatim otherwise. */
function prettyPrintIfJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
