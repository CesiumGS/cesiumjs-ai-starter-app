import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Tool } from "ai";
import type { McpServerConfig } from "../types.js";

const { beginSessionOAuthConnectMock, completeSessionOAuthConnectMock } = vi.hoisted(() => ({
  beginSessionOAuthConnectMock: vi.fn(),
  completeSessionOAuthConnectMock: vi.fn(),
}));

vi.mock("./session-oauth-connect.js", () => ({
  beginSessionOAuthConnect: beginSessionOAuthConnectMock,
  completeSessionOAuthConnect: completeSessionOAuthConnectMock,
}));

const { createSessionMcpManager } = await import("./session-mcp-manager.js");
const { noopMcpToolsLogger } = await import("../logger.js");

const REDIRECT_URL = "https://backend.example.com/api/mcp/callback";

function fakeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    description: "a fake tool",
    inputSchema: { type: "object", properties: {} } as never,
    execute: vi.fn(async () => "ok"),
    ...overrides,
  } as Tool;
}

function mcpServer(name: string): McpServerConfig {
  return {
    name,
    transport: {
      type: "http",
      url: "https://example.com/mcp",
      oauth: { clientId: "client-id" },
    },
  };
}

/**
 * A fake `PendingSessionOAuth` whose `provider.storedState()` resolves a
 * fixed value \u2014 the shared/generic callback route routes purely on this
 * `state` value (see `session-mcp-manager.ts`'s `pendingByState`), so every
 * fake pending flow needs one, mirroring the real `createOAuthClientProvider`.
 */
function fakePending(server: McpServerConfig, state: string) {
  return { provider: { storedState: vi.fn(async () => state) }, server } as never;
}

const FAKE_PENDING = fakePending(mcpServer("ion"), "state-value");

beforeEach(() => {
  beginSessionOAuthConnectMock.mockReset();
  completeSessionOAuthConnectMock.mockReset();
});

describe("createSessionMcpManager", () => {
  it("returns an error connecting to an unconfigured server", async () => {
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    const result = await manager.connect("session-1", "unknown");

    expect(result).toEqual({ error: 'Unknown session-connectable MCP server "unknown".' });
    expect(beginSessionOAuthConnectMock).not.toHaveBeenCalled();
  });

  it("begins the OAuth flow and surfaces the authorization URL", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?...",
      pending: FAKE_PENDING,
    });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    const result = await manager.connect("session-1", "ion");

    expect(result).toEqual({ authorizationUrl: "https://auth.example.com/authorize?..." });
    expect(beginSessionOAuthConnectMock).toHaveBeenCalledWith({
      server: mcpServer("ion"),
      redirectUrl: REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });
  });

  it("rejects a second OAuth attempt while one is already pending for the same session and server", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?...",
      pending: FAKE_PENDING,
    });
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    await expect(manager.connect("session-1", "ion")).resolves.toEqual({
      error: 'An OAuth connection for "ion" is already pending on this session.',
    });
    expect(beginSessionOAuthConnectMock).toHaveBeenCalledTimes(1);
  });

  it("supersedes a stale pending attempt instead of rejecting it forever", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?attempt=1",
      pending: fakePending(mcpServer("ion"), "state-1"),
    });
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?attempt=2",
      pending: fakePending(mcpServer("ion"), "state-2"),
    });
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(0);

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
      pendingTtlMs: 1000,
    });

    await manager.connect("session-1", "ion");

    // Still well within the TTL: a second attempt is rejected as before.
    dateNowSpy.mockReturnValue(500);
    await expect(manager.connect("session-1", "ion")).resolves.toEqual({
      error: 'An OAuth connection for "ion" is already pending on this session.',
    });

    // Past the TTL: the abandoned first attempt is superseded, not rejected.
    dateNowSpy.mockReturnValue(1500);
    const result = await manager.connect("session-1", "ion");
    expect(result).toEqual({ authorizationUrl: "https://auth.example.com/authorize?attempt=2" });
    expect(beginSessionOAuthConnectMock).toHaveBeenCalledTimes(2);

    // The old state ("state-1") no longer routes anywhere; only the new one does.
    const staleCallback = await manager.completeCallback("session-1", "code", "state-1");
    expect(staleCallback).toEqual({
      error: "No pending OAuth connection matches the given state for this session.",
    });

    dateNowSpy.mockRestore();
  });

  it("errors out when the provider produces no OAuth state to route the shared callback on", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?...",
      pending: fakePending(mcpServer("ion"), ""),
    });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    const result = await manager.connect("session-1", "ion");

    expect(result).toEqual({
      error:
        'MCP server "ion" did not produce an OAuth "state" value, which this app requires to route its shared callback route.',
    });
  });

  it("rejects a callback with no matching pending flow", async () => {
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    const result = await manager.completeCallback("session-1", "code", "state");

    expect(result).toEqual({
      error: "No pending OAuth connection matches the given state for this session.",
    });
    expect(completeSessionOAuthConnectMock).not.toHaveBeenCalled();
  });

  it("rejects a callback whose state belongs to a DIFFERENT session", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize?...",
      pending: FAKE_PENDING,
    });
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    const result = await manager.completeCallback("session-2", "code", "state-value");

    expect(result).toEqual({
      error: "No pending OAuth connection matches the given state for this session.",
    });
    expect(completeSessionOAuthConnectMock).not.toHaveBeenCalled();
  });

  it("completes a pending flow, exposes its tools, and reports connection status", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const close = vi.fn(async () => {});
    completeSessionOAuthConnectMock.mockResolvedValueOnce({
      client: { close },
      toolEntries: [["mcp__ion__listAssets", fakeTool()]],
    });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    expect(await manager.isConnected("session-1", "ion")).toBe(false);

    const result = await manager.completeCallback("session-1", "auth-code", "state-value");

    expect(result).toEqual({ connected: true, serverName: "ion" });
    expect(completeSessionOAuthConnectMock).toHaveBeenCalledWith(
      FAKE_PENDING,
      "auth-code",
      "state-value",
      noopMcpToolsLogger,
    );
    expect(await manager.isConnected("session-1", "ion")).toBe(true);
    expect(Object.keys(await manager.getSessionTools("session-1"))).toEqual([
      "mcp__ion__listAssets",
    ]);

    // A different session never sees another session's connected tools.
    expect(await manager.getSessionTools("session-2")).toEqual({});
    expect(await manager.isConnected("session-2", "ion")).toBe(false);
  });

  it("routes a shared callback to the right one of TWO concurrently pending servers via their distinct state values", async () => {
    beginSessionOAuthConnectMock
      .mockResolvedValueOnce({
        authorizationUrl: "https://auth.example.com/authorize?state=state-ion",
        pending: fakePending(mcpServer("ion"), "state-ion"),
      })
      .mockResolvedValueOnce({
        authorizationUrl: "https://auth.example.com/authorize?state=state-docs",
        pending: fakePending(mcpServer("docs"), "state-docs"),
      });
    completeSessionOAuthConnectMock
      .mockResolvedValueOnce({
        client: { close: vi.fn(async () => {}) },
        toolEntries: [["mcp__docs__search", fakeTool()]],
      })
      .mockResolvedValueOnce({
        client: { close: vi.fn(async () => {}) },
        toolEntries: [["mcp__ion__listAssets", fakeTool()]],
      });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion"), mcpServer("docs")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    await manager.connect("session-1", "docs");

    // Complete "docs" first, using ITS state — must not be mistaken for "ion".
    const docsResult = await manager.completeCallback("session-1", "docs-code", "state-docs");
    expect(docsResult).toEqual({ connected: true, serverName: "docs" });
    expect(await manager.isConnected("session-1", "docs")).toBe(true);
    expect(await manager.isConnected("session-1", "ion")).toBe(false);

    const ionResult = await manager.completeCallback("session-1", "ion-code", "state-ion");
    expect(ionResult).toEqual({ connected: true, serverName: "ion" });
    expect(await manager.isConnected("session-1", "ion")).toBe(true);
  });

  it("cancelPending forgets a pending flow and returns its server name, without exchanging a code", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    const serverName = await manager.cancelPending("session-1", "state-value");

    expect(serverName).toBe("ion");
    expect(completeSessionOAuthConnectMock).not.toHaveBeenCalled();
    // The pending flow is gone — completing it afterward no longer matches anything.
    const result = await manager.completeCallback("session-1", "code", "state-value");
    expect(result).toEqual({
      error: "No pending OAuth connection matches the given state for this session.",
    });
  });

  it("cancelPending returns undefined for an unknown state or a different session", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    expect(await manager.cancelPending("session-1", "no-such-state")).toBeUndefined();
    expect(await manager.cancelPending("session-1", undefined)).toBeUndefined();

    await manager.connect("session-1", "ion");
    expect(await manager.cancelPending("session-2", "state-value")).toBeUndefined();
  });

  it("disconnect closes the client and drops the session's tools", async () => {
    beginSessionOAuthConnectMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const close = vi.fn(async () => {});
    completeSessionOAuthConnectMock.mockResolvedValueOnce({
      client: { close },
      toolEntries: [["mcp__ion__listAssets", fakeTool()]],
    });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    await manager.completeCallback("session-1", "auth-code", "state-value");

    await manager.disconnect("session-1", "ion");

    expect(close).toHaveBeenCalledTimes(1);
    expect(await manager.isConnected("session-1", "ion")).toBe(false);
    expect(await manager.getSessionTools("session-1")).toEqual({});
  });

  it("closes an existing client before replacing it after a new OAuth connection", async () => {
    beginSessionOAuthConnectMock.mockResolvedValue({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const firstClose = vi.fn(async () => {});
    const secondClose = vi.fn(async () => {});
    completeSessionOAuthConnectMock
      .mockResolvedValueOnce({
        client: { close: firstClose },
        toolEntries: [["mcp__ion__first", fakeTool()]],
      })
      .mockResolvedValueOnce({
        client: { close: secondClose },
        toolEntries: [["mcp__ion__second", fakeTool()]],
      });
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    await manager.completeCallback("session-1", "first-code", "state-value");
    await manager.connect("session-1", "ion");
    await manager.completeCallback("session-1", "second-code", "state-value");

    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(Object.keys(await manager.getSessionTools("session-1"))).toEqual(["mcp__ion__second"]);

    await manager.disconnect("session-1", "ion");
    expect(secondClose).toHaveBeenCalledTimes(1);
  });

  it("closeAll closes every connected session's clients", async () => {
    beginSessionOAuthConnectMock.mockResolvedValue({
      authorizationUrl: "https://auth.example.com/authorize",
      pending: FAKE_PENDING,
    });
    const closeA = vi.fn(async () => {});
    const closeB = vi.fn(async () => {});
    completeSessionOAuthConnectMock
      .mockResolvedValueOnce({
        client: { close: closeA },
        toolEntries: [["mcp__ion__a", fakeTool()]],
      })
      .mockResolvedValueOnce({
        client: { close: closeB },
        toolEntries: [["mcp__ion__b", fakeTool()]],
      });

    const manager = createSessionMcpManager({
      servers: [mcpServer("ion")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    await manager.connect("session-1", "ion");
    await manager.completeCallback("session-1", "code-1", "state-value");
    await manager.connect("session-2", "ion");
    await manager.completeCallback("session-2", "code-2", "state-value");

    await manager.closeAll();

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(await manager.isConnected("session-1", "ion")).toBe(false);
    expect(await manager.isConnected("session-2", "ion")).toBe(false);
  });

  it("reports the configured session-connectable server names", () => {
    const manager = createSessionMcpManager({
      servers: [mcpServer("ion"), mcpServer("docs")],
      buildRedirectUrl: () => REDIRECT_URL,
      logger: noopMcpToolsLogger,
    });

    expect(manager.serverNames).toEqual(["ion", "docs"]);
  });
});
