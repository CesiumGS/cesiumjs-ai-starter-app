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
  ToolExecutionOutcome,
  ToolInvocation,
} from "./types";

/** A server tool result outcome the host is still computing, tied to the invocation it updates. */
interface PendingServerResult {
  invocation: ToolInvocation;
  promise: Promise<ToolExecutionOutcome | void>;
}

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
  private onServerToolResult: ChatClientOptions["onServerToolResult"];
  private onApprovalRequired: ChatClientOptions["onApprovalRequired"];
  private maxToolCallRounds: number;
  private abortController: AbortController | null = null;
  private nextId = 0;
  private toolCallRound = 0;

  constructor(options: ChatClientOptions) {
    this.api = options.api;
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
    this.onToolCall = options.onToolCall;
    this.onServerToolResult = options.onServerToolResult;
    this.onApprovalRequired = options.onApprovalRequired;
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
        credentials: "include",
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
    const pendingApprovals: ToolInvocation[] = [];
    const pendingServerResults: PendingServerResult[] = [];

    const ensureAssistantMsg = () => (assistantMsg ??= this.createAssistantMessage());

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // keep incomplete line in buffer

        for (const line of lines) {
          this.handleStreamLine(
            line,
            ensureAssistantMsg,
            pendingToolCalls,
            pendingApprovals,
            pendingServerResults,
          );
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
    await this.resolveApprovals(pendingApprovals);
    const continueForServerResults = await this.resolveServerToolOutcomes(pendingServerResults);

    // If there were tool calls or approval decisions to send back, or a host
    // reaction to a server-resolved result asked to continue, make another
    // request so the model can react (the resolve* calls above guarantee
    // every entry here is now resolved).
    if (pendingToolCalls.length > 0 || pendingApprovals.length > 0 || continueForServerResults) {
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
   * `tool-output-error` (a server-side tool failure), `tool-approval-request`/
   * `tool-output-denied` (the `needsApproval` human-in-the-loop gate), and
   * `error` — and ignore lifecycle chunks (`start`, `text-start`/`text-end`,
   * `finish`, …).
   */
  private handleStreamLine(
    line: string,
    ensureAssistantMsg: EnsureAssistantMessage,
    pendingToolCalls: ToolInvocation[],
    pendingApprovals: ToolInvocation[],
    pendingServerResults: PendingServerResult[],
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
        // Note: unlike `tool-input-available`, the `tool-output-available`
        // chunk carries no `toolName` of its own — the tool name was
        // established by the earlier `tool-input-available` chunk for the
        // same `toolCallId`, so we look the invocation back up here.
        this.fireServerToolResult(
          chunk.toolCallId!,
          chunk.output,
          ensureAssistantMsg,
          pendingServerResults,
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
      case "tool-approval-request":
        // The server declared this tool `needsApproval` and paused the agent
        // loop right after `tool-input-available` established its args — the
        // invocation already exists, so we just flag it as awaiting a human
        // decision instead of creating a new one.
        this.addToolApprovalRequest(
          {
            toolCallId: chunk.toolCallId!,
            approvalId: chunk.approvalId!,
            isAutomatic: chunk.isAutomatic,
            signature: chunk.signature,
          },
          ensureAssistantMsg,
          pendingApprovals,
        );
        break;
      case "tool-output-denied":
        // The user (or an `isAutomatic` policy) denied the approval request —
        // the tool's `execute` never ran. Surface it exactly like any other
        // resolved tool result so the transcript and the agent loop both move
        // on; the model sees this and can respond to the decline in text.
        this.applyToolResult(
          {
            toolCallId: chunk.toolCallId!,
            result: { error: "Tool call was declined." },
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

  /**
   * Finds a previously recorded tool invocation by `toolCallId`, searching
   * every assistant message rather than just the one currently being built by
   * `parseStream`. Needed because a `needsApproval`-gated call's `call` /
   * `approval-requested` state is recorded in one HTTP turn's message, but its
   * eventual `tool-output-available`/`tool-output-denied` resolution can
   * arrive in a *later* turn's stream (a fresh `parseStream` call, and
   * therefore a fresh assistant message) once the client resends the approval
   * decision and the server resumes the paused step.
   */
  private findToolInvocation(toolCallId: string): ToolInvocation | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const invocation = this.messages[i].toolInvocations?.find(
        (tool) => tool.toolCallId === toolCallId,
      );
      if (invocation) return invocation;
    }
    return undefined;
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

  /**
   * Flags an already-recorded invocation (added by an earlier
   * `tool-input-available` chunk) as awaiting a human approval decision, and
   * queues it for {@link resolveApprovals}. If no matching invocation exists
   * (shouldn't happen — the server always streams the call before pausing for
   * approval) this is a defensive no-op rather than a thrown error.
   */
  private addToolApprovalRequest(
    approvalRequest: {
      toolCallId: string;
      approvalId: string;
      isAutomatic?: boolean;
      signature?: string;
    },
    ensureAssistantMsg: EnsureAssistantMessage,
    pendingApprovals: ToolInvocation[],
  ) {
    ensureAssistantMsg();
    const invocation = this.findToolInvocation(approvalRequest.toolCallId);
    if (!invocation) return;

    invocation.state = "approval-requested";
    invocation.approval = {
      id: approvalRequest.approvalId,
      isAutomatic: approvalRequest.isAutomatic,
      signature: approvalRequest.signature,
    };
    pendingApprovals.push(invocation);
    this.onUpdate();
  }

  private applyToolResult(result: StreamToolResult, ensureAssistantMsg: EnsureAssistantMessage) {
    ensureAssistantMsg();
    const invocation = this.findToolInvocation(result.toolCallId);

    if (invocation) {
      invocation.state = "result";
      invocation.result = result.result;
    }

    this.onUpdate();
  }

  /**
   * Starts {@link ChatClientOptions.onServerToolResult} for a server-resolved
   * `tool-output-available` chunk, once the invocation it belongs to (whose
   * `toolName` was recorded when its `tool-input-available` chunk arrived) can
   * be found. Doesn't block stream parsing — the callback's promise is queued
   * into `pendingServerResults` and only awaited by
   * {@link resolveServerToolOutcomes} once the current stream finishes, mirroring
   * how `pendingToolCalls`/`pendingApprovals` are resolved after the loop.
   */
  private fireServerToolResult(
    toolCallId: string,
    output: unknown,
    ensureAssistantMsg: EnsureAssistantMessage,
    pendingServerResults: PendingServerResult[],
  ) {
    if (!this.onServerToolResult) return;

    ensureAssistantMsg();
    const invocation = this.findToolInvocation(toolCallId);
    if (!invocation) return;

    const promise = Promise.resolve().then(() =>
      this.onServerToolResult!({ toolCallId, toolName: invocation.toolName, output }),
    );
    pendingServerResults.push({ invocation, promise });
  }

  /**
   * Awaits every queued {@link ChatClientOptions.onServerToolResult} outcome
   * from the just-finished stream. When a host reaction returns a
   * {@link ToolExecutionOutcome}, its `result` replaces the invocation's
   * recorded result (so the next request reflects the real, e.g. runtime,
   * outcome rather than just the server's verification), and its
   * `continueConversation` flag is folded into the return value so the caller
   * knows whether to send a follow-up request. A thrown/rejected callback is
   * reported via `onError`, the same as `resolveClientToolCalls` does for
   * client-side tool errors, and doesn't request a follow-up.
   */
  private async resolveServerToolOutcomes(pending: PendingServerResult[]): Promise<boolean> {
    let shouldContinue = false;

    for (const { invocation, promise } of pending) {
      let outcome: ToolExecutionOutcome | void;
      try {
        outcome = await promise;
      } catch (err) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
        continue;
      }

      if (!outcome) continue;
      invocation.result = outcome.result;
      shouldContinue ||= outcome.continueConversation === true;
      this.onUpdate();
    }

    return shouldContinue;
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

  /**
   * Resolves every `needsApproval`-gated invocation flagged by
   * {@link addToolApprovalRequest} via {@link ChatClientOptions.onApprovalRequired},
   * sequentially (same reasoning as {@link resolveClientToolCalls}: a host
   * showing one confirmation dialog at a time shouldn't have to juggle
   * several at once). Missing handler or a thrown decision both fail closed
   * — denied, with the reason surfaced back to the model — rather than
   * silently letting a gated tool run.
   */
  private async resolveApprovals(pendingApprovals: ToolInvocation[]) {
    for (const invocation of pendingApprovals) {
      if (invocation.state !== "approval-requested") continue;

      let decision: { approved: boolean; reason?: string };
      try {
        decision = this.onApprovalRequired
          ? await this.onApprovalRequired({
              toolCallId: invocation.toolCallId,
              toolName: invocation.toolName,
              args: invocation.args,
            })
          : { approved: false, reason: "No approval handler configured on this host." };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        decision = { approved: false, reason: message };
        this.onError(new Error(message));
      }

      invocation.approval = { ...invocation.approval!, ...decision };
      invocation.state = "approval-responded";
      this.onUpdate();
    }
  }

  /**
   * Public method to emit an error message to the chat transcript.
   * Used for reporting errors that occur outside the normal chat flow
   * (e.g., sandbox execution failures).
   */
  reportError(errorMessage: string) {
    this.messages.push({
      id: this.genId(),
      role: "assistant",
      content: errorMessage,
      error: true,
    });
    this.onError(new Error(errorMessage));
    this.onUpdate();
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
