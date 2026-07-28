/**
 * Builds the guest-side JS prelude for CesiumJS *value* types (`Cartesian2`, `Cartesian3`,
 * `Cartographic`, `Color`, `HeadingPitchRange`, `HeadingPitchRoll`, `NearFarScalar`), automatically
 * discovered immutable primitive enum/constant records, and `Cesium.Math`.
 *
 * The value types and `Math` are the *real* CesiumJS classes — not a hand-rolled reimplementation
 * — evaluated from `CESIUM_CORE_BUNDLE_SOURCE` (see `generated/cesium-core-bundle.ts`, produced by
 * `scripts/generate-cesium-core-bundle.mjs` from `@cesium/engine`'s `Source/Core/*.js`). These are
 * pure, side-effect-free math/data classes with no WebGL/DOM/network dependency, so running them
 * unmodified inside the guest is both safe (nothing here can reach a real CesiumJS object or the
 * live `Viewer`) and removes an entire class of "the model used a real Cesium API this hand-rolled
 * version doesn't cover" gaps (exact geodetic math, the full named-CSS-color table via
 * `Color.<NAME>`/`Color.fromCssColorString`, `Color.fromHsl`, ...). Unlike the previous
 * hand-written version, instances aren't tagged at construction time (the real classes' own static
 * factories — `Cartesian3.fromDegrees`, `Color.fromCssColorString`, ... — construct instances
 * directly and have no reason to know about this sandbox's marshaling); instead
 * `guest-prelude-host-bridge.ts`'s `__marshalArg__` tags them by `instanceof` at the point they
 * actually cross the boundary.
 *
 * Every generated symbol is declared both under the `Cesium.` namespace (matching real CesiumJS
 * usage, e.g. `Cesium.Cartesian3.fromDegrees`) AND as a bare top-level global (e.g. `Cartesian3`,
 * `Color`, `ArcType`) — real-world CesiumJS snippets very commonly destructure these off the
 * `Cesium` import (`const { Cartesian3 } = Cesium;` or `import { Cartesian3 } from "cesium"`) and
 * then reference them bare, so requiring the `Cesium.` prefix everywhere would reject otherwise
 * idiomatic generated code with a spurious "X is not defined" `ReferenceError`.
 *
 * Must be evaluated in the guest **before** `guest-prelude-host-bridge.ts`'s output — it declares
 * `Cesium` (and `__CesiumCoreBundle__`) itself, which that attaches the live `viewer`-bridge and
 * value-type tagging onto.
 */
import { extractFunctionBody } from "./function-source.js";
import { CESIUM_CORE_BUNDLE_SOURCE } from "./generated/cesium-core-bundle.js";
import {
  CESIUM_GUEST_CONSTANT_ALIASES,
  CESIUM_GUEST_CONSTANTS,
  CESIUM_VALUE_TYPE_GUEST_ALIASES,
  CESIUM_VALUE_TYPE_NAMES,
} from "./generated/value-type-registry.js";

// Ambient shims for guest-only globals referenced by `guestValueTypeBody`. They emit no JS and do
// not appear in the extracted function text; they only let the guest logic remain type-checked.
declare const __guestConstants__: Record<
  string,
  Readonly<Record<string, string | number | boolean | null>>
>;
declare const __valueTypeNames__: readonly string[];
declare const __CesiumCoreBundle__: Record<string, unknown>;

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the guest-side value types/enums described in this file's
 * top-level doc comment. Generated enum/constant assignments and aliases are supplied by
 * `buildCesiumValueTypeGuestPrelude` rather than handwritten in this body.
 */
function guestValueTypeBody(): void {
  // `let`, not `const`: `buildCesiumStaticFallbackGuestPrelude` (evaluated later, after the host
  // bridge prelude) reassigns this binding to a Proxy wrapping the same underlying object, so
  // property reads for real CesiumJS classes not explicitly bound below (`Rectangle`,
  // `Ellipsoid`, `PinBuilder`, ...) transparently fall back to the real static `Cesium` module
  // host-side.
  let Cesium: any = {};

  Cesium.Math = __CesiumCoreBundle__.CesiumMath;
  for (const name of __valueTypeNames__) Cesium[name] = __CesiumCoreBundle__[name];
  for (const [name, value] of Object.entries(__guestConstants__)) Cesium[name] = value;

  // Bare top-level aliases for every value type/enum above (in addition to the `Cesium.`
  // namespace) — real-world CesiumJS snippets commonly destructure these off the `Cesium` import
  // and reference them bare (e.g. `Cartesian3.fromDegrees(...)`, `Color.WHITE`,
  // `LabelStyle.FILL_AND_OUTLINE`), so both forms must resolve to avoid a spurious "X is not
  // defined" ReferenceError.
  // Real CesiumJS code conventionally imports `Math` under the alias `CesiumMath` (since `Math`
  // collides with the built-in global), e.g. `import { Math as CesiumMath } from "cesium"`, then
  // calls `CesiumMath.toDegrees(...)`. Bind that exact conventional bare name too (not `Math`
  // itself, which would shadow the native global relied on throughout this prelude).
  const CesiumMath = Cesium.Math;

  // Generated code frequently sprinkles in `console.log`/`console.warn` calls for debugging even
  // when not asked to, and unlike Node or a browser, QuickJS has no `console` global at all — so
  // without this, otherwise-correct generated code fails at runtime with a spurious "console is
  // not defined" ReferenceError. A no-op shim removes this whole class of failure with zero host
  // round-trip and zero security surface (nothing here can reach the real DOM/devtools console).
  const console = {
    log() {},
    warn() {},
    error() {},
    info() {},
    debug() {},
  };

  // Referenced so `noUnusedLocals` doesn't flag these bare aliases as unused from TypeScript's
  // perspective — guest code that references them lives outside this compilation unit entirely.
  void [CesiumMath, console];
}

export function buildCesiumValueTypeGuestPrelude(): string {
  return [
    CESIUM_CORE_BUNDLE_SOURCE,
    `const __valueTypeNames__ = ${JSON.stringify(CESIUM_VALUE_TYPE_NAMES)};`,
    `const __guestConstants__ = ${JSON.stringify(CESIUM_GUEST_CONSTANTS)};`,
    extractFunctionBody(guestValueTypeBody),
    CESIUM_VALUE_TYPE_GUEST_ALIASES,
    CESIUM_GUEST_CONSTANT_ALIASES,
  ].join("\n");
}
