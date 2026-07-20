/**
 * Builds the guest-side generic "remote proxy" bridge: a recursive `Proxy` factory
 * (`__remoteProxy__`) that lets guest code call arbitrary methods/read arbitrary properties on a
 * host-side handle (e.g. the proxied `viewer`) without the host needing to pre-declare every
 * reachable symbol ahead of time. Every property access, assignment, call, and constructor
 * invocation is dispatched dynamically, by handle id, via four host bridge functions the caller
 * (`host-bridge.ts`) must register before evaluating this prelude: `__cesiumSandboxHostGetSync__`
 * (`handleId, prop`), `__cesiumSandboxHostSetSync__` (`handleId, prop, valueJson`),
 * `__cesiumSandboxHostApplySync__` (`handleId, argsJson`), and `__cesiumSandboxHostConstructSync__`
 * (`handleId, argsJson`) — the `__cesiumSandbox`-prefixed names are this package's own globals, not
 * anything QuickJS itself defines.
 *
 * Property access and synchronous calls do not touch QuickJS's Asyncify bridge. When a call
 * returns a host Promise, `__cesiumSandboxHostApplySync__` itself returns a genuine QuickJS
 * promise (bridged host-side via `ctx.newPromise()`, not Asyncify) that resolves to the same
 * JSON envelope a synchronous call would have returned directly — the `apply` trap below awaits
 * it transparently either way.
 */
import { extractFunctionBody } from "./function-source.js";
import {
  DATE_MARK,
  HANDLE_MARK,
  NATIVE_CONSTRUCTOR_MARK,
  UNDEFINED_MARK,
  VALUE_TYPE_MARK,
} from "./sandbox-handles.js";
import { CESIUM_VALUE_TYPE_DEFINITIONS } from "./generated/value-type-registry.js";

// Ambient shims for guest-only globals `guestHostBridgeBody` references: `__handleMark__`/
// `__valueTypeMark__` are injected as `const` declarations ahead of the extracted body (see
// `buildCesiumHostBridgeGuestPrelude` below), `__CesiumCoreBundle__` is declared by
// `guest-prelude-value-types.ts`'s prelude (evaluated first), and the four
// `__cesiumSandboxHost*Sync__` functions are registered host-side by `host-bridge.ts` before this
// prelude runs. None
// of these `declare`s emit any JS or appear in the extracted text — they exist purely so this
// file's guest-side logic can be written as a real, type-checked function instead of an opaque
// template-literal string.
declare const __handleMark__: string;
declare const __valueTypeMark__: string;
declare const __undefinedMark__: string;
declare const __dateMark__: string;
declare const __nativeConstructorMark__: string;
declare const __valueTypeDefinitions__: readonly {
  name: string;
  fields: readonly string[];
}[];
declare const __CesiumCoreBundle__: {
  [name: string]: new (...args: never[]) => any;
};
declare function __cesiumSandboxHostGetSync__(handleId: string, prop: string): string;
declare function __cesiumSandboxHostSetSync__(
  handleId: string,
  prop: string,
  valueJson: string,
): string;
declare function __cesiumSandboxHostApplySync__(
  handleId: string,
  argsJson: string,
): string | Promise<string>;
declare function __cesiumSandboxHostConstructSync__(handleId: string, argsJson: string): string;

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
    if (typeof value === "function") {
      if (value === Number || value === String || value === Boolean) {
        const out: Record<string, unknown> = {};
        out[__nativeConstructorMark__] = value.name;
        return out;
      }
      throw new Error(
        "Guest callbacks cannot cross the Cesium sandbox boundary because the guest VM is disposed after execution.",
      );
    }
    if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as { then?: unknown }).then === "function"
    ) {
      throw new Error(
        "A Promise cannot be passed to a Cesium API. Await the Promise and pass its resolved value instead.",
      );
    }
    if (value instanceof Date) {
      const out: Record<string, unknown> = {};
      out[__dateMark__] = value.toISOString();
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
    for (const definition of __valueTypeDefinitions__) {
      if (value instanceof C[definition.name]) {
        const tagged: Record<string, unknown> = {
          [__valueTypeMark__]: definition.name,
        };
        for (const field of definition.fields) tagged[field] = value[field];
        return tagged;
      }
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
      if (__dateMark__ in value) return new Date(value[__dateMark__]);
      const out: Record<string, unknown> = {};
      for (const key in value) out[key] = __reviveRemoteValue__(value[key]);
      return out;
    }
    return value;
  }

  // Wraps a host-side handle id in a callable Proxy: reading a property does an immediate,
  // synchronous host round trip (via __cesiumSandboxHostGetSync__), and calling it does the same
  // via __cesiumSandboxHostApplySync__. The underlying target is a plain function so the Proxy itself is
  // callable — required for method-shaped handles (e.g. `viewer.camera.flyTo`) — while property
  // reads on it (e.g. `viewer.camera`, `entity.position`) work identically through the same `get`
  // trap.
  function __remoteProxy__(handleId: string): unknown {
    const target = function () {};
    return new Proxy(target, {
      get(_target, prop) {
        if (prop === __remoteProxyMarker__) return true;
        if (prop === "__handleId__") return handleId;
        if (typeof prop === "symbol") return undefined;
        const envelope = JSON.parse(__cesiumSandboxHostGetSync__(handleId, String(prop)));
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
          __cesiumSandboxHostSetSync__(handleId, String(prop), JSON.stringify(marshaled)),
        );
        if (!envelope.ok) throw new Error(envelope.error);
        return true;
      },
      apply(_target, _thisArg, args) {
        const marshaled = args.map(__marshalArg__);
        const raw = __cesiumSandboxHostApplySync__(handleId, JSON.stringify(marshaled));
        // A Promise-returning host call bridges back as a genuine QuickJS promise (see
        // `registerHostApply` in `host-bridge.ts`) rather than a JSON string — awaiting/`.then`-ing
        // it here works exactly like awaiting the result of any other async call.
        if (
          raw !== null &&
          typeof raw === "object" &&
          typeof (raw as { then?: unknown }).then === "function"
        ) {
          return (raw as Promise<string>).then((json) => {
            const envelope = JSON.parse(json);
            if (!envelope.ok) throw new Error(envelope.error);
            return __reviveRemoteValue__(envelope.value);
          });
        }
        const envelope = JSON.parse(raw as string);
        if (!envelope.ok) throw new Error(envelope.error);
        return __reviveRemoteValue__(envelope.value);
      },
      // Supports `new Cesium.SomeClass(...)` for real CesiumJS classes reached through the
      // static namespace fallback (see `buildCesiumStaticFallbackGuestPrelude`) — e.g. `new
      // Cesium.PinBuilder()`, `new Cesium.WebMapServiceImageryProvider({...})`. Routes through
      // `__cesiumSandboxHostConstructSync__`, which does a real `Reflect.construct` host-side.
      construct(_target, args) {
        const marshaled = args.map(__marshalArg__);
        const envelope = JSON.parse(
          __cesiumSandboxHostConstructSync__(handleId, JSON.stringify(marshaled)),
        );
        if (!envelope.ok) throw new Error(envelope.error);
        return __reviveRemoteValue__(envelope.value) as object;
      },
    });
  }
}

export function buildCesiumHostBridgeGuestPrelude(): string {
  const valueTypeDefinitions = CESIUM_VALUE_TYPE_DEFINITIONS.map(({ name, fields }) => ({
    name,
    fields,
  }));
  return [
    `const __handleMark__ = ${JSON.stringify(HANDLE_MARK)};`,
    `const __valueTypeMark__ = ${JSON.stringify(VALUE_TYPE_MARK)};`,
    `const __undefinedMark__ = ${JSON.stringify(UNDEFINED_MARK)};`,
    `const __dateMark__ = ${JSON.stringify(DATE_MARK)};`,
    `const __nativeConstructorMark__ = ${JSON.stringify(NATIVE_CONSTRUCTOR_MARK)};`,
    `const __valueTypeDefinitions__ = ${JSON.stringify(valueTypeDefinitions)};`,
    extractFunctionBody(guestHostBridgeBody),
  ].join("\n");
}
