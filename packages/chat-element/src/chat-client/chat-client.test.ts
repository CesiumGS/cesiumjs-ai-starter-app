import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatClient, NOT_CONFIGURED_MESSAGE, type ChatClientOptions } from "./index.js";

/**
 * Unit tests for the streaming chat client. We stub the global `fetch` with
 * canned `Response`s whose bodies are `ReadableStream`s of the AI SDK UI message
 * stream (SSE `data:` lines), so the full parse → render → tool-call → re-request
 * loop runs without a browser or a backend.
 */

/** Build a streaming SSE Response from a list of UI message stream chunks. */
function sseResponse(chunks: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n"));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** Create a ChatClient with spy callbacks; override `onToolCall` as needed. */
function makeClient(overrides: Partial<ChatClientOptions> = {}) {
  const onUpdate = vi.fn();
  const onError = vi.fn();
  const onToolCall = vi.fn().mockResolvedValue({ success: true });
  const client = new ChatClient({
    api: "http://backend.test/api/chat",
    onUpdate,
    onError,
    onToolCall,
    ...overrides,
  });
  return { client, onUpdate, onError, onToolCall };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatClient — text streaming", () => {
  it("appends streamed text deltas into an assistant message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            { type: "text-start", id: "0" },
            { type: "text-delta", id: "0", delta: "Bon" },
            { type: "text-delta", id: "0", delta: "jour" },
            { type: "finish" },
          ]),
        ),
    );

    const { client } = makeClient();
    client.input = "salut";
    await client.submit();

    expect(client.isLoading).toBe(false);
    expect(client.messages).toHaveLength(2);
    expect(client.messages[0]).toMatchObject({ role: "user", content: "salut" });
    expect(client.messages[1]).toMatchObject({ role: "assistant", content: "Bonjour" });
  });
});

describe("ChatClient — client-side tool calls", () => {
  it("runs the tool call, then re-requests so the model can continue", async () => {
    const fetchMock = vi
      .fn()
      // First turn: the model asks the client to run flyTo.
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "flyTo",
            input: { latitude: 48.8566, longitude: 2.3522 },
          },
          { type: "finish" },
        ]),
      )
      // Second turn (after the tool result is posted back): a text confirmation.
      .mockResolvedValueOnce(
        sseResponse([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "Done." },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { client, onToolCall } = makeClient();
    client.input = "fly to Paris";
    await client.submit();

    // The client executed the tool with the streamed args...
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith({
      toolCallId: "call-1",
      toolName: "flyTo",
      args: { latitude: 48.8566, longitude: 2.3522 },
    });

    // ...and made a second request to continue the agent loop.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({ state: "result", result: { success: true } });

    // The continuation request carried the tool result back to the server.
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const partTypes = secondBody.messages.flatMap((m: { parts: Array<{ type: string }> }) =>
      m.parts.map((p) => p.type),
    );
    expect(partTypes).toContain("tool-flyTo");
    expect(client.isLoading).toBe(false);
  });
});

describe("ChatClient — tool call errors", () => {
  it("resolves a tool-input-error without ever calling onToolCall", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-error",
            toolCallId: "call-1",
            toolName: "flyTo",
            input: { latitude: 999 },
            errorText: "latitude out of range",
          },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "Sorry about that." },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { client, onToolCall } = makeClient();
    client.input = "fly to nowhere";
    await client.submit();

    // Invalid args never reached the client executor...
    expect(onToolCall).not.toHaveBeenCalled();

    // ...but the invocation is still recorded, resolved with the server's error...
    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({
      state: "result",
      result: { error: "latitude out of range" },
    });

    // ...and the loop continued so the model could respond to the failure.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.isLoading).toBe(false);
  });

  it("resolves a tool-output-error for an already-available tool call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "someServerTool",
            input: { foo: "bar" },
          },
          { type: "tool-output-error", toolCallId: "call-1", errorText: "boom" },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "That failed." },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { client, onToolCall } = makeClient();
    client.input = "run the server tool";
    await client.submit();

    // Already resolved server-side — the client never runs it as a client-side tool.
    expect(onToolCall).not.toHaveBeenCalled();

    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({ state: "result", result: { error: "boom" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ChatClient — server-resolved tool results", () => {
  it("fires onServerToolResult with { toolCallId, toolName, output } for a tool-output-available chunk", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "executeCesiumCode",
            input: { intent: "fly to Paris" },
          },
          {
            type: "tool-output-available",
            toolCallId: "call-1",
            output: { code: "// noop" },
          },
          { type: "finish" },
        ]),
      )
      // The invocation was already resolved server-side by the time
      // resolveClientToolCalls runs, but a pending call still triggers the
      // usual continuation request so the model can see the (already
      // available) result and respond.
      .mockResolvedValueOnce(sseResponse([{ type: "finish" }]));
    vi.stubGlobal("fetch", fetchMock);

    const onServerToolResult = vi.fn();
    const { client } = makeClient({ onServerToolResult });
    client.input = "run some code";
    await client.submit();

    expect(onServerToolResult).toHaveBeenCalledTimes(1);
    expect(onServerToolResult).toHaveBeenCalledWith({
      toolCallId: "call-1",
      toolName: "executeCesiumCode",
      output: { code: "// noop" },
    });

    // The continuation request happened because a pending call existed, not
    // because onServerToolResult itself asked for one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("applies a ToolExecutionOutcome's result and sends a follow-up request when continueConversation is set", async () => {
    // Simulates a `needsApproval`-gated tool (like `executeCesiumCode`): the
    // `tool-input-available` chunk that recorded this invocation streamed in
    // an earlier, already-finished turn, so this turn's stream carries only
    // `tool-output-available` — `pendingToolCalls`/`pendingApprovals` are both
    // empty this pass, so only `continueConversation` can drive a follow-up.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          { type: "tool-output-available", toolCallId: "call-1", output: { code: "// noop" } },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "Looks like that crashed, sorry!" },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    // A host that ran the server-verified code locally and found it threw at
    // runtime — a ground truth the server's static verification never saw.
    const onServerToolResult = vi.fn().mockResolvedValue({
      result: { code: "// noop", executionError: "ReferenceError: foo is not defined" },
      continueConversation: true,
    });
    const { client } = makeClient({ onServerToolResult });

    client.messages.push({
      id: "msg-0",
      role: "assistant",
      content: "",
      toolInvocations: [
        {
          toolCallId: "call-1",
          toolName: "executeCesiumCode",
          args: { intent: "fly to Paris" },
          state: "call",
        },
      ],
    });

    client.input = "run some code";
    await client.submit();

    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({
      state: "result",
      result: { code: "// noop", executionError: "ReferenceError: foo is not defined" },
    });

    // A follow-up request was sent so the model sees the runtime failure and
    // can react to it, even though there was no pending client tool call or
    // approval driving the continuation.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "Looks like that crashed, sorry!",
    });
  });

  it("does not send a follow-up request when a ToolExecutionOutcome omits continueConversation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          { type: "tool-output-available", toolCallId: "call-1", output: { code: "// noop" } },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onServerToolResult = vi
      .fn()
      .mockResolvedValue({ result: { code: "// noop", executed: true } });
    const { client } = makeClient({ onServerToolResult });

    client.messages.push({
      id: "msg-0",
      role: "assistant",
      content: "",
      toolInvocations: [
        {
          toolCallId: "call-1",
          toolName: "executeCesiumCode",
          args: { intent: "fly to Paris" },
          state: "call",
        },
      ],
    });

    client.input = "run some code";
    await client.submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.isLoading).toBe(false);
  });

  it("does not throw when onServerToolResult is omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          sseResponse([
            {
              type: "tool-input-available",
              toolCallId: "call-1",
              toolName: "executeCesiumCode",
              input: { intent: "fly to Paris" },
            },
            {
              type: "tool-output-available",
              toolCallId: "call-1",
              output: { code: "// noop" },
            },
            { type: "finish" },
          ]),
        )
        .mockResolvedValueOnce(sseResponse([{ type: "finish" }])),
    );

    const { client, onError } = makeClient();
    client.input = "run some code";
    await expect(client.submit()).resolves.not.toThrow();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a thrown onServerToolResult error via onError without blocking the stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          sseResponse([
            {
              type: "tool-input-available",
              toolCallId: "call-1",
              toolName: "executeCesiumCode",
              input: { intent: "fly to Paris" },
            },
            {
              type: "tool-output-available",
              toolCallId: "call-1",
              output: { code: "// noop" },
            },
            { type: "finish" },
          ]),
        )
        .mockResolvedValueOnce(sseResponse([{ type: "finish" }])),
    );

    const onServerToolResult = vi.fn().mockRejectedValue(new Error("sandbox exploded"));
    const { client, onError } = makeClient({ onServerToolResult });
    client.input = "run some code";
    await client.submit();

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(client.isLoading).toBe(false);
  });
});

describe("ChatClient — needsApproval human-in-the-loop", () => {
  it("approves a gated call, resends with approval-responded, then applies the result", async () => {
    const fetchMock = vi
      .fn()
      // First turn: the model asks to run executeCesiumCode, then the server
      // pauses for approval instead of executing.
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "executeCesiumCode",
            input: { intent: "fly to Paris" },
          },
          {
            type: "tool-approval-request",
            toolCallId: "call-1",
            approvalId: "approval-1",
          },
          { type: "finish" },
        ]),
      )
      // Second turn: server sees the approval, runs execute(), streams the result.
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-output-available",
            toolCallId: "call-1",
            output: { code: "// noop" },
          },
          { type: "finish" },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onApprovalRequired = vi.fn().mockResolvedValue({ approved: true });
    const { client } = makeClient({ onApprovalRequired });
    client.input = "run some code";
    await client.submit();

    expect(onApprovalRequired).toHaveBeenCalledWith({
      toolCallId: "call-1",
      toolName: "executeCesiumCode",
      args: { intent: "fly to Paris" },
    });

    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({
      state: "result",
      result: { code: "// noop" },
    });

    // The continuation request carried the approval decision back to the server.
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const approvalPart = secondBody.messages
      .flatMap((m: { parts: Array<Record<string, unknown>> }) => m.parts)
      .find((p: Record<string, unknown>) => p.type === "tool-executeCesiumCode");
    expect(approvalPart).toMatchObject({
      state: "approval-responded",
      approval: { id: "approval-1", approved: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("denies a gated call and applies the tool-output-denied result without running execute", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "executeCesiumCode",
            input: { intent: "delete everything" },
          },
          {
            type: "tool-approval-request",
            toolCallId: "call-1",
            approvalId: "approval-1",
          },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([{ type: "tool-output-denied", toolCallId: "call-1" }, { type: "finish" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onApprovalRequired = vi
      .fn()
      .mockResolvedValue({ approved: false, reason: "Declined by the user." });
    const { client } = makeClient({ onApprovalRequired });
    client.input = "run some code";
    await client.submit();

    const invocation = client.messages
      .flatMap((m) => m.toolInvocations ?? [])
      .find((t) => t.toolCallId === "call-1");
    expect(invocation).toMatchObject({
      state: "result",
      result: { error: "Tool call was declined." },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed (denies) when no onApprovalRequired handler is configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "executeCesiumCode",
            input: { intent: "fly to Paris" },
          },
          {
            type: "tool-approval-request",
            toolCallId: "call-1",
            approvalId: "approval-1",
          },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(sseResponse([{ type: "finish" }]));
    vi.stubGlobal("fetch", fetchMock);

    // No onApprovalRequired override — the default client has none configured.
    const { client } = makeClient();
    client.input = "run some code";
    await client.submit();

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const approvalPart = secondBody.messages
      .flatMap((m: { parts: Array<Record<string, unknown>> }) => m.parts)
      .find((p: Record<string, unknown>) => p.type === "tool-executeCesiumCode");
    expect(approvalPart).toMatchObject({
      state: "approval-responded",
      approval: { id: "approval-1", approved: false },
    });
  });

  it("fails closed (denies) when onApprovalRequired throws, and reports the error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "executeCesiumCode",
            input: { intent: "fly to Paris" },
          },
          {
            type: "tool-approval-request",
            toolCallId: "call-1",
            approvalId: "approval-1",
          },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(sseResponse([{ type: "finish" }]));
    vi.stubGlobal("fetch", fetchMock);

    const onApprovalRequired = vi.fn().mockRejectedValue(new Error("dialog crashed"));
    const { client, onError } = makeClient({ onApprovalRequired });
    client.input = "run some code";
    await client.submit();

    expect(onError).toHaveBeenCalled();
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const approvalPart = secondBody.messages
      .flatMap((m: { parts: Array<Record<string, unknown>> }) => m.parts)
      .find((p: Record<string, unknown>) => p.type === "tool-executeCesiumCode");
    expect(approvalPart).toMatchObject({
      state: "approval-responded",
      approval: { id: "approval-1", approved: false, reason: "dialog crashed" },
    });
  });
});

describe("ChatClient — stop()", () => {
  it("does not resolve pending tool calls or continue the loop after stop()", async () => {
    const onToolCall = vi.fn().mockResolvedValue({ success: true });
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "tool-input-available",
              toolCallId: "call-1",
              toolName: "flyTo",
              input: { latitude: 48.8566, longitude: 2.3522 },
            })}\n`,
          ),
        );
        // Deliberately never closes — the read is interrupted by abort() below.
      },
    });
    const response = new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

    // Real fetch wires the AbortSignal into the body read; the mock has to do
    // that by hand — abort the signal and the in-flight reader.read() (which
    // never otherwise resolves, since the stream never closes) rejects.
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        controllerRef?.error(err);
      });
      return Promise.resolve(response);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { client } = makeClient({ onToolCall });
    client.input = "fly to Paris";
    const submitPromise = client.submit();

    // Let the tool-input-available chunk get parsed into a pending tool call.
    await vi.waitFor(() => expect(client.messages.at(-1)?.toolInvocations).toHaveLength(1));

    client.stop();
    await submitPromise;

    expect(onToolCall).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.isLoading).toBe(false);
  });
});

describe("ChatClient — sequential tool resolution", () => {
  it("resolves multiple pending tool calls one at a time, not concurrently", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxConcurrent = 0;
    const onToolCall = vi.fn(async ({ toolCallId }: { toolCallId: string }) => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      order.push(`start:${toolCallId}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end:${toolCallId}`);
      inFlight--;
      return { success: true };
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: "flyTo",
            input: { latitude: 1, longitude: 1 },
          },
          {
            type: "tool-input-available",
            toolCallId: "call-2",
            toolName: "flyTo",
            input: { latitude: 2, longitude: 2 },
          },
          { type: "finish" },
        ]),
      )
      .mockResolvedValueOnce(sseResponse([{ type: "finish" }]));
    vi.stubGlobal("fetch", fetchMock);

    const { client } = makeClient({ onToolCall });
    client.input = "fly to two places";
    await client.submit();

    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(["start:call-1", "end:call-1", "start:call-2", "end:call-2"]);
  });
});

describe("ChatClient — error handling", () => {
  it("surfaces a NOT_CONFIGURED response as the friendly setup message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "NOT_CONFIGURED", message: "no key" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { client, onError } = makeClient();
    client.input = "hello";
    await client.submit();

    expect(client.isLoading).toBe(false);
    const last = client.messages.at(-1);
    expect(last).toMatchObject({ role: "assistant", error: true, content: NOT_CONFIGURED_MESSAGE });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("treats a 200 HTML response (wrong origin) as an error rather than an empty stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><title>SPA</title>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const { client, onError } = makeClient();
    client.input = "hello";
    await client.submit();

    expect(client.isLoading).toBe(false);
    const last = client.messages.at(-1);
    expect(last?.error).toBe(true);
    expect(last?.content).toMatch(/HTML page instead of a chat stream/i);
    expect(onError).toHaveBeenCalledOnce();
  });
});
