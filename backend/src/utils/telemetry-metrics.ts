// OTel Meter-backed builders for this app's `ServerMetrics`/`CodegenMetrics` sinks, split out of
// telemetry.ts since this is the largest and most self-contained (provider-agnostic) concern.
import type { Meter } from "@opentelemetry/api";
import { AggregationType, InstrumentType, type ViewOptions } from "@opentelemetry/sdk-metrics";
import type { ServerMetrics } from "@cesium-ai/server";
import type { CodegenMetrics } from "@cesium-ai/codegen-cesium";

// OTel's default histogram buckets (`0, 5, 10, ..., 10000`) are tuned for millisecond latencies,
// not token counts — nearly every real token value pools into the last bucket, so a dashboard's
// P50/P90/P99 lines all collapse near the same (nearly meaningless) boundary. These are sized for
// the actual range of token counts this app sees (single skill-match snippets up to full
// multi-step agent-loop context windows).
const TOKEN_COUNT_BUCKET_BOUNDARIES = [
  0, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 65536, 131072,
];
// LLM requests routinely exceed the default histogram's 10s max boundary (multi-step tool-calling
// round trips, slow providers), which silently pools every real request into one overflow bucket.
const LLM_DURATION_BUCKET_BOUNDARIES_MS = [
  0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 40000, 80000, 160000,
];
// BM25 scores are unbounded but small in practice (this app's skill corpus is a handful of
// documents, so IDF/term-frequency terms stay low) — the default ms-tuned boundaries would pool
// every real score into the first bucket or two. Sized around `DEFAULT_SKILL_MATCH_THRESHOLD`
// (1.0) so both weak near-threshold matches and strong multi-term matches spread out visibly.
const SKILL_MATCH_SCORE_BUCKET_BOUNDARIES = [0, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50];

/**
 * Views applied to every meter this app creates. Each token-count histogram is split into its own
 * per-type instrument (`.input`/`.output`/`.total`) at creation time (see
 * {@link createServerMetricsFromMeter}/{@link createCodegenMetricsFromMeter}) rather than sharing
 * one histogram distinguished only by a `token.type` attribute — a dashboard's default graph for a
 * single metric name has no reason to group by attribute, so a shared histogram rendered as-is
 * blends input+output+total into one misleading line/percentile.
 *
 * Every selector below is scoped to `instrumentType: InstrumentType.HISTOGRAM` — the `.tokens.*`
 * name globs also match the `*.tokens.usage_total` Counters (see the same two factories), and an
 * EXPLICIT_BUCKET_HISTOGRAM aggregation is invalid for a Counter instrument.
 */
export const METRIC_VIEWS: ViewOptions[] = [
  {
    instrumentType: InstrumentType.HISTOGRAM,
    instrumentName: "cesium_ai.chat.tokens.*",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: TOKEN_COUNT_BUCKET_BOUNDARIES },
    },
  },
  {
    instrumentType: InstrumentType.HISTOGRAM,
    instrumentName: "cesium_ai.codegen.tokens.*",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: TOKEN_COUNT_BUCKET_BOUNDARIES },
    },
  },
  {
    instrumentType: InstrumentType.HISTOGRAM,
    instrumentName: "cesium_ai.*.duration",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: LLM_DURATION_BUCKET_BOUNDARIES_MS },
    },
  },
  {
    instrumentType: InstrumentType.HISTOGRAM,
    instrumentName: "cesium_ai.codegen.skill_match.score",
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: SKILL_MATCH_SCORE_BUCKET_BOUNDARIES },
    },
  },
];

/** Builds a `@cesium-ai/server`-shaped `ServerMetrics` backed by real OTel histograms on `meter`. */
export function createServerMetricsFromMeter(meter: Meter): ServerMetrics {
  const inputTokens = meter.createHistogram("cesium_ai.chat.tokens.input", {
    description: "Input (prompt) token usage per /api/chat request",
    unit: "{token}",
  });
  const outputTokens = meter.createHistogram("cesium_ai.chat.tokens.output", {
    description: "Output (completion) token usage per /api/chat request",
    unit: "{token}",
  });
  const totalTokens = meter.createHistogram("cesium_ai.chat.tokens.total", {
    description: "Total token usage (input + output) per /api/chat request",
    unit: "{token}",
  });
  const requestDuration = meter.createHistogram("cesium_ai.chat.request.duration", {
    description: "Duration of a /api/chat request, from receipt to the model finishing",
    unit: "ms",
  });
  // A Counter, not a Histogram — approvals/denials are discrete events with no distribution or
  // percentile to speak of, just a running total per `{tool, decision}` combination. Dashboards
  // typically render a Counter as a rate/cumulative-sum line rather than percentile buckets.
  const toolApprovals = meter.createCounter("cesium_ai.chat.tool_approvals", {
    description: "Count of needsApproval-gated tool call decisions, by tool and decision",
    unit: "{decision}",
  });
  // Monotonic Counters alongside the histograms above: a histogram's per-data-point `sum`
  // already lets a backend chart cumulative usage, but that relies on the backend surfacing
  // `_sum` separately from the bucket/percentile view. A dedicated Counter is the idiomatic OTel
  // primitive for "tokens consumed over time" (trivial rate()/increase() panels, no percentile
  // math). Split into one instrument per token type — same rationale as the histograms above —
  // so each renders as its own diagram instead of one graph needing a `token.type` group-by.
  const inputTokensUsedTotal = meter.createCounter("cesium_ai.chat.tokens.input.usage_total", {
    description: "Cumulative input (prompt) token usage across all /api/chat requests",
    unit: "{token}",
  });
  const outputTokensUsedTotal = meter.createCounter("cesium_ai.chat.tokens.output.usage_total", {
    description: "Cumulative output (completion) token usage across all /api/chat requests",
    unit: "{token}",
  });
  const totalTokensUsedTotal = meter.createCounter("cesium_ai.chat.tokens.total.usage_total", {
    description: "Cumulative total token usage across all /api/chat requests",
    unit: "{token}",
  });
  // A Gauge (LAST_VALUE), not a Histogram — renders as a plain line of the most recently recorded
  // value per export interval, so you can visually see individual requests spike above others,
  // instead of a histogram's percentile bands. Trade-off: if more than one request lands within
  // the same export interval (60s by default), only the last one recorded in that window is kept
  // — bursts of concurrent requests will show fewer points than actual requests.
  const inputTokensLast = meter.createGauge("cesium_ai.chat.tokens.input.last", {
    description: "Most recent input (prompt) token count of a single /api/chat request",
    unit: "{token}",
  });
  const outputTokensLast = meter.createGauge("cesium_ai.chat.tokens.output.last", {
    description: "Most recent output (completion) token count of a single /api/chat request",
    unit: "{token}",
  });
  const totalTokensLast = meter.createGauge("cesium_ai.chat.tokens.total.last", {
    description: "Most recent total token count of a single /api/chat request",
    unit: "{token}",
  });

  return {
    recordTokenUsage: (usage, attributes = {}) => {
      if (usage.inputTokens !== undefined) {
        inputTokens.record(usage.inputTokens, attributes);
        inputTokensUsedTotal.add(usage.inputTokens, attributes);
        inputTokensLast.record(usage.inputTokens, attributes);
      }
      if (usage.outputTokens !== undefined) {
        outputTokens.record(usage.outputTokens, attributes);
        outputTokensUsedTotal.add(usage.outputTokens, attributes);
        outputTokensLast.record(usage.outputTokens, attributes);
      }
      if (usage.totalTokens !== undefined) {
        totalTokens.record(usage.totalTokens, attributes);
        totalTokensUsedTotal.add(usage.totalTokens, attributes);
        totalTokensLast.record(usage.totalTokens, attributes);
      }
    },
    recordRequestDuration: (durationMs, attributes = {}) => {
      requestDuration.record(durationMs, attributes);
    },
    recordToolApproval: (toolName, approved, attributes = {}) => {
      toolApprovals.add(1, {
        ...attributes,
        "tool.name": toolName,
        "tool.decision": approved ? "approved" : "rejected",
      });
    },
  };
}

/** Builds a `@cesium-ai/codegen-cesium`-shaped `CodegenMetrics` backed by real OTel histograms on `meter`. */
export function createCodegenMetricsFromMeter(meter: Meter): CodegenMetrics {
  const inputTokens = meter.createHistogram("cesium_ai.codegen.tokens.input", {
    description: "Input (prompt) token usage per executeCesiumCode generation attempt",
    unit: "{token}",
  });
  const outputTokens = meter.createHistogram("cesium_ai.codegen.tokens.output", {
    description: "Output (completion) token usage per executeCesiumCode generation attempt",
    unit: "{token}",
  });
  const totalTokens = meter.createHistogram("cesium_ai.codegen.tokens.total", {
    description: "Total token usage (input + output) per executeCesiumCode generation attempt",
    unit: "{token}",
  });
  const skillMatchScore = meter.createHistogram("cesium_ai.codegen.skill_match.score", {
    description: "BM25 score of a CesiumJS skill matched against a user's intent",
  });
  const generationDuration = meter.createHistogram("cesium_ai.codegen.generation.duration", {
    description:
      "Duration of one executeCesiumCode generation attempt (model call + static verification)",
    unit: "ms",
  });
  // See the matching counters in `createServerMetricsFromMeter` for the rationale (cumulative
  // usage-over-time via a dedicated Counter per token type, one diagram each).
  const inputTokensUsedTotal = meter.createCounter("cesium_ai.codegen.tokens.input.usage_total", {
    description:
      "Cumulative input (prompt) token usage across all executeCesiumCode generation attempts",
    unit: "{token}",
  });
  const outputTokensUsedTotal = meter.createCounter("cesium_ai.codegen.tokens.output.usage_total", {
    description:
      "Cumulative output (completion) token usage across all executeCesiumCode generation attempts",
    unit: "{token}",
  });
  const totalTokensUsedTotal = meter.createCounter("cesium_ai.codegen.tokens.total.usage_total", {
    description: "Cumulative total token usage across all executeCesiumCode generation attempts",
    unit: "{token}",
  });
  // A Counter, not a Histogram — "which skills matched, how often" is a count-by-skill bar chart,
  // not a distribution. Only forwards `skill`/`passedThreshold` from the caller's attributes (not
  // `rank`/`score`, both effectively unique per call) to keep the attribute cardinality bounded to
  // one series per skill/threshold-outcome combination.
  const skillMatchCount = meter.createCounter("cesium_ai.codegen.skill_match.count", {
    description: "Count of times a CesiumJS skill was scored against an intent, by skill name",
    unit: "{match}",
  });
  // See the matching Gauges in `createServerMetricsFromMeter` for the rationale (a plain
  // per-request line, distinct from the histogram's distribution and the counter's running total).
  const inputTokensLast = meter.createGauge("cesium_ai.codegen.tokens.input.last", {
    description:
      "Most recent input (prompt) token count of a single executeCesiumCode generation attempt",
    unit: "{token}",
  });
  const outputTokensLast = meter.createGauge("cesium_ai.codegen.tokens.output.last", {
    description:
      "Most recent output (completion) token count of a single executeCesiumCode generation attempt",
    unit: "{token}",
  });
  const totalTokensLast = meter.createGauge("cesium_ai.codegen.tokens.total.last", {
    description: "Most recent total token count of a single executeCesiumCode generation attempt",
    unit: "{token}",
  });

  return {
    recordTokenUsage: (usage, attributes = {}) => {
      if (usage.inputTokens !== undefined) {
        inputTokens.record(usage.inputTokens, attributes);
        inputTokensUsedTotal.add(usage.inputTokens, attributes);
        inputTokensLast.record(usage.inputTokens, attributes);
      }
      if (usage.outputTokens !== undefined) {
        outputTokens.record(usage.outputTokens, attributes);
        outputTokensUsedTotal.add(usage.outputTokens, attributes);
        outputTokensLast.record(usage.outputTokens, attributes);
      }
      if (usage.totalTokens !== undefined) {
        totalTokens.record(usage.totalTokens, attributes);
        totalTokensUsedTotal.add(usage.totalTokens, attributes);
        totalTokensLast.record(usage.totalTokens, attributes);
      }
    },
    recordSkillMatchScore: (score, attributes = {}) => {
      skillMatchScore.record(score, attributes);
      skillMatchCount.add(1, {
        skill: attributes.skill,
        passedThreshold: attributes.passedThreshold,
      });
    },
    recordGenerationDuration: (durationMs, attributes = {}) => {
      generationDuration.record(durationMs, attributes);
    },
  };
}
