import type { Viewer } from "cesium";
import * as CesiumNamespace from "cesium";
import { createProxiedViewer } from "./guarded-viewer-proxy.js";
import { buildCesiumHostBridgeGuestPrelude } from "./guest-prelude-host-bridge.js";
import { buildCesiumStaticFallbackGuestPrelude } from "./guest-prelude-static-fallback.js";
import { buildCesiumValueTypeGuestPrelude } from "./guest-prelude-value-types.js";
import type { SandboxHandles } from "./sandbox-handles.js";
import { BLOCKED_STATIC_CESIUM_EXPORTS } from "./capabilities-registry.js";

const AVAILABLE_CESIUM_NAMESPACE = Object.freeze(
  Object.fromEntries(
    Object.entries(CesiumNamespace).filter(([name]) => !BLOCKED_STATIC_CESIUM_EXPORTS.has(name)),
  ),
);

/**
 * Creates the root handles and assembles the complete guest-side binding prelude in dependency
 * order. This is the single composition point for code that becomes visible inside QuickJS.
 */
export function buildCesiumGuestPrelude(
  viewer: Viewer,
  handles: SandboxHandles,
  maxItemsPerCollection?: number,
): string {
  const viewerHandleId = handles.wrapRoot(createProxiedViewer(viewer, { maxItemsPerCollection }));
  const staticCesiumHandleId = handles.wrapRoot(AVAILABLE_CESIUM_NAMESPACE);

  return [
    buildCesiumValueTypeGuestPrelude(),
    buildCesiumHostBridgeGuestPrelude(),
    buildCesiumStaticFallbackGuestPrelude(staticCesiumHandleId),
    // The guest's live `viewer` binding: a plain `__remoteProxy__` wrapping the live Viewer's root
    // handle. `Viewer.prototype.flyTo`/`zoomTo` are genuinely Promise-returning, but need no
    // special-casing here -- the generic remote-proxy `apply` trap (`guest-prelude-host-bridge.ts`)
    // already bridges any Promise-returning call result back to the guest transparently via a real
    // `ctx.newPromise()` (see `registerHostApply` in `host-bridge.ts`), the same mechanism already
    // used for e.g. `viewer.dataSources.add(...)`. (An earlier design routed `flyTo`/`zoomTo`
    // guest-side through QuickJS's Asyncify mechanism instead, which reproducibly crashed the
    // interpreter with a native `free_zero_refcount` assertion failure -- removed in favor of this
    // already-safe generic path.)
    `const viewer = __remoteProxy__(${JSON.stringify(viewerHandleId)});`,
  ].join("\n");
}
