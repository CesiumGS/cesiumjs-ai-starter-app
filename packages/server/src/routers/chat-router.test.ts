import { afterEach, describe, expect, it, vi } from "vitest";
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

/**
 * Same as {@link flyToModel}, but tracks how many times `doStream` ran and
 * would reply with plain text "Done" if the agent loop ever invoked the model
 * again in the same request. Used to prove that a pure client-side tool (no
 * server-side `execute`, like `flyTo`) never gets a same-turn reply chance —
 * unlike a server-executed tool such as `codegenTool` above, its call simply
 * has no result for the loop to continue on within this request at all,
 * regardless of `stopAfterTools`.
 */
function flyToThenTextModel(calls: { count: number }): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => {
      calls.count++;
      if (calls.count === 1) {
        return {
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
        };
      }
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "0" },
            { type: "text-delta", id: "0", delta: "Done" },
            { type: "text-end", id: "0" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE },
          ],
        }),
      };
    },
  });
}

const flyTo = tool({
  description: "Fly the camera to a location.",
  inputSchema: z.object({ latitude: z.number(), longitude: z.number() }),
  // No `execute`: a client-side tool, exactly like the real app's flyTo.
});

/** A server-executed tool standing in for something like `executeCesiumCode`. */
const codegenTool = tool({
  description: "A server-executed tool whose result is not the final outcome.",
  inputSchema: z.object({}),
  execute: async () => ({ code: "ok" }),
});

/**
 * A mock model that calls `codegenTool` on its first `doStream` invocation,
 * then (if the agent loop lets it run again) replies with plain text "Done"
 * on any subsequent invocation. `calls` tracks how many times `doStream` ran,
 * so a test can assert whether the loop stopped after the tool call or
 * continued into a same-turn reply.
 */
function codegenToolThenTextModel(calls: { count: number }): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => {
      calls.count++;
      if (calls.count === 1) {
        return {
          stream: simulateReadableStream({
            initialDelayInMs: null,
            chunkDelayInMs: null,
            chunks: [
              { type: "stream-start", warnings: [] },
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "codegenTool",
                input: JSON.stringify({}),
              },
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: "tool-calls" },
                usage: USAGE,
              },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "0" },
            { type: "text-delta", id: "0", delta: "Done" },
            { type: "text-end", id: "0" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE },
          ],
        }),
      };
    },
  });
}

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

  it("a pure client-side tool (no server execute, like flyTo) never gets a same-turn reply, with or without stopAfterTools", async () => {
    const calls = { count: 0 };
    const { url } = await startChatServer({
      model: flyToThenTextModel(calls),
      tools: { flyTo },
      // Deliberately omitted from stopAfterTools — proving this isn't what
      // stops the loop here; a tool with no `execute` never produces a result
      // for the AI SDK's agent loop to continue on within this request at
      // all, so the model can't reply prematurely regardless.
    });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    expect(res.text).toContain("flyTo");
    expect(res.text).not.toContain("Done");
    expect(calls.count).toBe(1);
  });

  it("without stopAfterTools, lets the model reply in the same turn right after a tool result", async () => {
    const calls = { count: 0 };
    const { url } = await startChatServer({
      model: codegenToolThenTextModel(calls),
      tools: { codegenTool },
    });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Done");
    // The model was invoked a second time to generate the same-turn reply.
    expect(calls.count).toBe(2);
  });

  it("with stopAfterTools, stops the loop right after that tool's result instead of replying", async () => {
    const calls = { count: 0 };
    const { url } = await startChatServer({
      model: codegenToolThenTextModel(calls),
      tools: { codegenTool },
      stopAfterTools: ["codegenTool"],
    });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    expect(res.text).toContain("codegenTool");
    expect(res.text).not.toContain("Done");
    // The model was only invoked once — stopAfterTools prevented the second
    // invocation that would have generated a premature same-turn reply.
    expect(calls.count).toBe(1);
  });

  it("with stopAfterTools + toolApproval, suppresses the model's reply when resuming an approved tool's approval, but still streams the tool's result", async () => {
    const { url } = await startChatServer({
      model: textModel("Premature success!"),
      tools: { codegenTool },
      toolApproval: { codegenTool: "user-approval" },
      stopAfterTools: ["codegenTool"],
    });

    // Simulates the client's second request, resuming right after the user
    // approved a previously-requested `codegenTool` call — the AI SDK's own
    // pre-loop approval resolution runs `codegenTool.execute` for this
    // request (not tracked as a `stopWhen`-visible step, per the doc comment
    // on `suppressTextChunks`), so `hasToolCall`/`stopAfterTools` alone can't
    // catch this case — the router's own approval-resume detection must.
    const resumingApproval = {
      messages: [
        { role: "user", parts: [{ type: "text", text: "do the thing" }] },
        {
          role: "assistant",
          parts: [
            {
              type: "tool-codegenTool",
              toolCallId: "call-1",
              state: "approval-responded",
              input: {},
              approval: { id: "approval-1", approved: true },
            },
          ],
        },
      ],
    };

    const res = await postChat(url, resumingApproval);

    expect(res.status).toBe(200);
    // The tool itself still actually ran and its result still streams to the
    // client, so the frontend can act on it (e.g. run the generated code)...
    expect(res.text).toContain("call-1");
    // ...but the model's same-turn reply — based only on that preliminary
    // result — never reaches the client transcript.
    expect(res.text).not.toContain("Premature success!");
  });
});

describe("createChatRouter — metrics", () => {
  function fakeMetrics() {
    return { recordTokenUsage: vi.fn(), recordRequestDuration: vi.fn() };
  }

  it("records token usage and request duration once the response finishes streaming", async () => {
    const metrics = fakeMetrics();
    const { url } = await startChatServer({ model: textModel("Bonjour!"), tools: {}, metrics });

    const res = await postChat(url, oneUserMessage);
    expect(res.status).toBe(200);

    // Recording happens fire-and-forget after the stream fully settles, slightly after the
    // last response byte reaches this test's `fetch` call — poll briefly rather than assuming
    // it's already happened the instant `postChat` resolves.
    await vi.waitFor(() => expect(metrics.recordTokenUsage).toHaveBeenCalled());

    expect(metrics.recordTokenUsage).toHaveBeenCalledWith({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    });
    expect(metrics.recordRequestDuration).toHaveBeenCalledWith(expect.any(Number));
  });

  it("never throws when metrics is omitted (defaults to a no-op)", async () => {
    const { url } = await startChatServer({ model: textModel("Bonjour!"), tools: {} });

    const res = await postChat(url, oneUserMessage);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Bonjour!");
  });
});
