import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { McpToolsHandle, SessionMcpManager } from "@cesium-ai/mcp-tools";
import { createBackendApp } from "./app.js";
import type { Env } from "./utils/env.js";

/**
 * Full-stack backend integration tests: they boot the **real composed Express
 * app** (`createBackendApp`) — real CORS, JSON body limit, `/health`, the per-IP
 * rate limiter, and the chat router wired to the app's real `ENABLED_CESIUM_TOOLS`
 * registry — on an ephemeral port and drive it over HTTP. Only the language
 * model is a mock (`MockLanguageModelV4`), so no provider key or network is
 * involved. This is the layer the Playwright e2e suite stubs out.
 */

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

const servers: RunningServer[] = [];

async function start(app: Express): Promise<RunningServer> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const running: RunningServer = {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  servers.push(running);
  return running;
}

/** Minimal {@link Env} carrying just the fields {@link createBackendApp} reads. */
function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AI_PROVIDER: "anthropic",
    ALLOWED_ORIGIN: ["http://localhost:5173"],
    PUBLIC_URL: "http://localhost:3001",
    RATE_LIMIT_RPM: 20,
    SESSION_SECRET: "integration-test-session-secret",
    ...overrides,
  } as Env;
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** A mock model that emits a single client-side `flyTo` tool call. */
function flyToModel(): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "flyTo",
            input: JSON.stringify({ latitude: 48.8566, longitude: 2.3522 }),
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: "tool-calls" },
            usage: USAGE,
          },
        ],
      }),
    }),
  });
}

const oneUserMessage = {
  messages: [{ role: "user", parts: [{ type: "text", text: "fly to Paris" }] }],
};

function postChat(url: string, body: unknown, origin?: string) {
  return fetch(`${url}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

describe("backend app — /health", () => {
  it("reports status and provider", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel() }));

    const res = await fetch(`${url}/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      provider: "anthropic",
      providerConfigured: true,
    });
  });

  it("reports providerConfigured: false when no model is resolved", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: undefined }));

    const res = await fetch(`${url}/health`);

    expect(await res.json()).toMatchObject({ providerConfigured: false });
  });
});

describe("backend app — /api/tools", () => {
  it("lists the real registry's tool names", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel() }));

    const res = await fetch(`${url}/api/tools`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: { name: string; description?: string }[] };
    // flyTo is part of ENABLED_CESIUM_TOOLS, so the real registry always
    // includes it — see createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS }).
    const names = body.tools.map((t) => t.name);
    expect(names).toContain("flyTo");
    expect(body.tools.every((t) => typeof t.name === "string")).toBe(true);
  });

  it("is rate-limited the same as /api/chat", async () => {
    const { url } = await start(
      createBackendApp({ env: fakeEnv({ RATE_LIMIT_RPM: 2 }), model: flyToModel() }),
    );

    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${url}/api/tools`);
      statuses.push(res.status);
      await res.text();
    }

    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(200);
    expect(statuses[2]).toBe(429);
  });

  it("reports mcpApp widget metadata for a tool that declared one", async () => {
    const mcp = fakeMcpToolsHandle({
      tools: {
        mcp__ion__launch_importer: {
          description: "Launches the importer",
          mcpApp: { resourceUri: "ui://ion/importer" },
        } as never,
      },
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/tools`);
    const body = (await res.json()) as {
      tools: { name: string; mcpApp?: { resourceUri: string } }[];
    };

    const ionTool = body.tools.find((t) => t.name === "mcp__ion__launch_importer");
    expect(ionTool?.mcpApp).toEqual({ resourceUri: "ui://ion/importer" });
    expect(body.tools.find((t) => t.name === "flyTo")?.mcpApp).toBeUndefined();
  });
});

describe("backend app — CORS", () => {
  it("reflects an allowed origin on the chat response", async () => {
    const { url } = await start(
      createBackendApp({
        env: fakeEnv({ ALLOWED_ORIGIN: ["http://localhost:5173"] }),
        model: flyToModel(),
      }),
    );

    const res = await postChat(url, oneUserMessage, "http://localhost:5173");

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    await res.text();
  });
});

describe("backend app — chat pipeline with the real tool registry", () => {
  it("streams a flyTo tool call sourced from ENABLED_CESIUM_TOOLS", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel() }));

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    // The model emits a `flyTo` call; it only reaches the stream because the
    // real registry (createCesiumTools({ enabled: ENABLED_CESIUM_TOOLS })) the
    // app composes actually defines that tool.
    expect(await res.text()).toContain("flyTo");
  });

  it("returns 400 NOT_CONFIGURED when no model is configured", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: undefined }));

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("NOT_CONFIGURED");
  });
});

describe("backend app — rate limiting is wired ahead of the chat router", () => {
  it("returns 429 once the per-IP limit is exceeded", async () => {
    const { url } = await start(
      createBackendApp({ env: fakeEnv({ RATE_LIMIT_RPM: 2 }), model: flyToModel() }),
    );

    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await postChat(url, oneUserMessage);
      statuses.push(res.status);
      await res.text();
    }

    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(200);
    expect(statuses[2]).toBe(429);
  });
});

/** Minimal {@link SessionMcpManager} stub — the real implementation is unit-tested separately (session-mcp-manager.test.ts). */
function fakeSessionMcpManager(overrides: Partial<SessionMcpManager> = {}): SessionMcpManager {
  return {
    connect: async () => ({ authorizationUrl: "https://auth.example.com/authorize" }),
    completeCallback: async () => ({ connected: true, serverName: "ion" }),
    cancelPending: async () => undefined,
    consumeLastError: async () => undefined,
    getSessionTools: async () => ({}),
    getSessionClient: async () => undefined,
    isConnected: async () => false,
    serverNames: ["ion"],
    disconnect: async () => {},
    disconnectSession: async () => {},
    closeAll: async () => {},
    ...overrides,
  };
}

/** Minimal {@link McpToolsHandle} stub — the real implementation is unit-tested separately (create-mcp-tools.test.ts). */
function fakeMcpToolsHandle(overrides: Partial<McpToolsHandle> = {}): McpToolsHandle {
  return {
    tools: {},
    servers: [],
    authRequiredServers: [],
    getClient: () => undefined,
    close: async () => {},
    ...overrides,
  };
}

describe("backend app — /api/mcp session routes", () => {
  it("requires SESSION_SECRET when session-scoped MCP is enabled", () => {
    expect(() =>
      createBackendApp({
        env: fakeEnv({ SESSION_SECRET: undefined }),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager(),
      }),
    ).toThrow(/SESSION_SECRET must be set/);
  });

  it("is not mounted at all when sessionMcp is not provided", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel() }));

    const res = await fetch(`${url}/api/mcp/session/servers`);

    expect(res.status).toBe(404);
  });

  it("lists the configured session-connectable server names", async () => {
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager(),
      }),
    );

    const res = await fetch(`${url}/api/mcp/session/servers`);

    expect(await res.json()).toEqual({ servers: ["ion"] });
  });

  it("begins a connect flow and returns the authorization URL", async () => {
    const connect = vi.fn(async () => ({ authorizationUrl: "https://auth.example.com/authorize" }));
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ connect }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/ion/connect`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authorizationUrl: "https://auth.example.com/authorize" });
    expect(connect).toHaveBeenCalledWith(expect.any(String), "ion");
  });

  it("404s for an unknown server name", async () => {
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager(),
      }),
    );

    const res = await fetch(`${url}/api/mcp/unknown/connect`, { method: "POST" });

    expect(res.status).toBe(404);
  });

  it("reports connection status", async () => {
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ isConnected: async () => true }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/ion/status`);

    expect(await res.json()).toEqual({ connected: true });
  });

  it("reports the last recorded failure reason only while NOT connected", async () => {
    const consumeLastError = vi.fn(async () => "Authorization was denied: access_denied");
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ isConnected: async () => false, consumeLastError }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/ion/status`);

    expect(await res.json()).toEqual({
      connected: false,
      error: "Authorization was denied: access_denied",
    });
    expect(consumeLastError).toHaveBeenCalledWith(expect.any(String), "ion");
  });

  it("renders the result page directly (no redirect), completing the flow via the shared, server-name-agnostic route", async () => {
    const completeCallback = vi.fn(async () => ({ connected: true as const, serverName: "ion" }));
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ completeCallback }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/callback?code=abc&state=xyz`, { redirect: "manual" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('"server":"ion"');
    expect(html).toContain('"connected":true');
    expect(completeCallback).toHaveBeenCalledWith(expect.any(String), "abc", "xyz");
  });

  it("escapes provider-controlled text embedded in the result page so it can't break out of the inline script", async () => {
    const cancelPending = vi.fn(async () => "ion");
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ cancelPending }),
      }),
    );

    const attack = `denied</script><script>globalThis.compromised=true</script>`;
    const res = await fetch(
      `${url}/api/mcp/callback?error=access_denied&error_description=${encodeURIComponent(attack)}`,
      { redirect: "manual" },
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    // The raw, unescaped attack payload must never appear verbatim in the
    // response — `</script>` (in any case a naive check might miss) is
    // rewritten to `\u003c/script>` so it can't terminate the inline script
    // block early and inject markup.
    expect(html).not.toContain(attack);
    expect(html.match(/<script>/gi)?.length).toBe(1);
    expect(cancelPending).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      `Authorization was denied: ${attack}`,
    );
  });

  it("cancels the pending flow when the provider denies consent, recording the denial reason", async () => {
    const cancelPending = vi.fn(async () => "ion");
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ cancelPending }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/callback?error=access_denied&state=xyz`, {
      redirect: "manual",
    });

    expect(cancelPending).toHaveBeenCalledWith(
      expect.any(String),
      "xyz",
      "Authorization was denied: access_denied",
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('"server":"ion"');
    expect(html).toContain('"connected":false');
  });

  it("disconnects a server", async () => {
    const disconnect = vi.fn(async () => {});
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ disconnect }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/ion/disconnect`, { method: "POST" });

    expect(await res.json()).toEqual({ connected: false });
    expect(disconnect).toHaveBeenCalledWith(expect.any(String), "ion");
  });
});

describe("backend app — /api/mcp-app routes", () => {
  it("is not mounted at all when neither mcp nor sessionMcp is provided", async () => {
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel() }));

    const res = await fetch(`${url}/api/mcp-app/resource?server=ion&uri=ui://ion/importer`);

    expect(res.status).toBe(404);
  });

  it("fetches a widget's ui:// resource via the resolved MCPClient", async () => {
    const readResource = vi.fn(async () => ({
      contents: [
        {
          uri: "ui://ion/importer",
          mimeType: "text/html;profile=mcp-app",
          text: "<html><body>Importer</body></html>",
        },
      ],
    }));
    const mcp = fakeMcpToolsHandle({
      getClient: (server) => (server === "ion" ? ({ readResource } as never) : undefined),
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/resource?server=ion&uri=ui://ion/importer`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contents: [
        {
          uri: "ui://ion/importer",
          mimeType: "text/html;profile=mcp-app",
          text: "<html><body>Importer</body></html>",
        },
      ],
    });
    expect(readResource).toHaveBeenCalledWith({
      uri: "ui://ion/importer",
      options: { timeout: 30_000, maxTotalTimeout: 30_000 },
    });
  });

  it("returns 502 when the MCP server rejects a resource read", async () => {
    const readResource = vi.fn(async () => {
      throw new Error("resource unavailable");
    });
    const mcp = fakeMcpToolsHandle({
      getClient: () => ({ readResource }) as never,
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/resource?server=ion&uri=ui://ion/importer`);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "resource unavailable" });
  });

  it("warns when a resource changes between reads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const readResource = vi
      .fn()
      .mockResolvedValueOnce({ contents: [{ uri: "ui://ion/importer", text: "first" }] })
      .mockResolvedValueOnce({ contents: [{ uri: "ui://ion/importer", text: "changed" }] });
    const mcp = fakeMcpToolsHandle({
      getClient: () => ({ readResource }) as never,
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    await fetch(`${url}/api/mcp-app/resource?server=ion&uri=ui://ion/importer`);
    await fetch(`${url}/api/mcp-app/resource?server=ion&uri=ui://ion/importer`);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("changed since it was first loaded"));
  });

  it("rejects a non-ui:// resource uri", async () => {
    const mcp = fakeMcpToolsHandle();
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(
      `${url}/api/mcp-app/resource?server=ion&uri=${encodeURIComponent("https://evil.example.com")}`,
    );

    expect(res.status).toBe(400);
  });

  it("404s a resource request for an unknown/unconnected server", async () => {
    const mcp = fakeMcpToolsHandle();
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/resource?server=unknown&uri=ui://unknown/x`);

    expect(res.status).toBe(404);
  });

  it("calls a known tool on the resolved server via the widget bridge", async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: "text", text: "done" }] }));
    const mcp = fakeMcpToolsHandle({
      tools: { mcp__ion__launch_importer: {} as never },
      getClient: (server) => (server === "ion" ? ({ callTool } as never) : undefined),
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server: "ion", toolName: "launch_importer", arguments: { id: 1 } }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ content: [{ type: "text", text: "done" }] });
    expect(callTool).toHaveBeenCalledWith({
      name: "launch_importer",
      arguments: { id: 1 },
      options: { timeout: 30_000, maxTotalTimeout: 30_000 },
    });
  });

  it("rejects a tool call for a tool not in this request's resolved tool registry", async () => {
    const callTool = vi.fn();
    const mcp = fakeMcpToolsHandle({
      tools: { mcp__ion__launch_importer: {} as never },
      getClient: () => ({ callTool }) as never,
    });
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server: "ion", toolName: "delete_everything" }),
    });

    expect(res.status).toBe(404);
    expect(callTool).not.toHaveBeenCalled();
  });

  it("rejects a malformed tool-call request body", async () => {
    const mcp = fakeMcpToolsHandle();
    const { url } = await start(createBackendApp({ env: fakeEnv(), model: flyToModel(), mcp }));

    const res = await fetch(`${url}/api/mcp-app/tool-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server: "ion" }),
    });

    expect(res.status).toBe(400);
  });
});
