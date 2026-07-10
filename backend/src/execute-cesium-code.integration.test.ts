import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import type { Env } from "./utils/env.js";

/**
 * Full round-trip integration test for the `executeCesiumCode` pipeline:
 *
 *   intent -> tool-approval-request (needsApproval gate) -> approval-responded
 *   resend -> skill matching -> prompt building -> (mocked) model generation
 *   -> AST verification -> backend tool `execute` -> streamed HTTP result
 *
 * The tool is `needsApproval`-gated (see `./tools/execute-cesium-code-tool.ts`),
 * so each test drives two HTTP requests: the first gets only as far as a
 * `tool-approval-request` chunk (real generation never runs), and the second
 * resends the conversation with an `approval-responded` part — exactly what
 * `@cesium-ai/chat-element`'s `ChatClient` sends once a human approves — which
 * is what actually lets the real `execute` (and thus `generateVerifiedCesiumCode`)
 * run.
 *
 * Every stage between the model call and the HTTP response is REAL:
 *
 *  - the real composed Express app (`createBackendApp`), started on an
 *    ephemeral port and driven over HTTP, exactly like `app.integration.test.ts`;
 *  - the real tool registry, including this app's real
 *    `createExecuteCesiumCodeTool` wired to the real
 *    `@cesium-ai/codegen-cesium#generateVerifiedCesiumCode`;
 *  - the real `matchBestSkill` domain matcher, `buildCodegenPrompt` prompt
 *    builder, and `verifyCesiumCode` AST verifier inside that pipeline.
 *
 * Only two things are mocked, at the narrowest possible boundary:
 *
 *  1. `ai`'s `generateText` — the actual network/LLM call `generateVerifiedCesiumCode`
 *     makes. Everything else `ai` exports (`streamText`, `tool`, `simulateReadableStream`,
 *     ...) is the real implementation via `vi.importActual`.
 *  2. The top-level chat model's `doStream` (via `MockLanguageModelV4`, same as
 *     `app.integration.test.ts`'s `flyToModel`), which drives the agent loop:
 *     step 1 emits an `executeCesiumCode` tool call (causing the real tool's
 *     `execute` — and thus `generateVerifiedCesiumCode` — to run for real),
 *     step 2 emits plain text to end the loop.
 *
 * This proves the six stages genuinely integrate end to end, rather than each
 * only being exercised in isolation by its own unit tests.
 */

const generateTextMock = vi.fn();

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  };
});

const { createBackendApp } = await import("./app.js");
const { simulateReadableStream } = await import("ai");
const { MockLanguageModelV4 } = await import("ai/test");

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
    CHAT_ENABLED: true,
    RATE_LIMIT_RPM: 20,
    ...overrides,
  } as Env;
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/**
 * A deliberately nonsense intent that no vendored CesiumJS skill's
 * description will token-overlap with (mirrors the same trick
 * `generate-verified-cesium-code.test.ts` uses) — this keeps `matchBestSkills`
 * returning no matches, so `generateVerifiedCesiumCode`'s static verification
 * stays unrestricted (aside from the verifier's unconditional bans), independent
 * of the vendored skills data.
 */
const NONSENSE_INTENT = "xyzzy plugh qux totally unrelated nonsense request";

/**
 * A chat model whose first `doStream` call emits a tool call for
 * `executeCesiumCode` with the given `intent`, causing the real tool
 * registry's `execute` (and thus the real `generateVerifiedCesiumCode`
 * pipeline) to run. Because `executeCesiumCode` has a real `execute`
 * (unlike the client-executed `flyTo` tool), the AI SDK agent loop calls the
 * model again with the tool result appended — the second `doStream` call
 * emits plain text to end the loop there rather than looping indefinitely.
 */
function executeCesiumCodeModel(intent: string) {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      step += 1;
      if (step === 1) {
        return {
          stream: simulateReadableStream({
            initialDelayInMs: null,
            chunkDelayInMs: null,
            chunks: [
              { type: "stream-start", warnings: [] },
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "executeCesiumCode",
                input: JSON.stringify({ intent }),
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
            { type: "text-delta", id: "0", delta: "Done." },
            { type: "text-end", id: "0" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: USAGE },
          ],
        }),
      };
    },
  });
}

const oneUserMessage = {
  messages: [{ role: "user", parts: [{ type: "text", text: "do something" }] }],
};

function postChat(url: string, body: unknown) {
  return fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Parses an AI SDK UI message stream response body (`data: {...}\n` lines,
 * terminated by `data: [DONE]`) into its chunks. Minimal stand-in for the
 * frontend's real `parseSSELine` — only used here to pull the `approvalId`
 * back out of a `tool-approval-request` chunk so the test can build the
 * second, approval-carrying request exactly like a real client would.
 */
function parseChunks(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice("data: ".length)) as Record<string, unknown>);
}

beforeEach(() => {
  generateTextMock.mockReset();
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

describe("executeCesiumCode full pipeline — clean, allowlisted generation", () => {
  it("streams { code } from the real tool once the mocked model's output passes real AST verification", async () => {
    // Bare capability-name calls — the generic codegen pipeline runs
    // unrestricted in this sample app, so any free identifier not otherwise
    // banned (see `ast-verifier.ts`) passes verification.
    generateTextMock.mockResolvedValueOnce({
      text: `addEntity({ latitude: 48.8566, longitude: 2.3522, label: "Paris" });`,
    });

    const { url } = await start(
      createBackendApp({ env: fakeEnv(), model: executeCesiumCodeModel(NONSENSE_INTENT) }),
    );

    // First turn: the tool is `needsApproval`-gated, so the real `execute`
    // (and thus `generateVerifiedCesiumCode`) hasn't run yet — the agent loop
    // pauses right after the tool call and asks for a human decision instead.
    const firstRes = await postChat(url, oneUserMessage);
    expect(firstRes.status).toBe(200);
    const firstChunks = parseChunks(await firstRes.text());
    expect(generateTextMock).not.toHaveBeenCalled();
    const approvalRequest = firstChunks.find((c) => c.type === "tool-approval-request");
    expect(approvalRequest).toMatchObject({ toolCallId: "call-1" });

    // Second turn: resend with the approval decision, exactly as
    // `@cesium-ai/chat-element`'s `ChatClient` would — this is what actually
    // lets `execute` run.
    const res = await postChat(url, {
      messages: [
        ...oneUserMessage.messages,
        {
          role: "assistant",
          parts: [
            {
              type: "tool-executeCesiumCode",
              toolCallId: "call-1",
              state: "approval-responded",
              input: { intent: NONSENSE_INTENT },
              approval: { id: approvalRequest!.approvalId, approved: true },
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    const text = await res.text();

    // The real domain matcher/prompt builder/AST verifier ran (not mocked) —
    // only the model call itself (`generateText`) was a stand-in for a real LLM.
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(text).toContain('"code"');
    expect(text).toContain("addEntity");
  });
});

describe("executeCesiumCode full pipeline — verification rejects unsafe generation", () => {
  it("streams { error } and never lets the unsafe code past the real AST verifier", async () => {
    // `eval(...)` is unconditionally banned by the real AST verifier,
    // regardless of the allowlist — see ast-verifier.ts's BANNED_GLOBALS/eval
    // handling. The mock returns this on every attempt so both retry attempts
    // (generateVerifiedCesiumCode's default maxAttempts=2) fail the same way.
    generateTextMock.mockResolvedValue({
      text: `eval("addEntity({ latitude: 1, longitude: 2 });");`,
    });

    const { url } = await start(
      createBackendApp({ env: fakeEnv(), model: executeCesiumCodeModel(NONSENSE_INTENT) }),
    );

    const firstRes = await postChat(url, oneUserMessage);
    const approvalRequest = parseChunks(await firstRes.text()).find(
      (c) => c.type === "tool-approval-request",
    );
    expect(approvalRequest).toMatchObject({ toolCallId: "call-1" });

    const res = await postChat(url, {
      messages: [
        ...oneUserMessage.messages,
        {
          role: "assistant",
          parts: [
            {
              type: "tool-executeCesiumCode",
              toolCallId: "call-1",
              state: "approval-responded",
              input: { intent: NONSENSE_INTENT },
              approval: { id: approvalRequest!.approvalId, approved: true },
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    const text = await res.text();

    // Real generation was retried (maxAttempts defaults to 3) against the real verifier —
    // the eval-based snippet never became code the tool could return.
    expect(generateTextMock).toHaveBeenCalledTimes(3);
    expect(text).toContain('"error"');
    expect(text).toContain("Generated code failed static AST verification");

    // The second (retry) attempt's prompt proves the real verifier's rejection
    // reason (the banned `eval` call) was genuinely fed back into regeneration —
    // not just a canned mock response repeated blindly.
    const secondCallArgs = generateTextMock.mock.calls[1][0] as { prompt: string };
    expect(secondCallArgs.prompt).toMatch(/eval/i);
  });
});
