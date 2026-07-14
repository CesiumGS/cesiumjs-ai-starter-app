import { describe, expect, it } from "vitest";
import {
  describeError,
  isNotConfiguredError,
  NOT_CONFIGURED_MESSAGE,
  parseSSELine,
  toRequestParts,
} from "./protocol.js";
import type { Message } from "./types.js";

/**
 * Unit tests for the AI SDK v5+ UI message stream wire-protocol helpers,
 * isolated from `ChatClient`'s streaming loop (see `chat-client.test.ts` for
 * the end-to-end behaviour these helpers are used by).
 */

describe("parseSSELine", () => {
  it("parses a well-formed data line into its JSON payload", () => {
    const chunk = parseSSELine(`data: {"type":"text-delta","id":"0","delta":"hi"}`);
    expect(chunk).toEqual({ type: "text-delta", id: "0", delta: "hi" });
  });

  it("returns null for the [DONE] terminator", () => {
    expect(parseSSELine("data: [DONE]")).toBeNull();
  });

  it("returns null for lines that don't start with 'data:'", () => {
    expect(parseSSELine("event: message")).toBeNull();
    expect(parseSSELine(": keep-alive comment")).toBeNull();
    expect(parseSSELine("")).toBeNull();
  });

  it("returns null for a blank data line", () => {
    expect(parseSSELine("data:")).toBeNull();
    expect(parseSSELine("data:   ")).toBeNull();
  });

  it("returns null (rather than throwing) for a malformed/truncated JSON payload", () => {
    expect(parseSSELine(`data: {"type":"text-delta`)).toBeNull();
    expect(parseSSELine(`data: not json at all`)).toBeNull();
  });

  it("tolerates leading/trailing whitespace around the JSON payload", () => {
    const chunk = parseSSELine(`data:   {"type":"finish"}   `);
    expect(chunk).toEqual({ type: "finish" });
  });
});

describe("isNotConfiguredError", () => {
  it("is true only for the NOT_CONFIGURED error code", () => {
    expect(isNotConfiguredError({ code: "NOT_CONFIGURED", message: "x" })).toBe(true);
    expect(isNotConfiguredError({ code: "INVALID_REQUEST", message: "x" })).toBe(false);
    expect(isNotConfiguredError({ message: "x" })).toBe(false);
  });
});

describe("describeError", () => {
  it("returns a friendly message when the response is an HTML page (wrong origin)", async () => {
    const response = new Response("<html><body>SPA shell</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const error = await describeError(response, "/api/chat");
    expect(error.message).toContain("returned an HTML page");
    expect(error.message).toContain("/api/chat");
    expect(error.code).toBeUndefined();
  });

  it("parses the server's structured { error, message } JSON envelope", async () => {
    const response = new Response(
      JSON.stringify({ error: "NOT_CONFIGURED", message: NOT_CONFIGURED_MESSAGE }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
    const error = await describeError(response, "/api/chat");
    expect(error.code).toBe("NOT_CONFIGURED");
    expect(error.message).toBe(`NOT_CONFIGURED: ${NOT_CONFIGURED_MESSAGE}`);
  });

  it("falls back to the raw body when it isn't JSON", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
    const error = await describeError(response, "/api/chat");
    expect(error.message).toBe("Internal Server Error");
    expect(error.code).toBeUndefined();
  });

  it("falls back to a generic message when the body is empty", async () => {
    const response = new Response("", { status: 503 });
    const error = await describeError(response, "/api/chat");
    expect(error.message).toBe("The chat request failed (HTTP 503).");
  });

  it("truncates a very long, non-JSON body to 500 chars with an ellipsis", async () => {
    const longBody = "x".repeat(1000);
    const response = new Response(longBody, {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
    const error = await describeError(response, "/api/chat");
    expect(error.message).toHaveLength(501); // 500 chars + "…"
    expect(error.message.endsWith("…")).toBe(true);
  });

  it("falls back to raw body when JSON parses but lacks a message field", async () => {
    const response = new Response(JSON.stringify({ foo: "bar" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
    const error = await describeError(response, "/api/chat");
    expect(error.message).toBe(JSON.stringify({ foo: "bar" }));
    expect(error.code).toBeUndefined();
  });
});

describe("toRequestParts", () => {
  function baseMessage(overrides: Partial<Message> = {}): Message {
    return { id: "m1", role: "user", content: "", ...overrides };
  }

  it("emits a text part for message content", () => {
    const parts = toRequestParts(baseMessage({ content: "hello" }));
    expect(parts).toEqual([{ type: "text", text: "hello" }]);
  });

  it("emits nothing for empty content and no tool invocations", () => {
    expect(toRequestParts(baseMessage())).toEqual([]);
  });

  it("emits an output-available part for a resolved tool invocation", () => {
    const parts = toRequestParts(
      baseMessage({
        toolInvocations: [
          {
            toolCallId: "call-1",
            toolName: "flyTo",
            args: { latitude: 1 },
            result: { success: true },
            state: "result",
          },
        ],
      }),
    );
    expect(parts).toEqual([
      {
        type: "tool-flyTo",
        toolCallId: "call-1",
        state: "output-available",
        input: { latitude: 1 },
        output: { success: true },
      },
    ]);
  });

  it("emits an approval-responded part when a decision has been made", () => {
    const parts = toRequestParts(
      baseMessage({
        toolInvocations: [
          {
            toolCallId: "call-2",
            toolName: "executeCesiumCode",
            args: { intent: "fly to Rome" },
            state: "approval-responded",
            approval: { id: "approval-1", approved: true },
          },
        ],
      }),
    );
    expect(parts).toEqual([
      {
        type: "tool-executeCesiumCode",
        toolCallId: "call-2",
        state: "approval-responded",
        input: { intent: "fly to Rome" },
        approval: { id: "approval-1", approved: true, reason: undefined },
      },
    ]);
  });

  it("emits an input-available part for a call with neither a result nor an approval decision", () => {
    const parts = toRequestParts(
      baseMessage({
        toolInvocations: [
          {
            toolCallId: "call-3",
            toolName: "flyTo",
            args: { latitude: 1 },
            state: "call",
          },
        ],
      }),
    );
    expect(parts).toEqual([
      {
        type: "tool-flyTo",
        toolCallId: "call-3",
        state: "input-available",
        input: { latitude: 1 },
      },
    ]);
  });

  it("falls back to input-available when approval.approved is undefined (decision not yet made)", () => {
    const parts = toRequestParts(
      baseMessage({
        toolInvocations: [
          {
            toolCallId: "call-4",
            toolName: "executeCesiumCode",
            args: { intent: "fly to Rome" },
            state: "approval-responded",
            approval: { id: "approval-2" },
          },
        ],
      }),
    );
    expect(parts).toEqual([
      {
        type: "tool-executeCesiumCode",
        toolCallId: "call-4",
        state: "input-available",
        input: { intent: "fly to Rome" },
      },
    ]);
  });

  it("emits both a text part and tool-invocation parts together, in order", () => {
    const parts = toRequestParts(
      baseMessage({
        content: "fly to Rome",
        toolInvocations: [
          {
            toolCallId: "call-5",
            toolName: "flyTo",
            args: { latitude: 41.9 },
            result: { success: true },
            state: "result",
          },
        ],
      }),
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "text", text: "fly to Rome" });
    expect(parts[1].type).toBe("tool-flyTo");
  });
});
