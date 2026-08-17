import type { McpToolsLogger } from "@cesium-ai/mcp-tools";
import type { ServerMetrics } from "@cesium-ai/server";
import type { CodegenMetrics } from "@cesium-ai/codegen-cesium";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { logs } from "@opentelemetry/api-logs";
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
import {
  type AppLogLevel,
  type AppLogger,
  createConsoleAndOtelLogger,
} from "./telemetry-logger.js";
import {
  METRIC_VIEWS,
  createServerMetricsFromMeter,
  createCodegenMetricsFromMeter,
} from "./telemetry-metrics.js";

// Re-exported so existing consumers (e.g. `app.ts`) can keep importing these from telemetry.js,
// their original home, even though the implementation now lives in telemetry-logger.ts.
export type { AppLogLevel, AppLogger };

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
      views: METRIC_VIEWS,
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
