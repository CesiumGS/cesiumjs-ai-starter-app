// Console+OTel `AppLogger` implementation, split out of telemetry.ts (distinct concern from
// metrics/trace provider setup).
import {
  SeverityNumber,
  type LogAttributes,
  type Logger as OtelLogger,
} from "@opentelemetry/api-logs";

export type AppLogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface AppLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
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

export function createConsoleAndOtelLogger(
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
