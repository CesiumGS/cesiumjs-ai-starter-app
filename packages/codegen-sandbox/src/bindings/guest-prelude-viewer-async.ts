/**
 * Builds the guest-side `viewer` binding itself: a plain `__remoteProxy__` wrapping the live
 * Viewer's root handle.
 *
 * `Viewer.prototype.flyTo(target, options)`/`zoomTo(target, offset)` are genuinely
 * Promise-returning (the returned Promise doesn't resolve until `target` has finished
 * loading/resolving and the camera flight completes), but they need no special handling here:
 * the generic remote-proxy `apply` trap (`guest-prelude-host-bridge.ts`) already bridges any
 * Promise-returning call result back to the guest transparently via a real `ctx.newPromise()`
 * (see `registerHostApply` in `host-bridge.ts`) — the same safe mechanism already used for e.g.
 * `viewer.dataSources.add(...)`.
 *
 * An earlier design intercepted exactly these two property reads and routed them guest-side
 * through QuickJS's Asyncify bridge (`__cesiumSandboxHostCallAsync__`, via
 * `__callAsyncCesiumFactory__` from `cesium-async-factories.ts`) instead, on the assumption that
 * the generic bridge couldn't carry a Promise result — that assumption became stale once
 * `registerHostApply` grew its own `ctx.newPromise()`-based bridging. The Asyncify path
 * reproducibly crashed the interpreter with a native
 * `Assertion failed: p->ref_count == 0, at free_zero_refcount` abort the moment a real call
 * (e.g. `await viewer.flyTo(entity, {...})`) actually executed through it. Removed in favor of
 * this already-safe generic path, which needs no per-method special-casing at all — every
 * `viewer.*` property/method is now forwarded completely transparently.
 *
 * Must be evaluated after `buildCesiumHostBridgeGuestPrelude` (needs `__remoteProxy__`); this
 * file's own output *is* the guest's `const viewer = ...` declaration.
 */
export function buildViewerAsyncMethodGuestPrelude(viewerHandleId: string): string {
  return `const viewer = __remoteProxy__(${JSON.stringify(viewerHandleId)});`;
}
