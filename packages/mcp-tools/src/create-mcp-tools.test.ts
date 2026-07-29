import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Tool } from "ai";
import type { McpServerConfig } from "./types.js";

const { createMCPClientMock } = vi.hoisted(() => ({
  createMCPClientMock: vi.fn(),
}));

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: createMCPClientMock,
  auth: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  mcpAppClientCapabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: [] } } },
}));

const { createMcpTools, DEFAULT_MCP_TOOL_TIMEOUT_MS } = await import("./create-mcp-tools.js");
const { noopMcpToolsLogger } = await import("./logger.js");

function fakeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    description: "a fake tool",
    inputSchema: { type: "object", properties: {} } as never,
    execute: vi.fn(async () => "ok"),
    ...overrides,
  } as Tool;
}

function mcpServer(name: string, overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    name,
    transport: { type: "http", url: "https://example.com/mcp" },
    ...overrides,
  };
}

beforeEach(() => {
  createMCPClientMock.mockReset();
});

describe("createMcpTools", () => {
  it("connects to an MCP server and namespaces its discovered tools", async () => {
    const close = vi.fn(async () => {});
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({ search: fakeTool() })),
      close,
    });

    const handle = await createMcpTools({
      servers: [mcpServer("docs")],
      logger: noopMcpToolsLogger,
    });

    expect(Object.keys(handle.tools)).toEqual(["mcp__docs__search"]);
    expect(handle.servers).toEqual([
      { name: "docs", connected: true, toolNames: ["mcp__docs__search"] },
    ]);
  });

  it("filters discovered tools by allowedTools", async () => {
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({ search: fakeTool(), deleteEverything: fakeTool() })),
      close: vi.fn(async () => {}),
    });

    const handle = await createMcpTools({
      servers: [mcpServer("docs", { allowedTools: ["search"] })],
      logger: noopMcpToolsLogger,
    });

    expect(Object.keys(handle.tools)).toEqual(["mcp__docs__search"]);
  });

  it("isolates a failed server connection — other servers still connect", async () => {
    createMCPClientMock.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValueOnce({
      tools: vi.fn(async () => ({ ping: fakeTool() })),
      close: vi.fn(async () => {}),
    });

    const handle = await createMcpTools({
      servers: [mcpServer("broken"), mcpServer("healthy")],
      logger: noopMcpToolsLogger,
    });

    expect(handle.servers).toEqual([
      { name: "broken", connected: false, toolNames: [], error: "ECONNREFUSED" },
      { name: "healthy", connected: true, toolNames: ["mcp__healthy__ping"] },
    ]);
    expect(Object.keys(handle.tools)).toEqual(["mcp__healthy__ping"]);
    expect(handle.authRequiredServers).toEqual([]);
  });

  it("routes a server whose connection fails with a 401 into authRequiredServers instead of a hard failure", async () => {
    class FakeMcpClientError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.name = "MCPClientError";
        this.statusCode = statusCode;
      }
    }
    const ionServer = mcpServer("ion");
    createMCPClientMock
      .mockRejectedValueOnce(new FakeMcpClientError("(HTTP 401): unauthorized", 401))
      .mockResolvedValueOnce({
        tools: vi.fn(async () => ({ search: fakeTool() })),
        close: vi.fn(async () => {}),
      });

    const handle = await createMcpTools({
      servers: [ionServer, mcpServer("docs")],
      logger: noopMcpToolsLogger,
    });

    expect(handle.servers[0]).toMatchObject({ name: "ion", connected: false, authRequired: true });
    expect(handle.authRequiredServers).toEqual([ionServer]);
    expect(Object.keys(handle.tools)).toEqual(["mcp__docs__search"]);
  });

  it("prefixes tool names so identical tool names from two servers never collide", async () => {
    createMCPClientMock
      .mockResolvedValueOnce({
        tools: vi.fn(async () => ({ search: fakeTool() })),
        close: vi.fn(async () => {}),
      })
      .mockResolvedValueOnce({
        tools: vi.fn(async () => ({ search: fakeTool() })),
        close: vi.fn(async () => {}),
      });

    const handle = await createMcpTools({
      servers: [mcpServer("a"), mcpServer("b")],
      logger: noopMcpToolsLogger,
    });

    expect(Object.keys(handle.tools).sort()).toEqual(["mcp__a__search", "mcp__b__search"]);
  });

  it("rejects a tool call that outlives the configured timeout", async () => {
    vi.useFakeTimers();
    const hangingExecute = vi.fn(() => new Promise(() => {}));
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({ slow: fakeTool({ execute: hangingExecute }) })),
      close: vi.fn(async () => {}),
    });

    const handle = await createMcpTools({
      servers: [mcpServer("docs")],
      timeoutMs: 10,
      logger: noopMcpToolsLogger,
    });

    const callPromise = handle.tools["mcp__docs__slow"].execute!({}, {
      toolCallId: "1",
      messages: [],
    } as never);
    const assertion = expect(callPromise).rejects.toThrow(/timed out after 10ms/);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    vi.useRealTimers();
  });

  it("uses the default timeout when none is configured", async () => {
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({ search: fakeTool() })),
      close: vi.fn(async () => {}),
    });
    await createMcpTools({ servers: [mcpServer("docs")], logger: noopMcpToolsLogger });
    expect(DEFAULT_MCP_TOOL_TIMEOUT_MS).toBe(30_000);
  });

  it("close() awaits every underlying client close() and swallows individual rejections", async () => {
    const closeA = vi.fn(async () => {
      throw new Error("close failed");
    });
    const closeB = vi.fn(async () => {});
    createMCPClientMock
      .mockResolvedValueOnce({ tools: vi.fn(async () => ({})), close: closeA })
      .mockResolvedValueOnce({ tools: vi.fn(async () => ({})), close: closeB });

    const handle = await createMcpTools({
      servers: [mcpServer("a"), mcpServer("b")],
      logger: noopMcpToolsLogger,
    });

    await expect(handle.close()).resolves.toBeUndefined();
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
  });

  it("passes the configured transport (including headers) through to createMCPClient", async () => {
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({})),
      close: vi.fn(async () => {}),
    });

    await createMcpTools({
      servers: [
        mcpServer("docs", {
          transport: {
            type: "http",
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer secret" },
          },
        }),
      ],
      logger: noopMcpToolsLogger,
    });

    expect(createMCPClientMock).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://example.com/mcp",
        headers: { Authorization: "Bearer secret" },
      },
      clientName: "cesium-ai-mcp-tools",
      capabilities: expect.any(Object),
    });
  });

  it("exposes a connected server's live client via getClient, and undefined for one that never connected", async () => {
    const close = vi.fn(async () => {});
    const client = { tools: vi.fn(async () => ({ search: fakeTool() })), close };
    createMCPClientMock.mockResolvedValueOnce(client);
    createMCPClientMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const handle = await createMcpTools({
      servers: [mcpServer("docs"), mcpServer("broken")],
      logger: noopMcpToolsLogger,
    });

    expect(handle.getClient("docs")).toBe(client);
    expect(handle.getClient("broken")).toBeUndefined();
    expect(handle.getClient("unknown-server")).toBeUndefined();
  });

  it("attaches MCP Apps widget metadata directly onto the discovered tool as `mcpApp`", async () => {
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({
        launch_importer: fakeTool({
          _meta: { ui: { resourceUri: "ui://ion/importer", visibility: ["model", "app"] } },
        } as Partial<Tool>),
        plain_tool: fakeTool(),
      })),
      close: vi.fn(async () => {}),
    });

    const handle = await createMcpTools({
      servers: [mcpServer("ion")],
      logger: noopMcpToolsLogger,
    });

    expect(handle.tools["mcp__ion__launch_importer"]?.mcpApp).toEqual({
      resourceUri: "ui://ion/importer",
      visibility: ["model", "app"],
    });
    expect(handle.tools["mcp__ion__plain_tool"]?.mcpApp).toBeUndefined();
  });
});
