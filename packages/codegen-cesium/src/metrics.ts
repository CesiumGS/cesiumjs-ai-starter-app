/**
 * Minimal, configurable metrics seam for the codegen pipeline. Entirely OFF by default
 * (`generateVerifiedCesiumCode` falls back to {@link noopCodegenMetrics}) so existing
 * callers/tests see no behavior change — a host application opts in by passing its own
 * {@link CodegenMetrics} (e.g. one backed by its own OTEL-wired meter) via
 * `GenerateVerifiedCesiumCodeOptions.metrics`.
 */

/** Token counts for a single model call, matching the AI SDK's `LanguageModelUsage` shape. */
export interface CodegenTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** A small, metrics-shaped interface so callers can plug in their own implementation. */
export interface CodegenMetrics {
  /** Records one model call's token usage. */
  recordTokenUsage(
    usage: CodegenTokenUsage,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  /**
   * Records the BM25 score of one skill scored against the user's intent. Called once per
   * scored skill (not just the ones that passed the match threshold), with `rank` (0 = top
   * score) and `passedThreshold` attributes so a consumer can reconstruct the full score
   * distribution and how many skills passed the configured threshold for a given prompt.
   */
  recordSkillMatchScore(
    score: number,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  /** Records how long a generation attempt (model call + static verification) took, in ms. */
  recordGenerationDuration(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>,
  ): void;
}

/** A {@link CodegenMetrics} whose methods are all no-ops. Used whenever metrics aren't configured. */
export const noopCodegenMetrics: CodegenMetrics = {
  recordTokenUsage: () => {},
  recordSkillMatchScore: () => {},
  recordGenerationDuration: () => {},
};
