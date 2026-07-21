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

export const config = {
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined,
  chatApiEndpoint: `${apiBaseUrl}/api/chat`,
  logLevel: resolveLogLevel(),
};
