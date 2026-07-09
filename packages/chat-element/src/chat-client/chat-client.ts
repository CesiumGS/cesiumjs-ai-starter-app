/**
 * Lightweight streaming chat client that speaks the Vercel AI SDK
 * data stream protocol over a standard fetch POST.
 *
 * Zero framework dependencies — works in any modern browser.
 */

import {
  describeError,
  isNotConfiguredError,
  NOT_CONFIGURED_MESSAGE,
  parseSSELine,
  toRequestParts,
  type ChatError,
} from "./protocol";
import type {
  ChatClientOptions,
  EnsureAssistantMessage,
  Message,
  StreamToolCall,
  StreamToolResult,
  ToolInvocation,
} from "./types";

/**
 * Default hard cap on consecutive server round trips driven by client-resolved
 * tool calls. Without this, a model that keeps emitting tool calls turn after
 * turn would recurse through sendRequest → parseStream → resolveClientToolCalls
 * forever, growing `messages` unboundedly with no way to stop besides `stop()`.
 * Override per-client via {@link ChatClientOptions.maxToolCallRounds}.
 */
export const DEFAULT_MAX_TOOL_CALL_ROUNDS = 8;

export class ChatClient {
  messages: Message[] = [];
  input = "";
  isLoading = false;

  private api: string;
  private onUpdate: () => void;
  private onError: (error: Error) => void;
  private onToolCall: ChatClientOptions["onToolCall"];
  private maxToolCallRounds: number;
  private abortController: AbortController | null = null;
  private nextId = 0;
  private toolCallRound = 0;

  constructor(options: ChatClientOptions) {
    this.api = options.api;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
    this.onToolCall = options.onToolCall;
    this.maxToolCallRounds = options.maxToolCallRounds ?? DEFAULT_MAX_TOOL_CALL_ROUNDS;
  }

  setApi(api: string) {
    this.api = api;
  }

  async submit() {
    const text = this.input.trim();
    if (!text || this.isLoading) return;

    this.input = "";
    this.toolCallRound = 0;
    this.messages.push({
      id: this.genId(),
      role: "user",
      content: text,
    });
    this.onUpdate();

    await this.sendRequest();
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
    this.isLoading = false;
    this.onUpdate();
  }

  private async sendRequest() {
    this.isLoading = true;
    this.onUpdate();

    this.abortController = new AbortController();

    // Build the messages payload in the format the AI SDK server expects.
    const payload = this.messages
      .filter((m) => !m.error)
      .map((m) => ({
        role: m.role,
        parts: toRequestParts(m),
      }));

    let response: Response;
    try {
      response = await fetch(this.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
        signal: this.abortController.signal,
      });
    } catch (err) {
      this.isLoading = false;
      if ((err as Error).name === "AbortError") {
        this.onUpdate();
      } else {
        this.emitError((err as Error).message);
      }
      return;
    }

    if (!response.ok) {
      this.isLoading = false;
      this.emitError(await describeError(response, this.api));
      return;
    }

    // A 200 response that is an HTML page (rather than the chat stream) almost
    // always means the request never reached the backend — e.g. the frontend
    // points `/api/chat` at its own dev server, which answers with the SPA
    // index.html. Parsing that as a stream would silently yield nothing, so we
    // surface it as an error instead of failing quietly.
    if ((response.headers.get("content-type") ?? "").includes("text/html")) {
      this.isLoading = false;
      this.emitError(await describeError(response, this.api));
      return;
    }

    await this.parseStream(response);
  }

  private async parseStream(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) {
      this.isLoading = false;
      this.onUpdate();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let assistantMsg: Message | null = null;
    const pendingToolCalls: ToolInvocation[] = [];

    const ensureAssistantMsg = () => (assistantMsg ??= this.createAssistantMessage());

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // keep incomplete line in buffer

        for (const line of lines) {
          this.handleStreamLine(line, ensureAssistantMsg, pendingToolCalls);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        this.emitError((err as Error).message);
      } else {
        // stop() aborted this request — don't resolve pending tool calls or
        // continue the tool-call loop, or the loop would keep going anyway.
        return;
      }
    }

    await this.resolveClientToolCalls(pendingToolCalls);

    // If there were tool calls, send another request so the model can
    // continue with the results (resolveClientToolCalls above guarantees
    // every entry here is now in "result" state).
    if (pendingToolCalls.length > 0) {
      this.toolCallRound++;
      if (this.toolCallRound > this.maxToolCallRounds) {
        this.emitError(
          `The assistant made ${this.maxToolCallRounds} consecutive tool calls without ` +
            `finishing and was stopped to avoid an infinite loop.`,
        );
        this.isLoading = false;
        this.onUpdate();
        return;
      }
      await this.sendRequest();
      return;
    }

    this.isLoading = false;
    this.onUpdate();
  }

  private createAssistantMessage(): Message {
    const message: Message = {
      id: this.genId(),
      role: "assistant",
      content: "",
      toolInvocations: [],
    };
    this.messages.push(message);
    return message;
  }

  /**
   * Dispatch a single decoded chunk. We act on the chunks this client renders
   * — `text-delta`, `tool-input-available` (a tool call to run client-side),
   * `tool-output-available` (a server-resolved result), `tool-input-error`/
   * `tool-output-error` (a server-side tool failure), and `error` — and
   * ignore lifecycle chunks (`start`, `text-start`/`text-end`, `finish`, …).
   */
  private handleStreamLine(
    line: string,
    ensureAssistantMsg: EnsureAssistantMessage,
    pendingToolCalls: ToolInvocation[],
  ) {
    const chunk = parseSSELine(line);
    if (!chunk) return;

    switch (chunk.type) {
      case "text-delta":
        this.appendTextDelta(chunk.delta ?? "", ensureAssistantMsg);
        break;
      case "tool-input-available":
        this.addToolCall(
          { toolCallId: chunk.toolCallId!, toolName: chunk.toolName!, args: chunk.input },
          ensureAssistantMsg,
          pendingToolCalls,
        );
        break;
      case "tool-output-available":
        this.applyToolResult(
          { toolCallId: chunk.toolCallId!, result: chunk.output },
          ensureAssistantMsg,
        );
        break;
      case "tool-input-error":
        // Fires instead of `tool-input-available` when the model's arguments
        // fail validation — no invocation exists yet, so create one before
        // resolving it, or applyToolResult below would find nothing to update.
        this.addToolCall(
          { toolCallId: chunk.toolCallId!, toolName: chunk.toolName!, args: chunk.input },
          ensureAssistantMsg,
          pendingToolCalls,
        );
        this.applyToolResult(
          {
            toolCallId: chunk.toolCallId!,
            result: { error: chunk.errorText ?? "Tool call failed" },
          },
          ensureAssistantMsg,
        );
        break;
      case "tool-output-error":
        this.applyToolResult(
          {
            toolCallId: chunk.toolCallId!,
            result: { error: chunk.errorText ?? "Tool call failed" },
          },
          ensureAssistantMsg,
        );
        break;
      case "error":
        this.emitError(chunk.errorText ?? "Stream error");
        break;
      // `start`, `text-start`/`text-end`, `tool-input-start`, `finish`, … are
      // lifecycle markers with nothing to render — let the stream carry on.
    }
  }

  private appendTextDelta(text: string, ensureAssistantMsg: EnsureAssistantMessage) {
    const message = ensureAssistantMsg();
    message.content += text;
    this.onUpdate();
  }

  private addToolCall(
    toolCall: StreamToolCall,
    ensureAssistantMsg: EnsureAssistantMessage,
    pendingToolCalls: ToolInvocation[],
  ) {
    const message = ensureAssistantMsg();
    const invocation: ToolInvocation = {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: toolCall.args,
      state: "call",
    };

    message.toolInvocations!.push(invocation);
    pendingToolCalls.push(invocation);
    this.onUpdate();
  }

  private applyToolResult(result: StreamToolResult, ensureAssistantMsg: EnsureAssistantMessage) {
    const message = ensureAssistantMsg();
    const invocation = message.toolInvocations!.find(
      (tool) => tool.toolCallId === result.toolCallId,
    );

    if (invocation) {
      invocation.state = "result";
      invocation.result = result.result;
    }

    this.onUpdate();
  }

  private async resolveClientToolCalls(pendingToolCalls: ToolInvocation[]) {
    // Resolved sequentially, not with Promise.all — concurrent calls to
    // viewer tools like flyTo would race on shared Viewer/Camera state.
    for (const invocation of pendingToolCalls) {
      if (invocation.state !== "call") continue;

      try {
        invocation.result = await this.onToolCall({
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          args: invocation.args,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        invocation.result = { error: message };
        this.onError(new Error(message));
      }

      invocation.state = "result";
      this.onUpdate();
    }
  }

  private emitError(error: ChatError | string) {
    const chatError: ChatError = typeof error === "string" ? { message: error } : error;
    this.messages.push({
      id: this.genId(),
      role: "assistant",
      content: isNotConfiguredError(chatError) ? NOT_CONFIGURED_MESSAGE : chatError.message,
      error: true,
    });
    this.onError(new Error(chatError.message));
    this.onUpdate();
  }

  private genId(): string {
    return `msg-${++this.nextId}-${Date.now().toString(36)}`;
  }
}
