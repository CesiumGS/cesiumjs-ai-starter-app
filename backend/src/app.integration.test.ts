import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
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
