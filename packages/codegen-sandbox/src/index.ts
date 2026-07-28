/**
 * Frontend-only, browser-executed CesiumJS "Code Mode" sandbox: a QuickJS-wasm interpreter bound
 * directly to real CesiumJS primitives on a live `Viewer` (`cesium-bindings.ts` /
 * `cesium-code-sandbox.ts`), plus the client-side guardrails around running it
 * (`execution-guards.ts`) — entity/collection caps.
 *
 * Deliberately separate from `@cesium-ai/codegen-cesium`: that package generates and *statically
 * verifies* (AST parse-only, never executes) a CesiumJS snippet from a model intent, and is safe
 * for a Node backend to import. This package is the other half of that pipeline — the sandbox that
 * actually *executes* an already-verified snippet — and depends on `cesium` (WebGL/DOM) and
 * `quickjs-emscripten` (browser wasm), so it must stay out of any server-side bundle.
 */
export {
  runCesiumCodeInSandbox,
  type SandboxResult,
  type RunCesiumCodeOptions,
} from "./cesium-code-sandbox.js";

export {
  SandboxHandles,
  createProxiedViewer,
  buildCesiumHostBridgeGuestPrelude,
  buildCesiumValueTypeGuestPrelude,
} from "./cesium-bindings.js";

export {
  assertEntityCapNotExceeded,
  DEFAULT_MAX_ITEMS_PER_COLLECTION,
  EntityCapExceededError,
  type SceneCollectionCapOptions,
} from "./execution-guards.js";

export {
  createConsoleLogger,
  createSandboxLogger,
  noopLogger,
  type LogLevel,
  type SandboxLogger,
  type SandboxLoggerOptions,
} from "./logger.js";
