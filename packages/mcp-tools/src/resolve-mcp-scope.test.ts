import { describe, expect, it, vi } from "vitest";
import type { Tool } from "ai";
import type { McpToolsHandle } from "./create-mcp-tools.js";
import { isKnownMcpTool, resolveMcpClient, resolveMcpTools } from "./resolve-mcp-scope.js";
import type { SessionMcpManager } from "./session/session-mcp-manager.js";

function fakeTool(): Tool {
  return {
    description: "a fake tool",
    inputSchema: { type: "object", properties: {} } as never,
    execute: vi.fn(async () => "ok"),
  } as Tool;
}

function fakeMcp(overrides: Partial<McpToolsHandle> = {}): McpToolsHandle {
  return {
    tools: {},
    servers: [],
    authRequiredServers: [],
    getClient: () => undefined,
    close: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeSessionMcp(overrides: Partial<SessionMcpManager> = {}): SessionMcpManager {
  return {
    connect: vi.fn(),
    completeCallback: vi.fn(),
    cancelPending: vi.fn(),
    getSessionTools: async () => ({}),
    getSessionClient: async () => undefined,
    isConnected: vi.fn(),
    serverNames: [],
    disconnect: vi.fn(),
    disconnectSession: vi.fn(),
    closeAll: vi.fn(async () => {}),
    ...overrides,
  } as SessionMcpManager;
}

describe("resolveMcpClient", () => {
  it("returns undefined when neither mcp nor sessionMcp is provided", async () => {
    expect(await resolveMcpClient({}, "session-1", "ion")).toBeUndefined();
  });

  it("prefers the operator-configured (mcp) client over a session client for the same server", async () => {
    const globalClient = {} as never;
    const sessionClient = {} as never;
    const mcp = fakeMcp({ getClient: (server) => (server === "ion" ? globalClient : undefined) });
    const sessionMcp = fakeSessionMcp({ getSessionClient: async () => sessionClient });
    expect(await resolveMcpClient({ mcp, sessionMcp }, "session-1", "ion")).toBe(globalClient);
  });

  it("falls back to the session client when mcp has no client for that server", async () => {
    const sessionClient = {} as never;
    const mcp = fakeMcp();
    const sessionMcp = fakeSessionMcp({
      getSessionClient: async (sessionId, server) =>
        sessionId === "session-1" && server === "ion" ? sessionClient : undefined,
    });
    expect(await resolveMcpClient({ mcp, sessionMcp }, "session-1", "ion")).toBe(sessionClient);
  });
});

describe("isKnownMcpTool", () => {
  it("returns false when neither mcp nor sessionMcp is provided", async () => {
    expect(await isKnownMcpTool({}, "session-1", "ion", "search")).toBe(false);
  });

  it("returns true when the namespaced tool is in mcp.tools", async () => {
    const mcp = fakeMcp({ tools: { mcp__ion__search: fakeTool() } });
    expect(await isKnownMcpTool({ mcp }, "session-1", "ion", "search")).toBe(true);
  });

  it("returns true when the namespaced tool is in the session's own tools", async () => {
    const sessionMcp = fakeSessionMcp({
      getSessionTools: async () => ({ mcp__ion__search: fakeTool() }),
    });
    expect(await isKnownMcpTool({ sessionMcp }, "session-1", "ion", "search")).toBe(true);
  });

  it("returns false for a tool present on a different server", async () => {
    const mcp = fakeMcp({ tools: { mcp__maps__search: fakeTool() } });
    expect(await isKnownMcpTool({ mcp }, "session-1", "ion", "search")).toBe(false);
  });
});

describe("resolveMcpTools", () => {
  it("merges mcp's static tools with the session's own tools", async () => {
    const mcp = fakeMcp({ tools: { mcp__maps__search: fakeTool() } });
    const sessionMcp = fakeSessionMcp({
      getSessionTools: async () => ({ mcp__ion__list: fakeTool() }),
    });
    const tools = await resolveMcpTools({ mcp, sessionMcp }, "session-1");
    expect(Object.keys(tools)).toEqual(["mcp__maps__search", "mcp__ion__list"]);
  });

  it("returns an empty ToolSet when neither is provided", async () => {
    expect(await resolveMcpTools({}, "session-1")).toEqual({});
  });

  it("preserves a merged tool's own `mcpApp` widget metadata", async () => {
    const mcp = fakeMcp({
      tools: { mcp__ion__import: { ...fakeTool(), mcpApp: { resourceUri: "ui://ion/importer" } } },
    });
    const tools = await resolveMcpTools({ mcp }, "session-1");
    expect(tools.mcp__ion__import?.mcpApp).toEqual({ resourceUri: "ui://ion/importer" });
  });
});
