/**
 * Frontend-only CesiumJS sandbox bindings: marshals values across the QuickJS guest/host boundary,
 * proxies a real `Viewer` with runtime guardrails, and builds the guest-side JS "preludes" that
 * bind CesiumJS value types, the live-object remote-proxy bridge, and the small set of genuinely
 * async Cesium factories.
 *
 * This module is a barrel re-export only -- see the individual modules under `bindings/` for the
 * actual implementation and design rationale:
 *
 * - `bindings/sandbox-handles.ts` -- the `SandboxHandles` marshaling class and its marker
 *   constants (opaque host-object handles vs. transparently-tagged value types vs. `undefined`).
 * - `bindings/guarded-viewer-proxy.ts` -- `createProxiedViewer`, the `Proxy`-based guardrail layer
 *   (entity/primitive/data-source caps) that transparently forwards the rest of the real Cesium
 *   `Viewer` API.
 * - `bindings/host-bridge.ts` -- registers the host-side property, call, constructor, and async
 *   functions consumed by the guest-side bridge.
 * - `bindings/guest-prelude.ts` -- owns the static Cesium allowlist, root handles, and dependency
 *   order for all guest-side binding preludes.
 * - `bindings/cesium-async-factories.ts` -- the registry for the small, fixed set of genuinely
 *   async, network/Ion-backed `Cesium.*` factories, plus their guest-side prelude.
 * - `bindings/guest-prelude-host-bridge.ts` -- the guest-side `__remoteProxy__` bridge for
 *   synchronous host calls (property reads / method calls on opaque handles).
 * - `bindings/guest-prelude-value-types.ts` -- the guest-side prelude reimplementing pure,
 *   side-effect-free CesiumJS value types/enums/`Cesium.Math` directly in guest JS.
 */
export { SandboxHandles } from "./bindings/sandbox-handles.js";

export {
  assertSandboxPropertyAllowed,
  createProxiedViewer,
} from "./bindings/guarded-viewer-proxy.js";

export {
  DEFAULT_CESIUM_ASYNC_FACTORIES,
  CESIUM_ASYNC_FACTORY_NAMES,
  buildCesiumAsyncFactoryGuestPrelude,
  type CesiumAsyncFactories,
} from "./bindings/cesium-async-factories.js";

export { buildCesiumHostBridgeGuestPrelude } from "./bindings/guest-prelude-host-bridge.js";

export { buildCesiumValueTypeGuestPrelude } from "./bindings/guest-prelude-value-types.js";

export { buildCesiumStaticFallbackGuestPrelude } from "./bindings/guest-prelude-static-fallback.js";

export { buildViewerAsyncMethodGuestPrelude } from "./bindings/guest-prelude-viewer-async.js";
