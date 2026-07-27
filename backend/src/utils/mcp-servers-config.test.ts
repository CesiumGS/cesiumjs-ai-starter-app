import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mirrors the `vi.resetModules()` + dynamic re-import pattern `env.test.ts`
 * already uses: `mcp-servers-config.ts` resolves config-file candidate paths
 * from `process.cwd()`, so each test needs a fresh module registration to
 * observe a different mocked `node:fs` outcome.
 */
const ORIGINAL_ENV = { ...process.env };

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
}));

async function loadModule() {
  vi.resetModules();
  return import("./mcp-servers-config.js");
}

beforeEach(() => {
  fsMocks.existsSync.mockReset();
  fsMocks.readFileSync.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveMcpServersConfig", () => {
  it("returns an empty list (source: default) when no config file exists", async () => {
    fsMocks.existsSync.mockReturnValue(false);
    const { resolveMcpServersConfig } = await loadModule();

    expect(resolveMcpServersConfig()).toEqual({ result: { servers: [], source: "default" } });
  });

  it("parses an mcp.config.json file", async () => {
    fsMocks.existsSync.mockImplementation((path: unknown) =>
      String(path).endsWith("mcp.config.json"),
    );
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify([
        { name: "from-file", transport: { type: "http", url: "https://example.com/file" } },
      ]),
    );
    const { resolveMcpServersConfig } = await loadModule();

    const outcome = resolveMcpServersConfig();
    expect("result" in outcome && outcome.result.source).toBe("file");
    expect("result" in outcome && outcome.result.servers[0]?.name).toBe("from-file");
    expect("result" in outcome && outcome.result.sourcePath).toBeDefined();
  });

  it("reports invalid JSON in the config file as an issue", async () => {
    fsMocks.existsSync.mockImplementation((path: unknown) =>
      String(path).endsWith("mcp.config.json"),
    );
    fsMocks.readFileSync.mockReturnValue("{not json");
    const { resolveMcpServersConfig } = await loadModule();

    const outcome = resolveMcpServersConfig();
    expect("issues" in outcome).toBe(true);
    expect((outcome as { issues: string[] }).issues[0]).toMatch(/is not valid JSON/);
  });

  it("reports a schema validation failure in the config file as an issue", async () => {
    fsMocks.existsSync.mockImplementation((path: unknown) =>
      String(path).endsWith("mcp.config.json"),
    );
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify([{ name: "docs", transport: { type: "stdio", command: "node" } }]),
    );
    const { resolveMcpServersConfig } = await loadModule();

    const outcome = resolveMcpServersConfig();
    expect("issues" in outcome).toBe(true);
  });

  it("parses multiple servers from a config file", async () => {
    fsMocks.existsSync.mockImplementation((path: unknown) =>
      String(path).endsWith("mcp.config.json"),
    );
    fsMocks.readFileSync.mockReturnValue(
      JSON.stringify([
        { name: "docs", transport: { type: "http", url: "https://example.com/mcp" } },
        { name: "ion", transport: { type: "http", url: "https://example.com/ion" } },
      ]),
    );
    const { resolveMcpServersConfig } = await loadModule();

    const outcome = resolveMcpServersConfig();
    expect("result" in outcome && outcome.result.servers.map((server) => server.name)).toEqual([
      "docs",
      "ion",
    ]);
  });
});
