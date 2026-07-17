/**
 * Builds the guest-side prelude that upgrades the `Cesium` namespace object (declared by
 * `buildCesiumValueTypeGuestPrelude`) into a `Proxy` falling back to the *real* static CesiumJS
 * allowlist for properties not explicitly reimplemented as pure guest-side value types.
 *
 * `buildCesiumValueTypeGuestPrelude` only reimplements a handful of the most commonly generated,
 * pure/side-effect-free value types (`Cartesian3`, `Color`, ...) directly in guest JS — real
 * CesiumJS exports hundreds of other classes and static namespaces (`Rectangle`, `Ellipsoid`,
 * `PinBuilder`, `GeoJsonPrimitive`, `Material`, `CustomShader`, ...) that were previously simply
 * `undefined` in the sandbox, silently breaking otherwise-correct generated code with a `"cannot
 * read property ... of undefined"` runtime error — the code *looked* like it ran successfully
 * (no AST-verification failure, no thrown error surfaced as a tool result `error`), but nothing
 * ever reached the live Viewer for that specific call.
 *
 * This falls back to a `__remoteProxy__` (see `guest-prelude-host-bridge.ts`) bound to a curated
 * object of non-network Cesium exports, registered host-side as a single root handle
 * (`guest-prelude.ts`'s `staticCesiumHandleId`) — the same generic, dynamically-dispatched
 * mechanism already used for the live `viewer`. The existing `assertSandboxPropertyAllowed` guard (run by
 * every `__cesiumSandboxHostGetSync__`/`__cesiumSandboxHostApplySync__`/
 * `__cesiumSandboxHostConstructSync__` call, regardless of which
 * handle it targets) still applies, so e.g. `Cesium.Material._materialCache` (a private,
 * underscore-prefixed internal) remains blocked exactly as it would on the `viewer` itself.
 *
 * Must be evaluated after `buildCesiumValueTypeGuestPrelude` (needs the `Cesium` binding to
 * reassign) and `buildCesiumHostBridgeGuestPrelude` (needs `__remoteProxy__`), and before
 * `buildViewerAsyncMethodGuestPrelude`.
 */
import { extractFunctionBody } from "./function-source.js";

// Ambient shims for guest-only globals `guestStaticFallbackBody` references: `__staticCesiumHandleId__`
// is injected as a `const` declaration ahead of the extracted body (see
// `buildCesiumStaticFallbackGuestPrelude` below), `__remoteProxy__` is declared by
// `guest-prelude-host-bridge.ts`'s prelude (evaluated earlier), and `Cesium` is declared (as
// `let`) by `guest-prelude-value-types.ts`'s prelude. None of these `declare`s emit any JS or
// appear in the extracted text — they exist purely so this file's guest-side logic can be
// written as a real, type-checked function instead of an opaque template-literal string.
declare const __staticCesiumHandleId__: string;
declare function __remoteProxy__(handleId: string): any;
declare let Cesium: any;

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the guest-side static-namespace fallback proxy described in
 * this file's top-level doc comment.
 */
function guestStaticFallbackBody(): void {
  const __staticCesium__ = __remoteProxy__(__staticCesiumHandleId__);
  Cesium = new Proxy(Cesium, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop);
      return __staticCesium__[prop];
    },
  });
}

export function buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId: string): string {
  return [
    `const __staticCesiumHandleId__ = ${JSON.stringify(staticCesiumHandleId)};`,
    extractFunctionBody(guestStaticFallbackBody),
  ].join("\n");
}
