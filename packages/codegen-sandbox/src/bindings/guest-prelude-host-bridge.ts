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
import { extractFunctionBody } from "./function-source.js";
import { HANDLE_MARK, UNDEFINED_MARK, VALUE_TYPE_MARK } from "./sandbox-handles.js";

// Ambient shims for guest-only globals `guestHostBridgeBody` references: `__handleMark__`/
// `__valueTypeMark__` are injected as `const` declarations ahead of the extracted body (see
// `buildCesiumHostBridgeGuestPrelude` below), `__CesiumCoreBundle__` is declared by
// `guest-prelude-value-types.ts`'s prelude (evaluated first), and the four `__host*Sync__`
// functions are registered host-side by `cesium-code-sandbox.ts` before this prelude runs. None
// of these `declare`s emit any JS or appear in the extracted text — they exist purely so this
// file's guest-side logic can be written as a real, type-checked function instead of an opaque
// template-literal string.
declare const __handleMark__: string;
declare const __valueTypeMark__: string;
declare const __undefinedMark__: string;
declare const __CesiumCoreBundle__: {
  Cartesian2: new (...args: never[]) => any;
  Cartesian3: new (...args: never[]) => any;
  Cartographic: new (...args: never[]) => any;
  Color: new (...args: never[]) => any;
  HeadingPitchRange: new (...args: never[]) => any;
  HeadingPitchRoll: new (...args: never[]) => any;
  NearFarScalar: new (...args: never[]) => any;
};
declare function __hostGetSync__(handleId: string, prop: string): string;
declare function __hostSetSync__(handleId: string, prop: string, valueJson: string): string;
declare function __hostApplySync__(handleId: string, argsJson: string): string;
declare function __hostConstructSync__(handleId: string, argsJson: string): string;

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the guest-side generic remote-proxy bridge described in this
 * file's top-level doc comment.
 */
function guestHostBridgeBody(): void {
  const __remoteProxyMarker__ = "__isCesiumRemoteProxy__";

  // Recursively converts guest-provided call arguments back into JSON-safe data before they cross
  // the boundary: remote-proxy objects (opaque host handles) become their `{ [__handleMark__]: id
  // }` reference form again — plain `JSON.stringify` can't do this itself since a remote proxy's
  // underlying target is a function (so it's callable), and JSON.stringify always drops
  // functions. `undefined` is tagged too — plain JSON.stringify silently coerces it to `null`
  // inside arrays, but callers often omit trailing optional arguments and real CesiumJS/
  // test-double call sites can observably tell an explicit `undefined` apart from `null`.
  function __marshalArg__(value: any): unknown {
    if (value === undefined) {
      const out: Record<string, unknown> = {};
      out[__undefinedMark__] = true;
      return out;
    }
    if (typeof value === "function" && value[__remoteProxyMarker__]) {
      const out: Record<string, unknown> = {};
      out[__handleMark__] = value.__handleId__;
      return out;
    }
    if (Array.isArray(value)) return value.map(__marshalArg__);
    if (value !== null && typeof value === "object") {
      const tagged = __tagCesiumValueType__(value);
      if (tagged) return tagged;
      const out: Record<string, unknown> = {};
      for (const key in value) out[key] = __marshalArg__(value[key]);
      return out;
    }
    return value;
  }

  // Tags a real, guest-side CesiumJS value-type instance (`Cartesian2`, `Cartesian3`,
  // `Cartographic`, `Color`, `HeadingPitchRange`, `HeadingPitchRoll`, `NearFarScalar` — see
  // `guest-prelude-value-types.ts`, which evaluates `__CesiumCoreBundle__` before this prelude
  // runs) with its JSON-safe `__cesiumType__`-tagged encoding, or returns `undefined` if `value`
  // isn't one of these. Unlike the previous hand-written value-type prelude (which stamped the
  // tag at construction time), these are the *real* CesiumJS classes — their own static factories
  // (`Cartesian3.fromDegrees`, `Color.fromCssColorString`, ...) construct instances directly with
  // no way to also stamp a sandbox-specific tag — so tagging instead happens here, by
  // `instanceof`, at the point a value actually crosses the boundary.
  function __tagCesiumValueType__(value: any): Record<string, unknown> | undefined {
    const C = __CesiumCoreBundle__;
    if (value instanceof C.Cartesian2) {
      return { [__valueTypeMark__]: "Cartesian2", x: value.x, y: value.y };
    }
    if (value instanceof C.Cartesian3) {
      return { [__valueTypeMark__]: "Cartesian3", x: value.x, y: value.y, z: value.z };
    }
    if (value instanceof C.Cartographic) {
      return {
        [__valueTypeMark__]: "Cartographic",
        longitude: value.longitude,
        latitude: value.latitude,
        height: value.height,
      };
    }
    if (value instanceof C.Color) {
      return {
        [__valueTypeMark__]: "Color",
        red: value.red,
        green: value.green,
        blue: value.blue,
        alpha: value.alpha,
      };
    }
    if (value instanceof C.HeadingPitchRange) {
      return {
        [__valueTypeMark__]: "HeadingPitchRange",
        heading: value.heading,
        pitch: value.pitch,
        range: value.range,
      };
    }
    if (value instanceof C.HeadingPitchRoll) {
      return {
        [__valueTypeMark__]: "HeadingPitchRoll",
        heading: value.heading,
        pitch: value.pitch,
        roll: value.roll,
      };
    }
    if (value instanceof C.NearFarScalar) {
      return {
        [__valueTypeMark__]: "NearFarScalar",
        near: value.near,
        nearValue: value.nearValue,
        far: value.far,
        farValue: value.farValue,
      };
    }
    return undefined;
  }

  // Recursively converts a value received from the host (a get/apply result) into its guest-side
  // representation: opaque handle references become new remote proxies, tagged value-type data
  // (Cartesian3, Color, ...) passes through as-is (already plain, guest-usable data), and
  // everything else is walked elementwise.
  function __reviveRemoteValue__(value: any): unknown {
    if (Array.isArray(value)) return value.map(__reviveRemoteValue__);
    if (value !== null && typeof value === "object") {
      if (__handleMark__ in value) return __remoteProxy__(value[__handleMark__]);
      if (__valueTypeMark__ in value) return value;
      const out: Record<string, unknown> = {};
      for (const key in value) out[key] = __reviveRemoteValue__(value[key]);
      return out;
    }
    return value;
  }

  // Wraps a host-side handle id in a callable Proxy: reading a property does an immediate,
  // synchronous host round trip (via __hostGetSync__), and calling it does the same via
  // __hostApplySync__. The underlying target is a plain function so the Proxy itself is
  // callable — required for method-shaped handles (e.g. `viewer.camera.flyTo`) — while property
  // reads on it (e.g. `viewer.camera`, `entity.position`) work identically through the same `get`
  // trap.
  function __remoteProxy__(handleId: string): unknown {
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
      // Real CesiumJS is heavily property-assignment-driven (`tileset.style = ...`,
      // `viewer.scene.globe.terrainProvider = ...`, `entity.polygon.material = ...`,
      // `viewer.clock.shouldAnimate = true`, ...) — without this trap, `proxyObj.prop = value`
      // would fall through to the Proxy's default `[[Set]]` behavior against `target` (the inert
      // local `function () {}` above), silently mutating nothing the host/real Viewer can ever
      // see.
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
      // Supports `new Cesium.SomeClass(...)` for real CesiumJS classes reached through the
      // static namespace fallback (see `buildCesiumStaticFallbackGuestPrelude`) — e.g. `new
      // Cesium.PinBuilder()`, `new Cesium.WebMapServiceImageryProvider({...})`. Routes through
      // `__hostConstructSync__`, which does a real `Reflect.construct` host-side.
      construct(_target, args) {
        const marshaled = args.map(__marshalArg__);
        const envelope = JSON.parse(__hostConstructSync__(handleId, JSON.stringify(marshaled)));
        if (!envelope.ok) throw new Error(envelope.error);
        return __reviveRemoteValue__(envelope.value) as object;
      },
    });
  }
}

export function buildCesiumHostBridgeGuestPrelude(): string {
  return [
    `const __handleMark__ = ${JSON.stringify(HANDLE_MARK)};`,
    `const __valueTypeMark__ = ${JSON.stringify(VALUE_TYPE_MARK)};`,
    `const __undefinedMark__ = ${JSON.stringify(UNDEFINED_MARK)};`,
    extractFunctionBody(guestHostBridgeBody),
  ].join("\n");
}