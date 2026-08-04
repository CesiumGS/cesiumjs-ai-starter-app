import type { McpToolsLogger } from "../../logger.js";

/**
 * Builds the RFC 9728 OAuth Protected Resource Metadata well-known URL(s) to
 * try for a given MCP server URL, in the same priority order the MCP spec
 * (and `@ai-sdk/mcp`'s own internal, non-exported discovery helper) uses:
 * path-specific first (`<origin>/.well-known/oauth-protected-resource<path>`,
 * e.g. `https://server.com/.well-known/oauth-protected-resource/mcp` for a
 * server at `https://server.com/mcp`), then the origin root as a fallback.
 */
function buildProtectedResourceMetadataUrls(serverUrl: string): URL[] {
  const parsed = new URL(serverUrl);
  const pathname =
    parsed.pathname.endsWith("/") && parsed.pathname !== "/"
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
  const root = new URL("/.well-known/oauth-protected-resource", parsed.origin);
  if (!pathname || pathname === "/") return [root];
  return [new URL(`/.well-known/oauth-protected-resource${pathname}`, parsed.origin), root];
}

function extractScope(body: unknown): string | undefined {
  const scopes = (body as { scopes_supported?: unknown } | null)?.scopes_supported;
  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    !scopes.every((scope) => typeof scope === "string")
  ) {
    return undefined;
  }
  return (scopes as string[]).join(" ");
}

/**
 * Fetches the MCP server's RFC 9728 OAuth Protected Resource Metadata
 * document (the `.well-known/oauth-protected-resource` endpoint the MCP
 * authorization spec requires resource servers to publish — see step 2 of
 * "The Authorization Flow: Step by Step" at
 * https://modelcontextprotocol.io/docs/tutorials/security/authorization)
 * and returns its advertised `scopes_supported` as a ready-to-use
 * space-separated OAuth `scope` string.
 *
 * This lets `McpOAuthConfig.scope` stay optional for servers that advertise
 * their supported scopes this way (e.g. so an operator doesn't have to
 * hand-copy a scope list into config) — an explicitly-configured `scope`
 * always takes precedence over this discovery (see `connect-mcp-server.ts`).
 *
 * Never throws: an unreachable server, a non-2xx response, or a document
 * that simply omits `scopes_supported` (the field is OPTIONAL per RFC 9728)
 * all resolve to `undefined` so callers can fall back to no scope.
 */
export async function discoverProtectedResourceScope(
  serverUrl: string,
  logger: McpToolsLogger,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  for (const metadataUrl of buildProtectedResourceMetadataUrls(serverUrl)) {
    try {
      const response = await fetchFn(metadataUrl);
      if (!response.ok) continue;

      const scope = extractScope(await response.json());
      if (scope) return scope;
    } catch (err) {
      logger.debug("Could not fetch OAuth protected resource metadata", {
        url: metadataUrl.href,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return undefined;
}
