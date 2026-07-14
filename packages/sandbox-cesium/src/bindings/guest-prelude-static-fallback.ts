/**
 * Builds the guest-side prelude that upgrades the `Cesium` namespace object (declared by
 * `buildCesiumValueTypeGuestPrelude`) into a `Proxy` falling back to the *real* static CesiumJS
 * module for any property not explicitly reimplemented as a pure guest-side value type.
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
 * Instead of hand-maintaining an ever-growing explicit allowlist of static classes, this falls
 * back to a `__remoteProxy__` (see `guest-prelude-host-bridge.ts`) bound to the *entire* real
 * `Cesium` module, registered host-side as a single root handle
 * (`cesium-code-sandbox.ts`'s `staticCesiumHandleId`) — the same generic, dynamically-dispatched
 * mechanism already used for the live `viewer`, so newly reached static classes never require
 * touching this marshaling layer again. The existing `assertSandboxPropertyAllowed` guard (run by
 * every `__hostGetSync__`/`__hostApplySync__`/`__hostConstructSync__` call, regardless of which
 * handle it targets) still applies, so e.g. `Cesium.Material._materialCache` (a private,
 * underscore-prefixed internal) remains blocked exactly as it would on the `viewer` itself.
 *
 * Must be evaluated after `buildCesiumValueTypeGuestPrelude` (needs the `Cesium` binding to
 * reassign) and `buildCesiumHostBridgeGuestPrelude` (needs `__remoteProxy__`), and before
 * `buildCesiumAsyncFactoryGuestPrelude` (whose explicit `Cesium.X = ...` assignments must land on
 * the same underlying plain object this proxy still forwards property *writes* to by default).
 */
export function buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId: string): string {
  return `
const __staticCesium__ = __remoteProxy__(${JSON.stringify(staticCesiumHandleId)});
Cesium = new Proxy(Cesium, {
  get(target, prop) {
    if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop);
    return __staticCesium__[prop];
  },
});
  `.trim();
}
