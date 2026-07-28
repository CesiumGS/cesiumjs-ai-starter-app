/**
 * Frontend-only CesiumJS sandbox bindings: marshals values across the QuickJS guest/host boundary,
 * proxies a real `Viewer` with runtime guardrails, and builds the guest-side JS "preludes" that
 * bind CesiumJS value types and the live-object remote-proxy bridge, including generic Promise
 * handling for asynchronous Cesium calls.
 *
 * This module is a barrel re-export only -- see the individual modules under `bindings/` for the
 * actual implementation and design rationale:
 *
 * - `bindings/sandbox-handles.ts` -- the `SandboxHandles` marshaling class and its marker
 *   constants (opaque host-object handles vs. transparently-tagged value types vs. `undefined`).
 * - `bindings/guarded-viewer-proxy.ts` -- `createProxiedViewer`, the `Proxy`-based guardrail layer
 *   (entity/primitive/data-source caps) that transparently forwards the rest of the real Cesium
 *   `Viewer` API.
 * - `bindings/host-bridge.ts` -- registers the host-side property, call, and constructor
 *   functions consumed by the guest-side bridge, including dynamically bridged Promise results.
 * - `bindings/guest-prelude.ts` -- applies the static Cesium denylist and owns root handles and dependency
 *   order for all guest-side binding preludes.
 * - `bindings/guest-prelude-host-bridge.ts` -- the guest-side `__remoteProxy__` bridge for
 *   property reads, assignments, calls, and construction on opaque handles.
 * - `bindings/guest-prelude-value-types.ts` -- the guest-side prelude reimplementing pure,
 *   side-effect-free CesiumJS value types/enums/`Cesium.Math` directly in guest JS.
 */
export { SandboxHandles } from "./bindings/sandbox-handles.js";

export {
  assertSandboxPropertyAllowed,
  createProxiedViewer,
} from "./bindings/guarded-viewer-proxy.js";

export { buildCesiumHostBridgeGuestPrelude } from "./bindings/guest-prelude-host-bridge.js";

export { buildCesiumValueTypeGuestPrelude } from "./bindings/guest-prelude-value-types.js";

export { buildCesiumStaticFallbackGuestPrelude } from "./bindings/guest-prelude-static-fallback.js";
