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
 * setting (not just `VITE_LOG_LEVEL`) can reuse the same validated-with-fallback pattern instead
 * of duplicating this "check membership, else default" logic per setting.
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

function resolveLogLevel(): LogLevel {
  return resolveEnvEnum(
    import.meta.env.VITE_LOG_LEVEL as string | undefined,
    VALID_LOG_LEVELS,
    import.meta.env.DEV ? "debug" : "silent",
  );
}

function resolveSandboxAllowedNetworkOrigins(): string[] {
  return ((import.meta.env.VITE_SANDBOX_ALLOWED_NETWORK_ORIGINS as string | undefined) ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined,
  /**
   * Cesium ion API server the token above is validated against. Cesium defaults this to the
   * production `https://api.cesium.com/` server — a token issued by a different ion server (e.g.
   * an internal or staging ion environment) will 401 on every asset request unless this
   * is overridden to match that token's actual issuer. Leave unset for a normal ion.cesium.com
   * token.
   */
  cesiumIonServerUrl: import.meta.env.VITE_CESIUM_ION_SERVER_URL as string | undefined,
  chatApiEndpoint: `${apiBaseUrl}/api/chat`,
  toolsApiEndpoint: `${apiBaseUrl}/api/tools`,
  /**
   * Base URL for session-scoped, user-initiated MCP OAuth connect routes
   * (e.g. a "Connect to Cesium ion" button) — see `@cesium-ai/server`'s
   * `mcp-session-router.ts`. Renders no UI when the backend reports no
   * session-connectable servers configured.
   */
  mcpConnectApiBase: `${apiBaseUrl}/api/mcp`,
  /**
   * Base URL for MCP Apps widget bridge routes (fetching a tool's `ui://`
   * resource, and calling tools back on its own server from inside the
   * rendered widget) — see `@cesium-ai/server`'s `mcp-app-router.ts`.
   */
  mcpAppApiBase: `${apiBaseUrl}/api/mcp-app`,
  logLevel: resolveLogLevel(),
  sandboxAllowedNetworkOrigins: resolveSandboxAllowedNetworkOrigins(),
};
