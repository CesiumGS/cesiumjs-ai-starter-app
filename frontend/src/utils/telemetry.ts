import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  logs,
  SeverityNumber,
  type LogAttributes,
  type Logger as OtelLogger,
} from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import type { Logger, LogLevel } from "@cesium-ai/observability";
import { config } from "./config";

const LEVEL_ORDER: Record<Exclude<LogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SEVERITY_MAP: Record<Exclude<LogLevel, "silent">, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

function parseKeyValueList(raw: string): Record<string, string> {
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

function toAttributes(meta?: Record<string, unknown>): LogAttributes {
  if (!meta) return {};

  const attributes: LogAttributes = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
    } else if (value instanceof Error) {
      attributes[key] = value.message;
    } else {
      try {
        attributes[key] = JSON.stringify(value);
      } catch {
        attributes[key] = String(value);
      }
    }
  }
  return attributes;
}

function createTelemetryProvider(): LoggerProvider | undefined {
  if (!config.telemetryEnabled) return undefined;

  const headers = parseKeyValueList(config.otelExporterOtlpHeaders);
  const resourceAttributes = parseKeyValueList(config.otelResourceAttributes);
  const exporterUrl = config.otelExporterOtlpLogsEndpoint
    ? config.otelExporterOtlpLogsEndpoint
    : config.otelExporterOtlpEndpoint
      ? `${config.otelExporterOtlpEndpoint}/v1/logs`
      : undefined;

  const exporter = new OTLPLogExporter({
    ...(exporterUrl ? { url: exporterUrl } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  });

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": config.otelServiceName,
      "service.namespace": config.otelServiceNamespace,
      ...resourceAttributes,
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter,
      }),
    ],
  });

  logs.setGlobalLoggerProvider(provider);
  return provider;
}

const provider = createTelemetryProvider();

if (provider && typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void provider.forceFlush();
  });
}

export function createFrontendLogger(scope: string): Logger {
  const otelLogger: OtelLogger | undefined = provider?.getLogger(scope);
  const level = config.otelLogLevel;

  const enabled = (candidate: Exclude<LogLevel, "silent">): boolean => {
    if (level === "silent") return false;
    return LEVEL_ORDER[candidate] >= LEVEL_ORDER[level];
  };

  const emit = (
    methodLevel: Exclude<LogLevel, "silent">,
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
        ...toAttributes(meta),
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

export const frontendLogger = createFrontendLogger("frontend");
