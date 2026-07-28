import {
  auth,
  createMCPClient,
  mcpAppClientCapabilities,
  UnauthorizedError,
  type MCPClient,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import { buildTransport, selectToolEntries, type SelectedMcpTool } from "../connect-mcp-server.js";
import type { McpToolsLogger } from "../logger.js";
import { discoverProtectedResourceScope } from "./oauth/discover-protected-resource-scope.js";
import { createOAuthClientProvider } from "./oauth/oauth-client-provider.js";
import type { McpServerConfig } from "../types.js";

export interface PendingSessionOAuth {
  provider: OAuthClientProvider;
  server: McpServerConfig;
}

/**
 * Begins an interactive authorization-code + PKCE flow for one MCP server on
 * behalf of a single browser session. Tokens/PKCE state live only in this
 * process's memory for as long as the caller keeps `pending` around, never
 * on disk.
 *
 * A fresh in-memory store never has cached tokens, so `createMCPClient` is
 * always expected to throw `UnauthorizedError` here — at which point
 * `@ai-sdk/mcp`'s `auth()` has already invoked `redirectToAuthorization`,
 * captured via `onAuthorizationUrl` (unlike `connect-mcp-server.ts`, this URL
 * must reach the requesting browser, not an operator's terminal).
 */
export async function beginSessionOAuthConnect(options: {
  server: McpServerConfig;
  redirectUrl: string;
  logger: McpToolsLogger;
}): Promise<{ authorizationUrl: string; pending: PendingSessionOAuth } | { error: string }> {
  const { server, redirectUrl, logger } = options;
  // Every server passed here is inherently OAuth-gated, so `oauth` is just an
  // optional bag of overrides. Omitting it falls back to RFC 7591 dynamic
  // client registration. Explicit scope supports providers that require it
  // while omitting scopes_supported from their RFC 9728 metadata.
  const oauth = server.transport.oauth ?? {};

  const clientId = oauth.clientId;
  const clientSecret = oauth.clientSecret;

  let capturedUrl: URL | undefined;
  const scope = oauth.scope ?? (await discoverProtectedResourceScope(server.transport.url, logger));

  const provider = createOAuthClientProvider({
    redirectUrl,
    scope,
    clientId,
    clientSecret,
    clientName: oauth.clientName,
    onAuthorizationUrl: (url) => {
      capturedUrl = url;
    },
  });

  try {
    await createMCPClient({
      transport: buildTransport(server.transport, provider),
      clientName: "cesium-ai-mcp-tools",
      capabilities: mcpAppClientCapabilities,
    });
    // A brand-new in-memory store has no cached tokens, so reaching here (no
    // UnauthorizedError) means this server doesn't require authorization on
    // this transport — surface that as an error rather than pretending an
    // interactive flow is in progress.
    return { error: `MCP server "${server.name}" did not require authorization.` };
  } catch (err) {
    if (err instanceof UnauthorizedError && capturedUrl) {
      return { authorizationUrl: capturedUrl.href, pending: { provider, server } };
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to begin OAuth for MCP server`, { server: server.name, error: message });
    return { error: message };
  }
}

/**
 * Completes a pending session OAuth flow using the `code`/`state` a callback
 * route received, then connects the real MCP client and discovers +
 * allowlist-filters + namespaces its tools — the post-authorization half of
 * `connect-mcp-server.ts`'s `connectMcpServer`, split out because the
 * redirect is caught by a separate Express request, not awaited in-process.
 */
export async function completeSessionOAuthConnect(
  pending: PendingSessionOAuth,
  code: string,
  state: string | undefined,
  logger: McpToolsLogger,
): Promise<{ client: MCPClient; toolEntries: SelectedMcpTool[] } | { error: string }> {
  const { provider, server } = pending;
  try {
    const result = await auth(provider, {
      serverUrl: server.transport.url,
      authorizationCode: code,
      callbackState: state,
    });
    if (result !== "AUTHORIZED") {
      return { error: `OAuth authorization for MCP server "${server.name}" did not complete.` };
    }

    const client = await createMCPClient({
      transport: buildTransport(server.transport, provider),
      clientName: "cesium-ai-mcp-tools",
      capabilities: mcpAppClientCapabilities,
    });
    const toolEntries = selectToolEntries(await client.tools(), server, logger);
    return { client, toolEntries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to complete OAuth for MCP server`, {
      server: server.name,
      error: message,
    });
    return { error: message };
  }
}
