export type MetricAttributes = Record<string, string | number | boolean>;

/** Token counts for one model call, matching the AI SDK's `LanguageModelUsage` shape. */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** Metrics emitted by a code-generation and verification pipeline. */
export interface CodegenMetrics {
  recordTokenUsage(usage: TokenUsage, attributes?: MetricAttributes): void;
  recordSkillMatchScore(score: number, attributes?: MetricAttributes): void;
  recordGenerationDuration(durationMs: number, attributes?: MetricAttributes): void;
}

export const noopCodegenMetrics: CodegenMetrics = {
  recordTokenUsage: () => {},
  recordSkillMatchScore: () => {},
  recordGenerationDuration: () => {},
};

/** Metrics emitted by the chat server's request lifecycle. */
export interface ServerMetrics {
  recordTokenUsage(usage: TokenUsage, attributes?: MetricAttributes): void;
  recordRequestDuration(durationMs: number, attributes?: MetricAttributes): void;
  recordToolApproval(toolName: string, approved: boolean, attributes?: MetricAttributes): void;
}

export const noopServerMetrics: ServerMetrics = {
  recordTokenUsage: () => {},
  recordRequestDuration: () => {},
  recordToolApproval: () => {},
};
