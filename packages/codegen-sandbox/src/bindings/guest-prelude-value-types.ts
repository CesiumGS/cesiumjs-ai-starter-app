/**
 * Builds the guest-side JS prelude for CesiumJS *value* types (`Cartesian2`, `Cartesian3`,
 * `Cartographic`, `Color`, `HeadingPitchRange`, `HeadingPitchRoll`, `NearFarScalar`) and common
 * enums (`VerticalOrigin`, `HorizontalOrigin`, `HeightReference`, `LabelStyle`,
 * `ClassificationType`, `ShadowMode`) plus `Cesium.Math`.
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
 * actually cross the boundary. Only `Cesium3DTileStyle` (a thin passthrough wrapper, not a pure
 * value type worth bundling) is still tagged eagerly here, same as before.
 *
 * Every symbol is declared both under the `Cesium.` namespace (matching real CesiumJS usage,
 * e.g. `Cesium.Cartesian3.fromDegrees`) AND as a bare top-level global (e.g. `Cartesian3`,
 * `Color`, `LabelStyle`) — real-world CesiumJS snippets very commonly destructure these off the
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

// Ambient shims for guest-only globals `guestValueTypeBody` references: `__valueTypeMark__` is
// declared (as a top-level `const`) by `guest-prelude-host-bridge.ts`'s prelude — evaluated
// *after* this one (per this file's own doc comment above), but that's safe here because
// `__cesiumTileStyle__` only *closes over* the name; it isn't invoked until real generated code
// constructs a `Cesium3DTileStyle`, by which point every prelude (including host-bridge's) has
// already run. Do NOT also declare a `const __valueTypeMark__ = ...` in this file's own prelude
// output — that would be a genuine duplicate top-level declaration once concatenated with
// host-bridge's (QuickJS parse error: "invalid redefinition of lexical identifier"). Neither this
// nor `__CesiumCoreBundle__` (declared by `CESIUM_CORE_BUNDLE_SOURCE`, evaluated immediately
// before this body) emit any JS or appear in the extracted text — they exist purely so this
// file's guest-side logic can be written as a real, type-checked function instead of an opaque
// template-literal string.
declare const __valueTypeMark__: string;
declare const __CesiumCoreBundle__: {
  CesiumMath: unknown;
  Cartesian2: unknown;
  Cartesian3: unknown;
  Cartographic: unknown;
  Color: unknown;
  HeadingPitchRange: unknown;
  HeadingPitchRoll: unknown;
  NearFarScalar: unknown;
};

/**
 * Never invoked — exists only so `extractFunctionBody` can recover its exact source text (see
 * `function-source.ts`). Declares the guest-side value types/enums described in this file's
 * top-level doc comment.
 */
function guestValueTypeBody(): void {
  function __cesiumTileStyle__(style: any): Record<string, unknown> {
    return { [__valueTypeMark__]: "Cesium3DTileStyle", style: style || {} };
  }

  // `let`, not `const`: `buildCesiumStaticFallbackGuestPrelude` (evaluated later, after the host
  // bridge prelude) reassigns this binding to a Proxy wrapping the same underlying object, so
  // property reads for real CesiumJS classes not explicitly bound below (`Rectangle`,
  // `Ellipsoid`, `PinBuilder`, ...) transparently fall back to the real static `Cesium` module
  // host-side.
  let Cesium: any = {};

  Cesium.Math = __CesiumCoreBundle__.CesiumMath;
  Cesium.Cartesian2 = __CesiumCoreBundle__.Cartesian2;
  Cesium.Cartesian3 = __CesiumCoreBundle__.Cartesian3;
  Cesium.Cartographic = __CesiumCoreBundle__.Cartographic;
  Cesium.Color = __CesiumCoreBundle__.Color;
  Cesium.HeadingPitchRange = __CesiumCoreBundle__.HeadingPitchRange;
  Cesium.HeadingPitchRoll = __CesiumCoreBundle__.HeadingPitchRoll;
  Cesium.NearFarScalar = __CesiumCoreBundle__.NearFarScalar;
  Cesium.Cesium3DTileStyle = function (style: any) {
    return __cesiumTileStyle__(style);
  };

  Cesium.VerticalOrigin = { CENTER: 0, BOTTOM: 1, BASELINE: 2, TOP: -1 };
  Cesium.HorizontalOrigin = { CENTER: 0, LEFT: 1, RIGHT: -1 };
  Cesium.HeightReference = { NONE: 0, CLAMP_TO_GROUND: 1, RELATIVE_TO_GROUND: 2 };
  Cesium.LabelStyle = { FILL: 0, OUTLINE: 1, FILL_AND_OUTLINE: 2 };
  Cesium.ClassificationType = { TERRAIN: 0, CESIUM_3D_TILE: 1, BOTH: 2 };
  Cesium.ShadowMode = { DISABLED: 0, ENABLED: 1, CAST_ONLY: 2, RECEIVE_ONLY: 3 };

  // Bare top-level aliases for every value type/enum above (in addition to the `Cesium.`
  // namespace) — real-world CesiumJS snippets commonly destructure these off the `Cesium` import
  // and reference them bare (e.g. `Cartesian3.fromDegrees(...)`, `Color.WHITE`,
  // `LabelStyle.FILL_AND_OUTLINE`), so both forms must resolve to avoid a spurious "X is not
  // defined" ReferenceError.
  const Cartesian2 = Cesium.Cartesian2;
  const Cartesian3 = Cesium.Cartesian3;
  const Cartographic = Cesium.Cartographic;
  const Color = Cesium.Color;
  const NearFarScalar = Cesium.NearFarScalar;
  const HeadingPitchRange = Cesium.HeadingPitchRange;
  const HeadingPitchRoll = Cesium.HeadingPitchRoll;
  const Cesium3DTileStyle = Cesium.Cesium3DTileStyle;
  const VerticalOrigin = Cesium.VerticalOrigin;
  const HorizontalOrigin = Cesium.HorizontalOrigin;
  const HeightReference = Cesium.HeightReference;
  const LabelStyle = Cesium.LabelStyle;
  const ClassificationType = Cesium.ClassificationType;
  const ShadowMode = Cesium.ShadowMode;
  // Real CesiumJS code conventionally imports `Math` under the alias `CesiumMath` (since `Math`
  // collides with the built-in global), e.g. `import { Math as CesiumMath } from "cesium"`, then
  // calls `CesiumMath.toDegrees(...)`. Bind that exact conventional bare name too (not `Math`
  // itself, which would shadow the native global relied on throughout this prelude).
  const CesiumMath = Cesium.Math;
  // Referenced so `noUnusedLocals` doesn't flag these bare aliases as unused from TypeScript's
  // perspective — guest code that references them lives outside this compilation unit entirely.
  void [
    Cartesian2,
    Cartesian3,
    Cartographic,
    Color,
    NearFarScalar,
    HeadingPitchRange,
    HeadingPitchRoll,
    Cesium3DTileStyle,
    VerticalOrigin,
    HorizontalOrigin,
    HeightReference,
    LabelStyle,
    ClassificationType,
    ShadowMode,
    CesiumMath,
  ];
}

export function buildCesiumValueTypeGuestPrelude(): string {
  return [CESIUM_CORE_BUNDLE_SOURCE, extractFunctionBody(guestValueTypeBody)].join("\n");
}
