import type { LogLevel } from "@cesium-ai/codegen-sandbox";

/**
 * Base URL the backend chat API is reachable at. Defaults to the local backend
 * dev server (`http://localhost:3001`); override with `VITE_API_BASE_URL` for
 * other environments. The chat endpoint is this base joined with `/api/chat`.
 */
const apiBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001"
).replace(/\/+$/, "");

const VALID_LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error", "silent"];

/**
 * Resolves an env var to one of a fixed set of allowed string values, falling back when the env
 * var is unset or holds something outside `validValues`. Generic so any future `VITE_*` enum
 * setting (not just `VITE_OTEL_LOG_LEVEL`) can reuse the same validated-with-fallback pattern
 * instead of duplicating this "check membership, else default" logic per setting.
 */
function resolveEnvEnum<T extends string>(
  raw: string | undefined,
  validValues: readonly T[],
  fallback: T,
): T {
  if (raw && (validValues as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return fallback;
}

function resolveBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (!raw || raw.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveSandboxAllowedNetworkOrigins(): string[] {
  return ((import.meta.env.VITE_SANDBOX_ALLOWED_NETWORK_ORIGINS as string | undefined) ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  cesiumIonToken: (() => {
    const value = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined;
    return value && value.trim() !== "" ? value : undefined;
  })(),
  /**
   * Cesium ion API server the token above is validated against. Cesium defaults this to the
   * production `https://api.cesium.com/` server — a token issued by a different ion server (e.g.
   * an internal or staging ion environment) will 401 on every asset request unless this
   * is overridden to match that token's actual issuer. Leave unset for a normal ion.cesium.com
   * token.
   */
  cesiumIonServerUrl: import.meta.env.VITE_CESIUM_ION_SERVER_URL as string | undefined,
  /**
   * Base URL this app's single backend (`@cesium-ai/server`) is reachable at.
   * Passed straight through as `AiChatPanel`'s `apiBase` prop, which derives
   * the chat, tools, MCP connect, and MCP Apps endpoints from it by
   * convention (`/api/chat`, `/api/tools`, `/api/mcp`, `/api/mcp-app`) — see
   * `@cesium-ai/chat-element`'s `AiChatPanelProps.apiBase`.
   */
  apiBase: apiBaseUrl,
  sandboxAllowedNetworkOrigins: resolveSandboxAllowedNetworkOrigins(),
  telemetryEnabled: resolveBooleanEnv(
    import.meta.env.VITE_TELEMETRY_ENABLED as string | undefined,
    false,
  ),
  otelExporterOtlpEndpoint: (() => {
    const value = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined;
    return value && value.trim() !== "" ? trimTrailingSlash(value.trim()) : undefined;
  })(),
  otelExporterOtlpLogsEndpoint: (() => {
    const value = import.meta.env.VITE_OTEL_EXPORTER_OTLP_LOGS_ENDPOINT as string | undefined;
    return value && value.trim() !== "" ? value.trim() : undefined;
  })(),
  otelExporterOtlpHeaders:
    (import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS as string | undefined) ?? "",
  otelServiceName:
    (import.meta.env.VITE_OTEL_SERVICE_NAME as string | undefined)?.trim() ||
    "cesiumjs-ai-starter-app-frontend",
  otelServiceNamespace:
    (import.meta.env.VITE_OTEL_SERVICE_NAMESPACE as string | undefined)?.trim() || "cesium-ai",
  otelResourceAttributes:
    (import.meta.env.VITE_OTEL_RESOURCE_ATTRIBUTES as string | undefined) ?? "",
  otelLogLevel: resolveEnvEnum(
    import.meta.env.VITE_OTEL_LOG_LEVEL as string | undefined,
    VALID_LOG_LEVELS,
    import.meta.env.DEV ? "debug" : "silent",
  ),
};
