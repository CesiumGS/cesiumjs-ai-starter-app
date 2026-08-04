/**
 * Detects whether a startup MCP connection failure looks like "this server
 * requires per-user authentication" — the signal `createMcpTools` uses to
 * automatically route a server into `authRequiredServers` instead of just
 * recording a hard connection failure, with no static "this needs OAuth"
 * config flag required.
 *
 * `connectMcpServer` deliberately connects WITHOUT an `authProvider` (see its
 * doc comment) — a protected resource's initial request then gets a plain
 * 401 with nothing to retry, and `@ai-sdk/mcp`'s HTTP/SSE transports both
 * surface that as an (unexported) `MCPClientError` whose `.name` is the
 * literal string `"MCPClientError"`. The `http` transport also sets a real
 * (but untyped/unexported) `statusCode` property to the response's HTTP
 * status; the `sse` transport only embeds it in the message text
 * (`"...(HTTP 401): ..."`) — check both since `MCPClientError` itself can't
 * be imported (`@ai-sdk/mcp` doesn't export the class or an `isInstance`
 * helper for it).
 */
export function isUnauthorizedMcpError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== "MCPClientError") return false;

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number") return statusCode === 401;

  return /\(HTTP 401\)/.test(error.message);
}
