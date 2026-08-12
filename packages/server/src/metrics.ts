/**
 * Minimal, configurable metrics seam for the chat key-layer. Entirely OFF by default
 * (`createChatRouter` falls back to {@link noopServerMetrics}) so existing callers/tests see no
 * behavior change — a host application opts in by passing its own {@link ServerMetrics} (e.g. one
 * backed by its own OTEL-wired meter) via `ChatRouterOptions.metrics`.
 */

/** Token counts for a chat request, matching the AI SDK's `LanguageModelUsage` shape. */
export interface ChatTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** A small, metrics-shaped interface so callers can plug in their own implementation. */
export interface ServerMetrics {
  /** Records a `/api/chat` request's total token usage (summed across every agent-loop step). */
  recordTokenUsage(
    usage: ChatTokenUsage,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  /** Records how long a `/api/chat` request took, in ms, from receipt to the model finishing. */
  recordRequestDuration(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>,
  ): void;
}

/** A {@link ServerMetrics} whose methods are all no-ops. Used whenever metrics aren't configured. */
export const noopServerMetrics: ServerMetrics = {
  recordTokenUsage: () => {},
  recordRequestDuration: () => {},
};
