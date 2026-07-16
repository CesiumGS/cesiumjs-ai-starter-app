/**
 * Builds the guest-side `viewer` binding itself, wrapping the plain `__remoteProxy__` handle for
 * the live Viewer in one more `Proxy` layer that intercepts exactly two property reads —
 * `flyTo` and `zoomTo` — and routes them through QuickJS's Asyncify bridge (`__hostCallAsync__`,
 * via `__callAsyncCesiumFactory__` from `cesium-async-factories.ts`) instead of the generic
 * synchronous remote-proxy bridge.
 *
 * Real CesiumJS's `Viewer.prototype.flyTo(target, options)`/`zoomTo(target, offset)` are
 * genuinely Promise-returning: `target` may be an `Entity`/`DataSource`/`ImageryLayer`/
 * `Cesium3DTileset` (or a `Promise` of one), and the returned Promise doesn't resolve until that
 * target has finished loading/resolving and the camera flight completes. The generic synchronous
 * bridge (`guest-prelude-host-bridge.ts`) can never carry a Promise result — its host side
 * (`registerHostApply` in `host-bridge.ts`) explicitly rejects any forwarded call
 * whose result is a `PromiseLike`. So, like the small fixed set of async `Cesium.*` factories,
 * these two `viewer` methods need their own named Asyncify binding (`viewerFlyTo`/`viewerZoomTo`,
 * dispatched host-side by `host-bridge.ts`) — and are subject to the exact same "only one
 * async CesiumJS call per script" guard enforced by `__callAsyncCesiumFactory__`.
 *
 * Every other `viewer.*` property/method (`viewer.entities`, `viewer.camera`, `viewer.scene`, ...)
 * is forwarded completely transparently to the underlying remote proxy, unchanged.
 *
 * Must be evaluated after `buildCesiumAsyncFactoryGuestPrelude` (needs
 * `__callAsyncCesiumFactory__`) and `buildCesiumHostBridgeGuestPrelude` (needs `__remoteProxy__`);
 * this file's own output *is* the guest's `const viewer = ...` declaration, replacing the plain
 * `const viewer = __remoteProxy__(...)` line a caller might otherwise write directly.
 */
import { extractFunctionBody } from "./function-source.js";

// Ambient shims for guest-only globals `guestViewerAsyncBody` references: `__viewerRemote__` is
// injected as a `const` declaration ahead of the extracted body (see
// `buildViewerAsyncMethodGuestPrelude` below), `__remoteProxy__` is declared by
// `guest-prelude-host-bridge.ts`'s prelude (evaluated earlier), and `__callAsyncCesiumFactory__` is
// declared by `cesium-async-factories.ts`'s prelude (also evaluated earlier). None of these
// `declare`s emit any JS or appear in the extracted text — they exist purely so this file's
// guest-side logic can be written as a real, type-checked function instead of an opaque
// template-literal string.
declare const __viewerRemote__: any;
declare function __callAsyncCesiumFactory__(name: string, args: unknown[]): Promise<unknown>;

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the guest-side `viewer` binding described in this file's
 * top-level doc comment.
 */
function guestViewerAsyncBody(): void {
  const viewer: any = new Proxy(__viewerRemote__, {
    get(target: any, prop: any) {
      if (prop === "flyTo") {
        return function (flyToTarget: any, options: any) {
          return __callAsyncCesiumFactory__("viewerFlyTo", [flyToTarget, options]);
        };
      }
      if (prop === "zoomTo") {
        return function (zoomToTarget: any, offset: any) {
          return __callAsyncCesiumFactory__("viewerZoomTo", [zoomToTarget, offset]);
        };
      }
      return target[prop];
    },
    set(target: any, prop: any, value: any) {
      target[prop] = value;
      return true;
    },
  });
  // Referenced so `noUnusedLocals` doesn't flag `viewer` as unused from TypeScript's perspective
  // — guest code that references it lives outside this compilation unit entirely.
  void viewer;
}

export function buildViewerAsyncMethodGuestPrelude(viewerHandleId: string): string {
  return [
    `const __viewerRemote__ = __remoteProxy__(${JSON.stringify(viewerHandleId)});`,
    extractFunctionBody(guestViewerAsyncBody),
  ].join("\n");
}
