/**
 * Renders a tool's `result` payload for display. Plain values fall back to
 * normal JSON formatting, but top-level string fields (e.g. an
 * `executeCesiumCode` result's `code`) are printed as their raw text instead
 * of a JSON-escaped, single-line string — so multi-line source code renders
 * with real line breaks instead of literal `\n` characters.
 */
export function formatToolPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return JSON.stringify(payload, null, 2);
  }
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) =>
      typeof value === "string" ? `${key}:\n${value}` : `${key}: ${JSON.stringify(value, null, 2)}`,
    )
    .join("\n\n");
}
