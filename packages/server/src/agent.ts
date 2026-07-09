import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
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
You can control the globe by calling tools — for example, flying the camera to a location.
When the user asks to go to, show, or look at a place, call the flyTo tool with that place's name.
Be concise, and confirm what you did after a tool runs.`;

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
}: RunAgentOptions): Promise<ReturnType<typeof streamText>> {
  return streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    // Continue the loop across tool calls, but never beyond maxSteps.
    stopWhen: stepCountIs(maxSteps),
  });
}
