import type { McpToolsLogger } from "@cesium-ai/mcp-tools";
import type { ServerMetrics } from "@cesium-ai/server";
import type { CodegenMetrics } from "@cesium-ai/codegen-cesium";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  logs,
  SeverityNumber,
  type LogAttributes,
  type Logger as OtelLogger,
} from "@opentelemetry/api-logs";
import { trace, metrics as otelMetrics, type Tracer, type Meter } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";
import type { Env } from "./env.js";

export type AppLogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface AppLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface BackendTelemetry {
  enabled: boolean;
  createLogger(scope: string): AppLogger;
  createMcpToolsLogger(scope: string): McpToolsLogger;
  /**
   * Returns an OTel `Tracer` scoped to the given instrumentation name (e.g. a
   * package name). Safe to call regardless of `enabled` — when telemetry is
   * disabled, no `TracerProvider` is registered and the OTel API's default
   * no-op tracer is returned instead, so callers never need to branch on it.
   */
  createTracer(scope: string): Tracer;
  /**
   * Returns an OTel `Meter` scoped to the given instrumentation name. Safe to
   * call regardless of `enabled`, same as {@link createTracer} — no
   * `MeterProvider` means the OTel API's default no-op meter instead.
   */
  createMeter(scope: string): Meter;
  /** Builds a `@cesium-ai/server`-shaped `ServerMetrics`, backed by this app's OTel meter. */
  createServerMetrics(scope: string): ServerMetrics;
  /** Builds a `@cesium-ai/codegen-cesium`-shaped `CodegenMetrics`, backed by this app's OTel meter. */
  createCodegenMetrics(scope: string): CodegenMetrics;
  shutdown(): Promise<void>;
}

const LEVEL_ORDER: Record<Exclude<AppLogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SEVERITY_MAP: Record<Exclude<AppLogLevel, "silent">, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

function toOtelAttributes(meta?: Record<string, unknown>): LogAttributes {
  if (!meta) return {};

  const attributes: LogAttributes = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
      continue;
    }

    if (value instanceof Error) {
      attributes[key] = value.message;
      continue;
    }

    try {
      attributes[key] = JSON.stringify(value);
    } catch {
      attributes[key] = String(value);
    }
  }

  return attributes;
}

function parseKeyValueList(raw: string | undefined): Record<string, string> {
  if (!raw || raw.trim() === "") return {};

  const pairs = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return undefined;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      return key && value ? [key, value] : undefined;
    })
    .filter((entry): entry is [string, string] => Boolean(entry));

  return Object.fromEntries(pairs);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Builds a `@cesium-ai/server`-shaped `ServerMetrics` backed by real OTel histograms on `meter`. */
function createServerMetricsFromMeter(meter: Meter): ServerMetrics {
  const tokenUsage = meter.createHistogram("cesium_ai.chat.tokens", {
    description: "Token usage per /api/chat request",
    unit: "{token}",
  });
  const requestDuration = meter.createHistogram("cesium_ai.chat.request.duration", {
    description: "Duration of a /api/chat request, from receipt to the model finishing",
    unit: "ms",
  });

  return {
    recordTokenUsage: (usage, attributes = {}) => {
      if (usage.inputTokens !== undefined) {
        tokenUsage.record(usage.inputTokens, { ...attributes, "token.type": "input" });
      }
      if (usage.outputTokens !== undefined) {
        tokenUsage.record(usage.outputTokens, { ...attributes, "token.type": "output" });
      }
      if (usage.totalTokens !== undefined) {
        tokenUsage.record(usage.totalTokens, { ...attributes, "token.type": "total" });
      }
    },
    recordRequestDuration: (durationMs, attributes = {}) => {
      requestDuration.record(durationMs, attributes);
    },
  };
}

/** Builds a `@cesium-ai/codegen-cesium`-shaped `CodegenMetrics` backed by real OTel histograms on `meter`. */
function createCodegenMetricsFromMeter(meter: Meter): CodegenMetrics {
  const tokenUsage = meter.createHistogram("cesium_ai.codegen.tokens", {
    description: "Token usage per executeCesiumCode generation attempt",
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

  return {
    recordTokenUsage: (usage, attributes = {}) => {
      if (usage.inputTokens !== undefined) {
        tokenUsage.record(usage.inputTokens, { ...attributes, "token.type": "input" });
      }
      if (usage.outputTokens !== undefined) {
        tokenUsage.record(usage.outputTokens, { ...attributes, "token.type": "output" });
      }
      if (usage.totalTokens !== undefined) {
        tokenUsage.record(usage.totalTokens, { ...attributes, "token.type": "total" });
      }
    },
    recordSkillMatchScore: (score, attributes = {}) => {
      skillMatchScore.record(score, attributes);
    },
    recordGenerationDuration: (durationMs, attributes = {}) => {
      generationDuration.record(durationMs, attributes);
    },
  };
}

function createConsoleAndOtelLogger(
  scope: string,
  level: AppLogLevel,
  otelLogger: OtelLogger | undefined,
): AppLogger {
  const enabled = (candidate: Exclude<AppLogLevel, "silent">): boolean => {
    if (level === "silent") return false;
    return LEVEL_ORDER[candidate] >= LEVEL_ORDER[level];
  };

  const emit = (
    methodLevel: Exclude<AppLogLevel, "silent">,
    consoleMethod: (...args: unknown[]) => void,
    message: string,
    meta?: Record<string, unknown>,
  ): void => {
    if (!enabled(methodLevel)) return;

    const prefixedMessage = `[${scope}] ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      consoleMethod(prefixedMessage, meta);
    } else {
      consoleMethod(prefixedMessage);
    }

    otelLogger?.emit({
      severityText: methodLevel.toUpperCase(),
      severityNumber: SEVERITY_MAP[methodLevel],
      body: prefixedMessage,
      attributes: {
        "log.scope": scope,
        ...toOtelAttributes(meta),
      },
    });
  };

  return {
    debug: (message, meta) => emit("debug", console.debug, message, meta),
    info: (message, meta) => emit("info", console.info, message, meta),
    warn: (message, meta) => emit("warn", console.warn, message, meta),
    error: (message, meta) => emit("error", console.error, message, meta),
  };
}

export function initializeBackendTelemetry(env: Env): BackendTelemetry {
  const headers = parseKeyValueList(env.OTEL_EXPORTER_OTLP_HEADERS);
  const resourceAttributes = parseKeyValueList(env.OTEL_RESOURCE_ATTRIBUTES);

  let provider: LoggerProvider | undefined;
  let tracerProvider: NodeTracerProvider | undefined;
  let meterProvider: MeterProvider | undefined;

  if (env.TELEMETRY_ENABLED) {
    const resource = resourceFromAttributes({
      "service.name": env.OTEL_SERVICE_NAME,
      "service.namespace": env.OTEL_SERVICE_NAMESPACE,
      ...resourceAttributes,
    });

    const exporterUrl = env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
      ? env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
      : env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? `${trimTrailingSlash(env.OTEL_EXPORTER_OTLP_ENDPOINT)}/v1/logs`
        : undefined;

    const exporter = new OTLPLogExporter({
      ...(exporterUrl ? { url: exporterUrl } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    provider = new LoggerProvider({
      resource,
      processors: [
        new BatchLogRecordProcessor({
          exporter,
        }),
      ],
    });

    logs.setGlobalLoggerProvider(provider);

    const tracesUrl = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ? env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      : env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? `${trimTrailingSlash(env.OTEL_EXPORTER_OTLP_ENDPOINT)}/v1/traces`
        : undefined;

    const traceExporter = new OTLPTraceExporter({
      ...(tracesUrl ? { url: tracesUrl } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(traceExporter)],
    });

    // Registers this provider globally (trace.getTracer(...) below then
    // resolves to it) and installs Node's async-hooks-based context manager,
    // so span context propagates across the awaits in the agent loop and
    // tool `execute` calls without any manual plumbing.
    tracerProvider.register();

    // Makes every `streamText`/`generateText` call in the agent loop
    // (`@cesium-ai/server`'s `runAgent`) emit GenAI-semantic-convention spans
    // (`invoke_agent`, `chat`, `execute_tool`) through this same tracer —
    // registered once, globally, so no call site needs its own `telemetry`
    // option to opt in.
    registerTelemetry(new OpenTelemetry({ tracer: tracerProvider.getTracer("gen_ai") }));

    const metricsUrl = env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      ? env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      : env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? `${trimTrailingSlash(env.OTEL_EXPORTER_OTLP_ENDPOINT)}/v1/metrics`
        : undefined;

    const metricExporter = new OTLPMetricExporter({
      ...(metricsUrl ? { url: metricsUrl } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    meterProvider = new MeterProvider({
      resource,
      readers: [new PeriodicExportingMetricReader({ exporter: metricExporter })],
    });

    otelMetrics.setGlobalMeterProvider(meterProvider);
  }

  const createLogger = (scope: string): AppLogger => {
    const otelLogger = provider?.getLogger(scope);
    return createConsoleAndOtelLogger(scope, env.OTEL_LOG_LEVEL, otelLogger);
  };

  // `McpToolsLogger` is structurally identical to `AppLogger` (same debug/info/warn/error
  // shape), so the underlying logger object is reused as-is instead of re-wrapped.
  const createMcpToolsLogger = (scope: string): McpToolsLogger => createLogger(scope);

  return {
    enabled: env.TELEMETRY_ENABLED,
    createLogger,
    createMcpToolsLogger,
    createTracer: (scope: string): Tracer => trace.getTracer(scope),
    createMeter: (scope: string): Meter => otelMetrics.getMeter(scope),
    createServerMetrics: (scope: string): ServerMetrics =>
      createServerMetricsFromMeter(otelMetrics.getMeter(scope)),
    createCodegenMetrics: (scope: string): CodegenMetrics =>
      createCodegenMetricsFromMeter(otelMetrics.getMeter(scope)),
    async shutdown(): Promise<void> {
      await Promise.all([
        provider?.forceFlush().then(() => provider!.shutdown()),
        tracerProvider?.forceFlush().then(() => tracerProvider!.shutdown()),
        meterProvider?.forceFlush().then(() => meterProvider!.shutdown()),
      ]);
    },
  };
}
