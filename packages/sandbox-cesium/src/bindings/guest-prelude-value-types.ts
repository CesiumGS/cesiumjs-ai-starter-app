/**
 * Builds the guest-side JS prelude for CesiumJS *value* types (`Cartesian2`, `Cartesian3`,
 * `Color`, `NearFarScalar`) and common enums (`VerticalOrigin`, `HorizontalOrigin`,
 * `HeightReference`, `LabelStyle`, `ClassificationType`, `ShadowMode`) plus `Cesium.Math`. Unlike
 * the generic remote-proxy bridge (`guest-prelude-host-bridge.ts`), none of this crosses into a
 * host call at all: these are pure, side-effect-free math/data (ellipsoid geodetic conversion,
 * RGBA arithmetic, plain numeric enums), so reimplementing them directly in guest JS is both safe
 * (nothing here can reach a real CesiumJS object or the live `Viewer`) and removes an entire class
 * of "the model wrote idiomatic CesiumJS but this specific symbol was never bound" failures for
 * the most commonly generated value types. Values constructed here are tagged with
 * `__cesiumType__` (see `VALUE_TYPE_MARK` in `sandbox-handles.ts`) so `SandboxHandles.unwrap` can
 * revive them into real CesiumJS instances the one time it matters: when they're passed into an
 * actual bound call like `viewer.entities.add`.
 *
 * Every symbol is declared both under the `Cesium.` namespace (matching real CesiumJS usage,
 * e.g. `Cesium.Cartesian3.fromDegrees`) AND as a bare top-level global (e.g. `Cartesian3`,
 * `Color`, `LabelStyle`) — real-world CesiumJS snippets very commonly destructure these off the
 * `Cesium` import (`const { Cartesian3 } = Cesium;` or `import { Cartesian3 } from "cesium"`) and
 * then reference them bare, so requiring the `Cesium.` prefix everywhere would reject otherwise
 * idiomatic generated code with a spurious "X is not defined" `ReferenceError`.
 *
 * Must be evaluated in the guest **before** `guest-prelude-host-bridge.ts`'s and
 * `cesium-async-factories.ts`'s output — it declares `Cesium` itself, which those attach the live
 * `viewer`-bridge and async factories onto.
 */
import { VALUE_TYPE_MARK } from "./sandbox-handles.js";

/**
 * CSS3 extended color keyword table (0-255 RGB), used to back both `Cesium.Color.<NAME>` static
 * constants and `Cesium.Color.fromCssColorString`'s named-color lookup in the guest-side value-type
 * prelude below. Not exhaustive of every CSS keyword CesiumJS itself recognizes, but covers the
 * common set generated code overwhelmingly reaches for (primary/secondary colors, greys, and the
 * most frequently used "designer" names).
 */
const NAMED_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  aqua: [0, 255, 255],
  magenta: [255, 0, 255],
  fuchsia: [255, 0, 255],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  brown: [165, 42, 42],
  gold: [255, 215, 0],
  silver: [192, 192, 192],
  navy: [0, 0, 128],
  teal: [0, 128, 128],
  lime: [0, 255, 0],
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  coral: [255, 127, 80],
  salmon: [250, 128, 114],
  khaki: [240, 230, 140],
  violet: [238, 130, 238],
  indigo: [75, 0, 130],
  turquoise: [64, 224, 208],
  crimson: [220, 20, 60],
  chocolate: [210, 105, 30],
  orchid: [218, 112, 214],
  plum: [221, 160, 221],
  orangered: [255, 69, 0],
  darkgreen: [0, 100, 0],
  darkblue: [0, 0, 139],
  darkred: [139, 0, 0],
  lightblue: [173, 216, 230],
  lightgreen: [144, 238, 144],
  lightyellow: [255, 255, 224],
  skyblue: [135, 206, 235],
  steelblue: [70, 130, 180],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  tomato: [255, 99, 71],
  wheat: [245, 222, 179],
  tan: [210, 180, 140],
  beige: [245, 245, 220],
  ivory: [255, 255, 240],
  lavender: [230, 230, 250],
  mintcream: [245, 255, 250],
  hotpink: [255, 105, 180],
  deeppink: [255, 20, 147],
  dodgerblue: [30, 144, 255],
  royalblue: [65, 105, 225],
  mediumblue: [0, 0, 205],
  darkorange: [255, 140, 0],
  forestgreen: [34, 139, 34],
  seagreen: [46, 139, 87],
  springgreen: [0, 255, 127],
  yellowgreen: [154, 205, 50],
  darkkhaki: [189, 183, 107],
  palegreen: [152, 251, 152],
  powderblue: [176, 224, 230],
  midnightblue: [25, 25, 112],
};

export function buildCesiumValueTypeGuestPrelude(): string {
  return `
const __namedColors__ = ${JSON.stringify(NAMED_COLORS)};

function __cesiumCartesian2__(x, y) {
  return { ${JSON.stringify(VALUE_TYPE_MARK)}: "Cartesian2", x: x || 0, y: y || 0 };
}
function __cesiumCartesian3__(x, y, z) {
  return { ${JSON.stringify(VALUE_TYPE_MARK)}: "Cartesian3", x: x || 0, y: y || 0, z: z || 0 };
}
function __cesiumColor__(red, green, blue, alpha) {
  return {
    ${JSON.stringify(VALUE_TYPE_MARK)}: "Color",
    red: red === undefined ? 1 : red,
    green: green === undefined ? 1 : green,
    blue: blue === undefined ? 1 : blue,
    alpha: alpha === undefined ? 1 : alpha,
    withAlpha: function (a) { return __cesiumColor__(this.red, this.green, this.blue, a); },
    clone: function () { return __cesiumColor__(this.red, this.green, this.blue, this.alpha); },
  };
}
// WGS84 geodetic-to-ECEF conversion, matching CesiumJS's own Ellipsoid.WGS84-based
// Cartesian3.fromRadians/fromDegrees math (semi-major/minor axes below).
function __cesiumFromRadians__(longitude, latitude, height) {
  height = height || 0;
  const a = 6378137.0;
  const b = 6356752.3142451793;
  const aSq = a * a;
  const bSq = b * b;
  const cosLat = Math.cos(latitude);
  let x = cosLat * Math.cos(longitude);
  let y = cosLat * Math.sin(longitude);
  let z = Math.sin(latitude);
  const mag = Math.sqrt(x * x + y * y + z * z);
  x /= mag; y /= mag; z /= mag;
  let kx = x * aSq, ky = y * aSq, kz = z * bSq;
  const gamma = Math.sqrt(x * kx + y * ky + z * kz);
  kx /= gamma; ky /= gamma; kz /= gamma;
  const hx = x * height, hy = y * height, hz = z * height;
  return __cesiumCartesian3__(kx + hx, ky + hy, kz + hz);
}
function __cesiumFromDegrees__(lon, lat, height) {
  return __cesiumFromRadians__(lon * Math.PI / 180, lat * Math.PI / 180, height);
}
function __cesiumCartographic__(longitude, latitude, height) {
  return {
    ${JSON.stringify(VALUE_TYPE_MARK)}: "Cartographic",
    longitude: longitude || 0,
    latitude: latitude || 0,
    height: height || 0,
  };
}
function __cesiumHeadingPitchRange__(heading, pitch, range) {
  return {
    ${JSON.stringify(VALUE_TYPE_MARK)}: "HeadingPitchRange",
    heading: heading || 0,
    pitch: pitch || 0,
    range: range || 0,
  };
}
function __cesiumHeadingPitchRoll__(heading, pitch, roll) {
  return {
    ${JSON.stringify(VALUE_TYPE_MARK)}: "HeadingPitchRoll",
    heading: heading || 0,
    pitch: pitch || 0,
    roll: roll || 0,
  };
}
function __cesiumTileStyle__(style) {
  return { ${JSON.stringify(VALUE_TYPE_MARK)}: "Cesium3DTileStyle", style: style || {} };
}

// \`let\`, not \`const\`: \`buildCesiumStaticFallbackGuestPrelude\` (evaluated later, after the host
// bridge prelude) reassigns this binding to a Proxy wrapping the same underlying object, so
// property reads for real CesiumJS classes not explicitly bound below (\`Rectangle\`, \`Ellipsoid\`,
// \`PinBuilder\`, ...) transparently fall back to the real static \`Cesium\` module host-side.
let Cesium = {};

// Cesium.Math (CesiumMath): angle conversions, common constants, and small numeric helpers —
// all pure, side-effect-free arithmetic, so (like the vector/geodetic helpers above) these are
// reimplemented directly in guest JS rather than round-tripping to the host.
Cesium.Math = {
  PI: Math.PI,
  TWO_PI: Math.PI * 2,
  PI_OVER_TWO: Math.PI / 2,
  PI_OVER_THREE: Math.PI / 3,
  PI_OVER_FOUR: Math.PI / 4,
  PI_OVER_SIX: Math.PI / 6,
  RADIANS_PER_DEGREE: Math.PI / 180,
  DEGREES_PER_RADIAN: 180 / Math.PI,
  toDegrees: function (radians) { return radians * 180 / Math.PI; },
  toRadians: function (degrees) { return degrees * Math.PI / 180; },
  clamp: function (value, min, max) { return value < min ? min : value > max ? max : value; },
  lerp: function (p, q, time) { return p * (1 - time) + q * time; },
  equalsEpsilon: function (left, right, relativeEpsilon, absoluteEpsilon) {
    relativeEpsilon = relativeEpsilon || 0;
    absoluteEpsilon = absoluteEpsilon === undefined ? relativeEpsilon : absoluteEpsilon;
    const diff = Math.abs(left - right);
    return diff <= absoluteEpsilon || diff <= relativeEpsilon * Math.max(Math.abs(left), Math.abs(right));
  },
  negativePiToPi: function (angle) {
    return Cesium.Math.zeroToTwoPi(angle + Math.PI) - Math.PI;
  },
  zeroToTwoPi: function (angle) {
    const mod = angle % (Math.PI * 2);
    return (Math.abs(mod) < 1e-12 && Math.abs(angle) > 1e-12) ? Math.PI * 2 : (mod < 0 ? mod + Math.PI * 2 : mod);
  },
};

Cesium.Cartesian2 = function (x, y) { return __cesiumCartesian2__(x, y); };
Cesium.Cartesian2.ZERO = __cesiumCartesian2__(0, 0);

Cesium.Cartesian3 = function (x, y, z) { return __cesiumCartesian3__(x, y, z); };
Cesium.Cartesian3.ZERO = __cesiumCartesian3__(0, 0, 0);
Cesium.Cartesian3.fromRadians = function (longitude, latitude, height) {
  return __cesiumFromRadians__(longitude, latitude, height);
};
Cesium.Cartesian3.fromDegrees = function (longitude, latitude, height) {
  return __cesiumFromDegrees__(longitude, latitude, height);
};
Cesium.Cartesian3.fromDegreesArray = function (coordinates) {
  const result = [];
  for (let i = 0; i < coordinates.length; i += 2) {
    result.push(__cesiumFromDegrees__(coordinates[i], coordinates[i + 1]));
  }
  return result;
};
Cesium.Cartesian3.fromDegreesArrayHeights = function (coordinates) {
  const result = [];
  for (let i = 0; i < coordinates.length; i += 3) {
    result.push(__cesiumFromDegrees__(coordinates[i], coordinates[i + 1], coordinates[i + 2]));
  }
  return result;
};
Cesium.Cartesian3.fromRadiansArray = function (coordinates) {
  const result = [];
  for (let i = 0; i < coordinates.length; i += 2) {
    result.push(__cesiumFromRadians__(coordinates[i], coordinates[i + 1]));
  }
  return result;
};
// Vector arithmetic statics (Cartesian3.add/subtract/...) mirror real CesiumJS's
// two-in-one-out-parameter signature (left, right, result) but ignore result (an in-place
// output-object micro-optimization that's meaningless for these plain tagged-data values) and
// simply return a new value instead.
Cesium.Cartesian3.add = function (left, right) {
  return __cesiumCartesian3__(left.x + right.x, left.y + right.y, left.z + right.z);
};
Cesium.Cartesian3.subtract = function (left, right) {
  return __cesiumCartesian3__(left.x - right.x, left.y - right.y, left.z - right.z);
};
Cesium.Cartesian3.multiplyByScalar = function (cartesian, scalar) {
  return __cesiumCartesian3__(cartesian.x * scalar, cartesian.y * scalar, cartesian.z * scalar);
};
Cesium.Cartesian3.negate = function (cartesian) {
  return __cesiumCartesian3__(-cartesian.x, -cartesian.y, -cartesian.z);
};
Cesium.Cartesian3.magnitude = function (cartesian) {
  return Math.sqrt(cartesian.x * cartesian.x + cartesian.y * cartesian.y + cartesian.z * cartesian.z);
};
Cesium.Cartesian3.distance = function (left, right) {
  return Cesium.Cartesian3.magnitude(Cesium.Cartesian3.subtract(left, right));
};
Cesium.Cartesian3.normalize = function (cartesian) {
  const mag = Cesium.Cartesian3.magnitude(cartesian);
  return __cesiumCartesian3__(cartesian.x / mag, cartesian.y / mag, cartesian.z / mag);
};
Cesium.Cartesian3.dot = function (left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
};
Cesium.Cartesian3.cross = function (left, right) {
  return __cesiumCartesian3__(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
};
Cesium.Cartesian3.midpoint = function (left, right) {
  return __cesiumCartesian3__((left.x + right.x) / 2, (left.y + right.y) / 2, (left.z + right.z) / 2);
};
Cesium.Cartesian3.equals = function (left, right) {
  return left === right || (!!left && !!right && left.x === right.x && left.y === right.y && left.z === right.z);
};
Cesium.Cartesian3.clone = function (cartesian) {
  return __cesiumCartesian3__(cartesian.x, cartesian.y, cartesian.z);
};

Cesium.Cartographic = function (longitude, latitude, height) {
  return __cesiumCartographic__(longitude, latitude, height);
};
Cesium.Cartographic.fromRadians = function (longitude, latitude, height) {
  return __cesiumCartographic__(longitude, latitude, height);
};
Cesium.Cartographic.fromDegrees = function (longitude, latitude, height) {
  return __cesiumCartographic__(longitude * Math.PI / 180, latitude * Math.PI / 180, height);
};

Cesium.HeadingPitchRange = function (heading, pitch, range) {
  return __cesiumHeadingPitchRange__(heading, pitch, range);
};
Cesium.HeadingPitchRoll = function (heading, pitch, roll) {
  return __cesiumHeadingPitchRoll__(heading, pitch, roll);
};
Cesium.HeadingPitchRoll.fromDegrees = function (heading, pitch, roll) {
  return __cesiumHeadingPitchRoll__(heading * Math.PI / 180, pitch * Math.PI / 180, roll * Math.PI / 180);
};

Cesium.Cesium3DTileStyle = function (style) { return __cesiumTileStyle__(style); };

Cesium.Color = function (red, green, blue, alpha) { return __cesiumColor__(red, green, blue, alpha); };
Cesium.Color.fromBytes = function (red, green, blue, alpha) {
  return __cesiumColor__(
    (red === undefined ? 255 : red) / 255,
    (green === undefined ? 255 : green) / 255,
    (blue === undefined ? 255 : blue) / 255,
    (alpha === undefined ? 255 : alpha) / 255,
  );
};
Cesium.Color.fromCssColorString = function (css) {
  const value = String(css).trim();
  const hexMatch = /^#([0-9a-fA-F]{3,8})$/.exec(value);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map(function (c) { return c + c; }).join("");
    }
    if (hex.length !== 6 && hex.length !== 8) {
      throw new Error("Invalid CSS hex color string: " + css);
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return __cesiumColor__(r, g, b, a);
  }
  const named = __namedColors__[value.toLowerCase()];
  if (named) {
    return __cesiumColor__(named[0] / 255, named[1] / 255, named[2] / 255, 1);
  }
  if (value.toLowerCase() === "transparent") return __cesiumColor__(1, 1, 1, 0);
  throw new Error("Unsupported CSS color string: " + css);
};
for (const __name__ in __namedColors__) {
  const __rgb__ = __namedColors__[__name__];
  Cesium.Color[__name__.toUpperCase()] = __cesiumColor__(__rgb__[0] / 255, __rgb__[1] / 255, __rgb__[2] / 255, 1);
}
Cesium.Color.TRANSPARENT = __cesiumColor__(1, 1, 1, 0);

Cesium.VerticalOrigin = { CENTER: 0, BOTTOM: 1, BASELINE: 2, TOP: -1 };
Cesium.HorizontalOrigin = { CENTER: 0, LEFT: 1, RIGHT: -1 };
Cesium.HeightReference = { NONE: 0, CLAMP_TO_GROUND: 1, RELATIVE_TO_GROUND: 2 };
Cesium.LabelStyle = { FILL: 0, OUTLINE: 1, FILL_AND_OUTLINE: 2 };
Cesium.ClassificationType = { TERRAIN: 0, CESIUM_3D_TILE: 1, BOTH: 2 };
Cesium.ShadowMode = { DISABLED: 0, ENABLED: 1, CAST_ONLY: 2, RECEIVE_ONLY: 3 };

Cesium.NearFarScalar = function (near, nearValue, far, farValue) {
  return {
    ${JSON.stringify(VALUE_TYPE_MARK)}: "NearFarScalar",
    near: near === undefined ? 0 : near,
    nearValue: nearValue === undefined ? 0 : nearValue,
    far: far === undefined ? 1 : far,
    farValue: farValue === undefined ? 0 : farValue,
    clone: function () {
      return Cesium.NearFarScalar(this.near, this.nearValue, this.far, this.farValue);
    },
  };
};

// Bare top-level aliases for every value type/enum above (in addition to the \`Cesium.\` namespace)
// — real-world CesiumJS snippets commonly destructure these off the \`Cesium\` import and reference
// them bare (e.g. \`Cartesian3.fromDegrees(...)\`, \`Color.WHITE\`, \`LabelStyle.FILL_AND_OUTLINE\`),
// so both forms must resolve to avoid a spurious "X is not defined" ReferenceError.
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
// Real CesiumJS code conventionally imports \`Math\` under the alias \`CesiumMath\` (since \`Math\`
// collides with the built-in global), e.g. \`import { Math as CesiumMath } from "cesium"\`, then
// calls \`CesiumMath.toDegrees(...)\`. Bind that exact conventional bare name too (not \`Math\`
// itself, which would shadow the native global relied on throughout this prelude).
const CesiumMath = Cesium.Math;
`;
}