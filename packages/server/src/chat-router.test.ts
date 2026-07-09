import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { tool, simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { createChatRouter, type ChatRouterOptions } from "./chat-router.js";

/**
 * These tests exercise the chat router over a **real HTTP server** with Vitest:
 * an Express app is started on an ephemeral port, requests go through `fetch`,
 * and the streamed response is read back as text. The agent's model is the AI
 * SDK's `MockLanguageModelV4`, so no provider key or network call is involved.
 * This covers the path the Playwright e2e suite deliberately stubs.
 */

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

const servers: RunningServer[] = [];

/** Start an Express app mounting the chat router; tracked for teardown. */
async function startChatServer(options: ChatRouterOptions): Promise<RunningServer> {
  const app = express();
  app.use(express.json());
  app.use(createChatRouter(options));

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

/** POST a JSON body to /api/chat and return the response plus its body text. */
async function postChat(
  url: string,
  body: unknown,
): Promise<{ status: number; contentType: string; text: string }> {
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    text: await res.text(),
  };
}

/** A minimal valid request envelope: one user message in AI SDK UIMessage shape. */
const oneUserMessage = {
  messages: [{ role: "user", parts: [{ type: "text", text: "go to Paris" }] }],
};

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** A mock model that streams a short plain-text answer. */
function textModel(text: string): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "0" },
          { type: "text-delta", id: "0", delta: text },
          { type: "text-end", id: "0" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE },
        ],
      }),
    }),
  });
}

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

const flyTo = tool({
  description: "Fly the camera to a location.",
  inputSchema: z.object({ latitude: z.number(), longitude: z.number() }),
  // No `execute`: a client-side tool, exactly like the real app's flyTo.
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

describe("createChatRouter — request validation", () => {
  it("returns 400 NOT_CONFIGURED when no model is provided", async () => {
    const { url } = await startChatServer({ model: undefined, tools: {} });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(400);
    expect(JSON.parse(res.text)).toMatchObject({ error: "NOT_CONFIGURED" });
  });

  it("returns 400 INVALID_REQUEST for an empty messages array", async () => {
    const { url } = await startChatServer({ model: textModel("hi"), tools: {} });

    const res = await postChat(url, { messages: [] });

    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toBe("INVALID_REQUEST");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 400 INVALID_REQUEST when the body is missing messages", async () => {
    const { url } = await startChatServer({ model: textModel("hi"), tools: {} });

    const res = await postChat(url, { notMessages: true });

    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error).toBe("INVALID_REQUEST");
  });

  it("rejects more than maxMessages messages", async () => {
    const { url } = await startChatServer({ model: textModel("hi"), tools: {}, maxMessages: 2 });

    const tooMany = {
      messages: Array.from({ length: 3 }, () => ({
        role: "user",
        parts: [{ type: "text", text: "hi" }],
      })),
    };
    const res = await postChat(url, tooMany);

    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error).toBe("INVALID_REQUEST");
  });
});

describe("createChatRouter — streaming the agent loop", () => {
  it("streams the model's text answer back as a UI message stream", async () => {
    const { url } = await startChatServer({ model: textModel("Bonjour!"), tools: {} });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    expect(res.contentType).not.toContain("text/html");
    expect(res.text).toContain("Bonjour!");
  });

  it("streams a client-side tool call so the frontend can run it", async () => {
    const { url } = await startChatServer({ model: flyToModel(), tools: { flyTo } });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    // The tool name surfaces in the UI message stream (e.g. a `tool-flyTo` part),
    // which is what the chat client keys its client-side executor off.
    expect(res.text).toContain("flyTo");
  });
});
