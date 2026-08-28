import {
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolApprovalConfiguration,
  type ToolSet,
  type UIMessage,
} from "ai";

/**
 * Default upper bound on agent loop iterations (model call -> tool call ->
 * model call). This is the `maxSteps` guard: it prevents runaway tool-calling
 * loops. Override per-request via {@link RunAgentOptions.maxSteps}.
 */
export const DEFAULT_MAX_STEPS = 5;

/** Default system preamble that frames the assistant's role and tool usage. */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant embedded in a CesiumJS 3D globe application.
You can control the globe and respond to requests by calling whatever tools are available to you —
choose the tool that best matches what the user asked for.
Be concise. After a tool runs, report only what the tool result actually confirms — never claim
an action succeeded unless the result says so. If a tool result contains an error (an \`error\`
field, an \`executionError\` field, or any other failure indication), tell the user it failed and
what went wrong instead of describing the intended change as if it happened. Some tools report
outcomes in two phases: an initial result may only confirm that a request was accepted or
generated, not that it has been confirmed to fully complete yet — phrase your reply accordingly
(e.g. only say a change has been applied once no failure has been reported for it), and if a later
message reports a failure for that same request, acknowledge it honestly rather than repeating an
earlier success claim.`;

export interface RunAgentOptions {
  /** Conversation history as AI SDK UI messages (from the client). */
  messages: UIMessage[];
  /** The resolved language model (see {@link createModel}). */
  model: LanguageModel;
  /** Tool registry exposed to the model for this run. */
  tools: ToolSet;
  /** System prompt. Defaults to {@link DEFAULT_SYSTEM_PROMPT}. */
  system?: string;
  /** Max agent steps. Defaults to {@link DEFAULT_MAX_STEPS}. */
  maxSteps?: number;
  /** Per-tool human-in-the-loop approval gating, passed straight through to `streamText`. */
  toolApproval?: ToolApprovalConfiguration<ToolSet, never>;
  /**
   * Tool names that should end the agent loop for this request as soon as
   * that tool's result is available, instead of letting the model
   * immediately generate a same-turn reply from it. Use this for tools whose
   * result only reflects an intermediate step (e.g. server-side generation or
   * verification) rather than a confirmed final outcome, where the real
   * result is reported back later via a separate follow-up request (e.g. the
   * `ChatClient`'s `onServerToolResult` + `continueConversation`) that starts
   * a fresh agent loop — the model then reacts to the real outcome instead of
   * guessing at it early. Implemented via `hasToolCall` alongside `maxSteps`
   * in `stopWhen`.
   */
  stopAfterTools?: readonly string[];
}

/**
 * Runs the agent loop with `streamText`, returning the streaming result. The
 * caller turns this into an HTTP response (see {@link createChatRouter}).
 */
export async function runAgent({
  messages,
  model,
  tools,
  system = DEFAULT_SYSTEM_PROMPT,
  maxSteps = DEFAULT_MAX_STEPS,
  toolApproval,
  stopAfterTools,
}: RunAgentOptions): Promise<ReturnType<typeof streamText>> {
  return streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    toolApproval,
    // Continue the loop across tool calls, but never beyond maxSteps — and, for
    // any tool named in `stopAfterTools`, stop as soon as that tool's result
    // lands rather than letting the model reply to it in the same turn (see
    // the option's doc comment above).
    stopWhen:
      stopAfterTools && stopAfterTools.length > 0
        ? [stepCountIs(maxSteps), hasToolCall(...stopAfterTools)]
        : stepCountIs(maxSteps),
    // `@ai-sdk/openai`'s Responses API defaults to `store: true`, which makes a reasoning model's
    // later steps in this same multi-step loop reference an earlier reasoning item by id only
    // (`{ type: "item_reference", id }`) instead of resending it — relying on the *server* to have
    // that item retrievable later. Behind a proxy/gateway `AI_BASE_URL` (this app explicitly
    // supports one) that doesn't durably implement that server-side storage, the very next step can
    // fail with `AI_APICallError: Item with id '...' not found` as soon as a tool call errors and
    // the model needs another step to react to it. `store: false` makes reasoning fully stateless —
    // the full encrypted reasoning content is resent inline every step instead — which costs a bit
    // more per-request payload but works uniformly across any OpenAI-compatible endpoint. Ignored by
    // non-OpenAI providers (same pattern as codegen-czml's `strictJsonSchema`).
    providerOptions: { openai: { store: false } },
  });
}
