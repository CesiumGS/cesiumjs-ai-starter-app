/**
 * Minimal, configurable metrics seam for the CZML codegen pipeline. Entirely OFF by default
 * (`generateVerifiedCzml` falls back to {@link noopCodegenMetrics}) so existing callers/tests
 * see no behavior change — a host application opts in by passing its own {@link CodegenMetrics}
 * (e.g. one backed by its own OTEL-wired meter) via `GenerateVerifiedCzmlOptions.metrics`.
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
  /** Records how long a generation attempt (model call + CZML verification) took, in ms. */
  recordGenerationDuration(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>,
  ): void;
}

/** A {@link CodegenMetrics} whose methods are all no-ops. Used whenever metrics aren't configured. */
export const noopCodegenMetrics: CodegenMetrics = {
  recordTokenUsage: () => {},
  recordGenerationDuration: () => {},
};
