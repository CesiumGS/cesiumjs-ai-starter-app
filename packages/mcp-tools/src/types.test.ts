import { describe, expect, it } from "vitest";
import { parseMcpServerConfigs } from "./types.js";

describe("parseMcpServerConfigs", () => {
  it("accepts a valid sse server config", () => {
    const parsed = parseMcpServerConfigs([
      { name: "docs", transport: { type: "sse", url: "https://example.com/sse" } },
    ]);
    expect(parsed).toEqual([
      { name: "docs", transport: { type: "sse", url: "https://example.com/sse" } },
    ]);
  });

  it("accepts a valid http server config with an allowlist", () => {
    const parsed = parseMcpServerConfigs([
      {
        name: "weather",
        transport: { type: "http", url: "https://example.com/mcp" },
        allowedTools: ["getForecast"],
      },
    ]);
    expect(parsed[0]?.allowedTools).toEqual(["getForecast"]);
  });

  it("rejects duplicate server names", () => {
    expect(() =>
      parseMcpServerConfigs([
        { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
        { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
      ]),
    ).toThrow(/Duplicate MCP server name/);
  });

  it("rejects server names containing the namespace delimiter", () => {
    expect(() =>
      parseMcpServerConfigs([
        { name: "my__server", transport: { type: "http", url: "https://example.com/mcp" } },
      ]),
    ).toThrow(/cannot contain/);
  });

  it("rejects an http transport with an invalid URL", () => {
    expect(() =>
      parseMcpServerConfigs([{ name: "weather", transport: { type: "http", url: "not-a-url" } }]),
    ).toThrow();
  });

  it("rejects an unsupported (e.g. stdio) transport type", () => {
    expect(() =>
      parseMcpServerConfigs([{ name: "docs", transport: { type: "stdio", command: "node" } }]),
    ).toThrow();
  });

  it("accepts oauth overrides on any server — there's no static mode flag to gate them on", () => {
    const parsed = parseMcpServerConfigs([
      {
        name: "ion",
        transport: {
          type: "http",
          url: "http://localhost:3000/mcp/",
          oauth: {
            clientId: "abc123",
            clientName: "Cesium AI",
          },
        },
      },
    ]);
    expect(parsed[0]?.transport.oauth).toEqual({
      clientId: "abc123",
      clientName: "Cesium AI",
    });
  });

  it("rejects unrecognized oauth fields", () => {
    expect(() =>
      parseMcpServerConfigs([
        {
          name: "ion",
          transport: {
            type: "http",
            url: "http://localhost:3000/mcp/",
            oauth: { tokenStorePath: "tokens.json" },
          },
        },
      ]),
    ).toThrow();
  });

  it("accepts a config-supplied oauth scope when provider metadata omits it", () => {
    const parsed = parseMcpServerConfigs([
      {
        name: "ion",
        transport: {
          type: "http",
          url: "http://localhost:3000/mcp/",
          oauth: { scope: "assets:list assets:read" },
        },
      },
    ]);

    expect(parsed[0]?.transport.oauth?.scope).toBe("assets:list assets:read");
  });
});
