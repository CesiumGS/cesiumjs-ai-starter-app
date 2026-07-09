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
  state: "call" | "result";
  result?: unknown;
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
}
