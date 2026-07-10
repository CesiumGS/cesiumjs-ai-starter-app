export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolInvocations?: ToolInvocation[];
  /** Marks an assistant message that carries an error, for distinct styling. */
  error?: boolean;
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  /**
   * `"approval-requested"` and `"approval-responded"` only occur for tools the
   * backend declared `needsApproval` on (AI SDK's native human-in-the-loop
   * gate): the server pauses the agent loop right after the call's args are
   * known and emits a `tool-approval-request` chunk instead of running the
   * tool. `"approval-requested"` means this client is waiting on
   * {@link ChatClientOptions.onApprovalRequired}; `"approval-responded"` means
   * a decision was made and is queued to go back to the server on the next
   * request.
   */
  state: "call" | "result" | "approval-requested" | "approval-responded";
  result?: unknown;
  /** Populated once a `tool-approval-request` chunk arrives for this call. */
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
    isAutomatic?: boolean;
    signature?: string;
  };
}

export interface ChatClientOptions {
  api: string;
  onUpdate: () => void;
  onError: (error: Error) => void;
  onToolCall: (toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<unknown>;
  /**
   * Optional hook fired whenever a `tool-output-available` chunk arrives — a
   * server-resolved tool result (i.e. a tool with a backend `execute`, as
   * opposed to `onToolCall`'s client-resolved tools). This package stays
   * Cesium-agnostic: it doesn't know or care which tool names matter to the
   * host, it just reports every server-resolved result generically so the
   * host can react locally (e.g. run verified code in a sandbox).
   *
   * The server's `execute` already completed by the time this fires, so this
   * never blocks stream parsing and doesn't gate the current turn. But the
   * host's local reaction (e.g. actually *running* server-verified code) can
   * discover a ground truth the server never saw — a runtime crash the static
   * verification missed. Returning a {@link ToolExecutionOutcome} lets the
   * host feed that back into the conversation: the client updates the
   * invocation's recorded `result` and, when `continueConversation` is set,
   * sends a follow-up request so the model sees the real outcome and can
   * react to it. Returning nothing leaves the transcript untouched. Errors
   * thrown here are reported via {@link onError} but never block parsing.
   */
  onServerToolResult?: (toolCall: {
    toolCallId: string;
    toolName: string;
    output: unknown;
  }) => ToolExecutionOutcome | void | Promise<ToolExecutionOutcome | void>;
  /**
   * Called when the server pauses the agent loop for a `tool-approval-request`
   * — a tool the backend declared `needsApproval` on. The host decides (e.g.
   * by showing a confirm/reject dialog with `toolName`/`args`) and resolves
   * with the verdict; the client then sends a `tool-approval-response` back
   * to the server and continues the loop, exactly like a normal client tool
   * result round trip. If omitted, every gated call is auto-denied with a
   * "no approval handler configured" reason — fail closed rather than hang
   * forever waiting for a decision nobody can make.
   */
  onApprovalRequired?: (toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<{ approved: boolean; reason?: string }>;
  /**
   * Hard cap on consecutive server round trips driven by client-resolved tool
   * calls, guarding against a model that keeps emitting tool calls turn after
   * turn. Defaults to {@link DEFAULT_MAX_TOOL_CALL_ROUNDS}.
   */
  maxToolCallRounds?: number;
}

export type EnsureAssistantMessage = () => Message;

/**
 * The result of a host reacting to a server-resolved tool result — see
 * {@link ChatClientOptions.onServerToolResult}.
 */
export interface ToolExecutionOutcome {
  /** Replaces the invocation's recorded `result`, so the next request the client sends reflects it. */
  result: unknown;
  /**
   * When true, the client sends a follow-up request right after applying
   * `result`, so the model sees the updated outcome and can react to it in a
   * fresh turn. Omit (or set false) when the update is informational only —
   * e.g. confirming a success the model already assumed — and doesn't need
   * to interrupt the model with a new turn.
   */
  continueConversation?: boolean;
}

export interface StreamToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface StreamToolResult {
  toolCallId: string;
  result: unknown;
}

/**
 * The subset of AI SDK v5+ UI message stream chunk fields this client reads.
 * Fields are optional because they vary by `type`; the handler narrows on
 * `type` before touching the ones that chunk variant carries.
 */
export interface UIMessageChunk {
  type: string;
  delta?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** Carried by `tool-approval-request` chunks — see {@link ToolInvocation.approval}. */
  approvalId?: string;
  isAutomatic?: boolean;
  signature?: string;
}
