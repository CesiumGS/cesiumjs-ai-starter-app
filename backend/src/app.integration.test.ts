import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { SessionMcpManager } from "@cesium-ai/mcp-tools";
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
    RATE_LIMIT_RPM: 20,
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
    getSessionTools: async () => ({}),
    isConnected: async () => false,
    serverNames: ["ion"],
    disconnect: async () => {},
    disconnectSession: async () => {},
    closeAll: async () => {},
    ...overrides,
  };
}

describe("backend app — /api/mcp session routes", () => {
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

  it("renders a callback result page and completes the flow via the shared, server-name-agnostic route", async () => {
    const completeCallback = vi.fn(async () => ({ connected: true as const, serverName: "ion" }));
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ completeCallback }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/callback?code=abc&state=xyz`);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("cesium-ai-mcp-oauth");
    expect(completeCallback).toHaveBeenCalledWith(expect.any(String), "abc", "xyz");
  });

  it("escapes provider error text embedded in the callback page script", async () => {
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager(),
      }),
    );

    const attack = `denied</script><script>globalThis.compromised=true</script>`;
    const res = await fetch(
      `${url}/api/mcp/callback?error=access_denied&error_description=${encodeURIComponent(attack)}`,
    );
    const body = await res.text();

    expect(body).not.toContain(JSON.stringify(attack));
    expect(body).toContain("\\u003c/script>");
  });

  it("cancels the pending flow (and reports its server name) when the provider denies consent", async () => {
    const cancelPending = vi.fn(async () => "ion");
    const { url } = await start(
      createBackendApp({
        env: fakeEnv(),
        model: flyToModel(),
        sessionMcp: fakeSessionMcpManager({ cancelPending }),
      }),
    );

    const res = await fetch(`${url}/api/mcp/callback?error=access_denied&state=xyz`);
    const body = await res.text();

    expect(cancelPending).toHaveBeenCalledWith(expect.any(String), "xyz");
    expect(body).toContain('"server":"ion"');
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
