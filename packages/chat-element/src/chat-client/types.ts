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
   * host can react locally (e.g. run verified code in a sandbox) without
   * triggering another server round trip — the agent turn already completed
   * server-side by the time this fires. Fire-and-forget: errors thrown here
   * are reported via {@link onError} but never block stream parsing.
   */
  onServerToolResult?: (toolCall: {
    toolCallId: string;
    toolName: string;
    output: unknown;
  }) => void | Promise<void>;
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
