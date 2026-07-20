import type { LogLevel } from "@cesium-ai/codegen-sandbox";

/**
 * Base URL the backend chat API is reachable at. Defaults to the local backend
 * dev server (`http://localhost:3001`); override with `VITE_API_BASE_URL` for
 * other environments. The chat endpoint is this base joined with `/api/chat`.
 */
const apiBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001"
).replace(/\/+$/, "");

const VALID_SANDBOX_LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error", "silent"];

/**
 * Minimum severity for the `@cesium-ai/codegen-sandbox` console logger (see
 * `tools/execute-cesium-code.ts`), which reports sandbox run start/success/failure plus every
 * individual host-bridge call (property get/set, function apply/construct, async factory calls)
 * crossing the guest/host boundary — useful for diagnosing "sandbox reports success but nothing
 * visibly changed" bugs. Override with `VITE_SANDBOX_LOG_LEVEL` (`debug`/`info`/`warn`/`error`/
 * `silent`); defaults to `debug` in dev builds (`npm run dev:frontend`) and `silent` in
 * production builds so generated-code execution isn't noisy by default once shipped.
 */
function resolveSandboxLogLevel(): LogLevel {
  const raw = import.meta.env.VITE_SANDBOX_LOG_LEVEL as string | undefined;
  if (raw && (VALID_SANDBOX_LOG_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }
  return import.meta.env.DEV ? "debug" : "silent";
}

export const config = {
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined,
  chatApiEndpoint: `${apiBaseUrl}/api/chat`,
  sandboxLogLevel: resolveSandboxLogLevel(),
};
