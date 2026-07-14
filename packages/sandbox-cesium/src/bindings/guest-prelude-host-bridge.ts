/**
 * Builds the guest-side generic "remote proxy" bridge: a recursive `Proxy` factory
 * (`__remoteProxy__`) that lets guest code call arbitrary methods/read arbitrary properties on a
 * host-side handle (e.g. the proxied `viewer`) without the host needing to pre-declare every
 * reachable symbol ahead of time. Every property access, assignment, call, and constructor
 * invocation is dispatched dynamically, by handle id, via four host bridge functions the caller
 * (`cesium-code-sandbox.ts`) must register before evaluating this prelude: `__hostGetSync__(handleId,
 * prop)`, `__hostSetSync__(handleId, prop, valueJson)`, `__hostApplySync__(handleId, argsJson)`,
 * and `__hostConstructSync__(handleId, argsJson)`.
 *
 * This deliberately never touches QuickJS's Asyncify bridge: every real CesiumJS `Viewer` call
 * this proxies is either already synchronous, or (like `camera.flyTo`/`dataSources.add`) resolves
 * once the operation *starts* rather than *completes* — a fire-and-forget style real production
 * code doesn't block on. To make that safe, remote-proxy objects deliberately never look like a
 * native `Promise` to the guest engine (their `then` property always resolves to `undefined`), so
 * `await`-ing one is a synchronous no-op instead of attempting to synchronously drive a real
 * host-side `Promise` to completion (which isn't possible without Asyncify). Only the small, fixed
 * set of genuinely async `Cesium.*` factories (see `buildCesiumAsyncFactoryGuestPrelude`) go
 * through the real Asyncify bridge.
 */
import { HANDLE_MARK, UNDEFINED_MARK, VALUE_TYPE_MARK } from "./sandbox-handles.js";

export function buildCesiumHostBridgeGuestPrelude(): string {
  return `
const __handleMark__ = ${JSON.stringify(HANDLE_MARK)};
const __valueTypeMark__ = ${JSON.stringify(VALUE_TYPE_MARK)};
const __undefinedMark__ = ${JSON.stringify(UNDEFINED_MARK)};
const __remoteProxyMarker__ = "__isCesiumRemoteProxy__";

// Recursively converts guest-provided call arguments back into JSON-safe data before they cross
// the boundary: remote-proxy objects (opaque host handles) become their \`{ [__handleMark__]: id }\`
// reference form again — plain \`JSON.stringify\` can't do this itself since a remote proxy's
// underlying target is a function (so it's callable), and JSON.stringify always drops functions.
// \`undefined\` is tagged too — plain JSON.stringify silently coerces it to \`null\` inside arrays,
// but callers often omit trailing optional arguments and real CesiumJS/test-double call sites can
// observably tell an explicit \`undefined\` apart from \`null\`.
function __marshalArg__(value) {
  if (value === undefined) {
    const out = {};
    out[__undefinedMark__] = true;
    return out;
  }
  if (typeof value === "function" && value[__remoteProxyMarker__]) {
    const out = {};
    out[__handleMark__] = value.__handleId__;
    return out;
  }
  if (Array.isArray(value)) return value.map(__marshalArg__);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key in value) out[key] = __marshalArg__(value[key]);
    return out;
  }
  return value;
}

// Recursively converts a value received from the host (a get/apply result) into its guest-side
// representation: opaque handle references become new remote proxies, tagged value-type data
// (Cartesian3, Color, ...) passes through as-is (already plain, guest-usable data), and everything
// else is walked elementwise.
function __reviveRemoteValue__(value) {
  if (Array.isArray(value)) return value.map(__reviveRemoteValue__);
  if (value !== null && typeof value === "object") {
    if (__handleMark__ in value) return __remoteProxy__(value[__handleMark__]);
    if (__valueTypeMark__ in value) return value;
    const out = {};
    for (const key in value) out[key] = __reviveRemoteValue__(value[key]);
    return out;
  }
  return value;
}

// Wraps a host-side handle id in a callable Proxy: reading a property does an immediate,
// synchronous host round trip (via __hostGetSync__), and calling it does the same via
// __hostApplySync__. The underlying target is a plain function so the Proxy itself is callable —
// required for method-shaped handles (e.g. \`viewer.camera.flyTo\`) — while property reads on it
// (e.g. \`viewer.camera\`, \`entity.position\`) work identically through the same \`get\` trap.
function __remoteProxy__(handleId) {
  const target = function () {};
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === __remoteProxyMarker__) return true;
      if (prop === "__handleId__") return handleId;
      // Never appear "thenable": these handles never represent a real Promise the guest engine
      // should chase — see the doc comment above.
      if (prop === "then" || typeof prop === "symbol") return undefined;
      const envelope = JSON.parse(__hostGetSync__(handleId, String(prop)));
      if (!envelope.ok) throw new Error(envelope.error);
      return __reviveRemoteValue__(envelope.value);
    },
    // Real CesiumJS is heavily property-assignment-driven (\`tileset.style = ...\`,
    // \`viewer.scene.globe.terrainProvider = ...\`, \`entity.polygon.material = ...\`,
    // \`viewer.clock.shouldAnimate = true\`, ...) — without this trap, \`proxyObj.prop = value\`
    // would fall through to the Proxy's default \`[[Set]]\` behavior against \`target\` (the inert
    // local \`function () {}\` above), silently mutating nothing the host/real Viewer can ever see.
    set(_target, prop, value) {
      const marshaled = __marshalArg__(value);
      const envelope = JSON.parse(
        __hostSetSync__(handleId, String(prop), JSON.stringify(marshaled)),
      );
      if (!envelope.ok) throw new Error(envelope.error);
      return true;
    },
    apply(_target, _thisArg, args) {
      const marshaled = args.map(__marshalArg__);
      const envelope = JSON.parse(__hostApplySync__(handleId, JSON.stringify(marshaled)));
      if (!envelope.ok) throw new Error(envelope.error);
      return __reviveRemoteValue__(envelope.value);
    },
    // Supports \`new Cesium.SomeClass(...)\` for real CesiumJS classes reached through the static
    // namespace fallback (see \`buildCesiumStaticFallbackGuestPrelude\`) — e.g. \`new
    // Cesium.PinBuilder()\`, \`new Cesium.WebMapServiceImageryProvider({...})\`. Routes through
    // \`__hostConstructSync__\`, which does a real \`Reflect.construct\` host-side.
    construct(_target, args) {
      const marshaled = args.map(__marshalArg__);
      const envelope = JSON.parse(__hostConstructSync__(handleId, JSON.stringify(marshaled)));
      if (!envelope.ok) throw new Error(envelope.error);
      return __reviveRemoteValue__(envelope.value);
    },
  });
}
  `.trim();
}