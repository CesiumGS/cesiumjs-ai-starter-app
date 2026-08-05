import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Tool } from "ai";
import type { McpServerConfig } from "../types.js";

class FakeUnauthorizedError extends Error {}

const { createMCPClientMock, authMock } = vi.hoisted(() => ({
  createMCPClientMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: createMCPClientMock,
  auth: authMock,
  UnauthorizedError: FakeUnauthorizedError,
  mcpAppClientCapabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: [] } } },
}));

const { discoverProtectedResourceScopeMock } = vi.hoisted(() => ({
  discoverProtectedResourceScopeMock: vi.fn(async (): Promise<string | undefined> => undefined),
}));

vi.mock("./oauth/discover-protected-resource-scope.js", () => ({
  discoverProtectedResourceScope: discoverProtectedResourceScopeMock,
}));

const { beginSessionOAuthConnect, completeSessionOAuthConnect } =
  await import("./session-oauth-connect.js");
const { noopMcpToolsLogger } = await import("../logger.js");

function fakeTool(): Tool {
  return {
    description: "a fake tool",
    inputSchema: { type: "object", properties: {} } as never,
  } as Tool;
}

function fakeClient(tools: Record<string, Tool>) {
  return { tools: vi.fn(async () => tools), close: vi.fn(async () => {}) };
}

function ionServer(): McpServerConfig {
  return {
    name: "ion",
    transport: {
      type: "http",
      url: "http://localhost:3000/mcp/",
      oauth: { clientId: "client-id" },
    },
  };
}

beforeEach(() => {
  createMCPClientMock.mockReset();
  authMock.mockReset();
  discoverProtectedResourceScopeMock.mockReset();
  discoverProtectedResourceScopeMock.mockResolvedValue(undefined);
});

describe("beginSessionOAuthConnect", () => {
  it("proceeds with the interactive flow even when transport.oauth is entirely omitted", async () => {
    createMCPClientMock.mockImplementationOnce(async ({ transport }) => {
      await transport.authProvider.redirectToAuthorization(
        new URL("https://auth.example.com/authorize?x=1"),
      );
      throw new FakeUnauthorizedError("auth required");
    });

    const result = await beginSessionOAuthConnect({
      server: { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
      redirectUrl: "https://backend.example.com/api/mcp/docs/callback",
      logger: noopMcpToolsLogger,
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.authorizationUrl).toBe("https://auth.example.com/authorize?x=1");
    expect(createMCPClientMock).toHaveBeenCalledTimes(1);
  });

  it("returns the captured authorization URL and a pending flow on UnauthorizedError", async () => {
    createMCPClientMock.mockImplementationOnce(async ({ transport }) => {
      await transport.authProvider.redirectToAuthorization(
        new URL("https://auth.example.com/authorize?x=1"),
      );
      throw new FakeUnauthorizedError("auth required");
    });

    const result = await beginSessionOAuthConnect({
      server: ionServer(),
      redirectUrl: "https://backend.example.com/api/mcp/ion/callback",
      logger: noopMcpToolsLogger,
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.authorizationUrl).toBe("https://auth.example.com/authorize?x=1");
    expect(result.pending.server).toEqual(ionServer());
  });

  it("errors when the server unexpectedly requires no authorization at all", async () => {
    createMCPClientMock.mockResolvedValueOnce(fakeClient({ listAssets: fakeTool() }));

    const result = await beginSessionOAuthConnect({
      server: ionServer(),
      redirectUrl: "https://backend.example.com/api/mcp/ion/callback",
      logger: noopMcpToolsLogger,
    });

    expect(result).toEqual({ error: 'MCP server "ion" did not require authorization.' });
  });

  it("surfaces a non-auth connection failure as an error", async () => {
    createMCPClientMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await beginSessionOAuthConnect({
      server: ionServer(),
      redirectUrl: "https://backend.example.com/api/mcp/ion/callback",
      logger: noopMcpToolsLogger,
    });

    expect(result).toEqual({ error: "ECONNREFUSED" });
  });

  it("discovers scope dynamically when no config override is supplied", async () => {
    discoverProtectedResourceScopeMock.mockResolvedValueOnce("assets:list assets:read");
    createMCPClientMock.mockImplementationOnce(async ({ transport }) => {
      await transport.authProvider.redirectToAuthorization(
        new URL("https://auth.example.com/authorize?x=1"),
      );
      throw new FakeUnauthorizedError("auth required");
    });

    const result = await beginSessionOAuthConnect({
      server: ionServer(),
      redirectUrl: "https://backend.example.com/api/mcp/ion/callback",
      logger: noopMcpToolsLogger,
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(discoverProtectedResourceScopeMock).toHaveBeenCalledWith(
      ionServer().transport.url,
      noopMcpToolsLogger,
    );
    expect(result.pending.provider.clientMetadata.scope).toBe("assets:list assets:read");
  });

  it("prefers an explicit scope override without performing discovery", async () => {
    const server = ionServer();
    server.transport.oauth = {
      ...server.transport.oauth,
      scope: "assets:list assets:read assets:write",
    };
    createMCPClientMock.mockImplementationOnce(async ({ transport }) => {
      await transport.authProvider.redirectToAuthorization(
        new URL("https://auth.example.com/authorize?x=1"),
      );
      throw new FakeUnauthorizedError("auth required");
    });

    const result = await beginSessionOAuthConnect({
      server,
      redirectUrl: "https://backend.example.com/api/mcp/callback",
      logger: noopMcpToolsLogger,
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(discoverProtectedResourceScopeMock).not.toHaveBeenCalled();
    expect(result.pending.provider.clientMetadata.scope).toBe(
      "assets:list assets:read assets:write",
    );
  });
});

describe("completeSessionOAuthConnect", () => {
  const pending = { provider: {}, server: ionServer() } as unknown as Parameters<
    typeof completeSessionOAuthConnect
  >[0];

  it("exchanges the code, connects, and returns discovered/namespaced tools", async () => {
    authMock.mockResolvedValueOnce("AUTHORIZED");
    createMCPClientMock.mockResolvedValueOnce(fakeClient({ listAssets: fakeTool() }));

    const result = await completeSessionOAuthConnect(
      pending,
      "auth-code",
      "state-value",
      noopMcpToolsLogger,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.toolEntries.map((entry) => entry.namespacedName)).toEqual([
      "mcp__ion__listAssets",
    ]);
    expect(authMock).toHaveBeenCalledWith(pending.provider, {
      serverUrl: ionServer().transport.url,
      authorizationCode: "auth-code",
      callbackState: "state-value",
    });
  });

  it("errors when the exchange doesn't complete", async () => {
    authMock.mockResolvedValueOnce("REDIRECT");

    const result = await completeSessionOAuthConnect(
      pending,
      "auth-code",
      undefined,
      noopMcpToolsLogger,
    );

    expect(result).toEqual({ error: 'OAuth authorization for MCP server "ion" did not complete.' });
    expect(createMCPClientMock).not.toHaveBeenCalled();
  });

  it("surfaces a thrown error from the exchange or connection attempt", async () => {
    authMock.mockRejectedValueOnce(new Error("token endpoint rejected the code"));

    const result = await completeSessionOAuthConnect(
      pending,
      "auth-code",
      undefined,
      noopMcpToolsLogger,
    );

    expect(result).toEqual({ error: "token endpoint rejected the code" });
  });
});
