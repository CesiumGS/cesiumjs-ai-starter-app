import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tool } from "ai";

const { createMCPClientMock } = vi.hoisted(() => ({
  createMCPClientMock: vi.fn(),
}));

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: createMCPClientMock,
}));

const { connectMcpServer } = await import("./connect-mcp-server.js");
const { noopMcpToolsLogger } = await import("./logger.js");

function fakeTool(): Tool {
  return {
    description: "a fake tool",
    inputSchema: { type: "object", properties: {} } as never,
  } as Tool;
}

function fakeClient(tools: Record<string, Tool>) {
  return { tools: vi.fn(async () => tools), close: vi.fn(async () => {}) };
}

beforeEach(() => {
  createMCPClientMock.mockReset();
});

describe("connectMcpServer", () => {
  it("connects and returns namespaced tools", async () => {
    createMCPClientMock.mockResolvedValueOnce(fakeClient({ search: fakeTool() }));

    const result = await connectMcpServer(
      { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
      noopMcpToolsLogger,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.toolEntries.map(([name]) => name)).toEqual(["mcp__docs__search"]);
    expect(createMCPClientMock).toHaveBeenCalledTimes(1);
    expect(createMCPClientMock).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://example.com/mcp",
        headers: undefined,
        authProvider: undefined,
      },
      clientName: "cesium-ai-mcp-tools",
    });
  });

  it("returns connection failures as an error result", async () => {
    createMCPClientMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await connectMcpServer(
      { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
      noopMcpToolsLogger,
    );

    expect(result).toEqual({ error: "ECONNREFUSED" });
  });

  it("flags authRequired when the failure looks like a 401 (no static credentials configured)", async () => {
    class FakeMcpClientError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.name = "MCPClientError";
        this.statusCode = statusCode;
      }
    }
    createMCPClientMock.mockRejectedValueOnce(
      new FakeMcpClientError("MCP HTTP Transport Error: POSTing to endpoint (HTTP 401): ", 401),
    );

    const result = await connectMcpServer(
      { name: "ion", transport: { type: "http", url: "https://example.com/mcp" } },
      noopMcpToolsLogger,
    );

    expect("authRequired" in result && result.authRequired).toBe(true);
  });

  it("does not flag authRequired for a non-401 MCPClientError", async () => {
    class FakeMcpClientError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.name = "MCPClientError";
        this.statusCode = statusCode;
      }
    }
    createMCPClientMock.mockRejectedValueOnce(
      new FakeMcpClientError("MCP HTTP Transport Error: POSTing to endpoint (HTTP 500): ", 500),
    );

    const result = await connectMcpServer(
      { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
      noopMcpToolsLogger,
    );

    expect(result).toEqual({ error: "MCP HTTP Transport Error: POSTing to endpoint (HTTP 500): " });
  });
});
