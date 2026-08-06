/**
 * Renders a tool's `result` payload for display. When none of `payload`'s
 * top-level fields are a multi-line string, the whole thing is just rendered
 * as pretty-printed JSON (e.g. a `cameraGetPosition` result). Otherwise —
 * e.g. an `executeCesiumCode` result's `code` field — every multi-line string
 * field is pulled out and printed as its own raw text block instead of a
 * JSON-escaped, single-line string (so multi-line source code renders with
 * real line breaks instead of literal `\n` characters), with a blank line
 * around it to stay visually distinct; every other field still renders as
 * its own compact `key: value` JSON line.
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

  const entries = Object.entries(payload as Record<string, unknown>);
  const isMultilineString = ([, value]: [string, unknown]) =>
    typeof value === "string" && value.includes("\n");
  if (!entries.some(isMultilineString)) return JSON.stringify(payload, null, 2);

  // Mixed payload: multi-line string fields render as raw text blocks (with a blank line around
  // them to stay visually distinct), every other field still renders as its own compact JSON line.
  const lines: string[] = [];
  let previousWasBlock = false;
  for (const [key, value] of entries) {
    const isBlock = isMultilineString([key, value]);
    if (lines.length > 0 && (isBlock || previousWasBlock)) lines.push("");
    lines.push(isBlock ? `${key}:\n${value}` : `${key}: ${JSON.stringify(value, null, 2)}`);
    previousWasBlock = isBlock;
  }
  return lines.join("\n");
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
