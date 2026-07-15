// @ts-nocheck
// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run generate:cesium-bundle -w @cesium-ai/codegen-sandbox
// (see ../../../scripts/generate-cesium-core-bundle.mjs)

/**
 * Source text of a self-contained IIFE bundling real, pure CesiumJS value-type classes
 * (`Cartesian2`, `Cartesian3`, `Cartographic`, `Color`, `HeadingPitchRange`,
 * `HeadingPitchRoll`, `NearFarScalar`, `Math` as `CesiumMath`), built from
 * `@cesium/engine`'s `Source/Core/*.js`. Evaluating this in the QuickJS guest defines a
 * top-level `__CesiumCoreBundle__` object exposing each as a real class/namespace — see
 * `guest-prelude-value-types.ts`, which evaluates this before attaching them onto `Cesium.*`.
 *
 * Kept as the body of `__cesiumCoreBundleSource__` (never invoked) rather than a string literal
 * purely for readability — see this file's `CESIUM_CORE_BUNDLE_SOURCE` extraction below.
 * `@ts-nocheck` is required: the bundled code is plain untyped JS (esbuild output), and
 * type-checking it under this package's `strict` tsconfig would flood unrelated errors.
 */
function __cesiumCoreBundleSource__() {
var __CesiumCoreBundle__ = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../node_modules/mersenne-twister/src/mersenne-twister.js
  var require_mersenne_twister = __commonJS({
    "../../node_modules/mersenne-twister/src/mersenne-twister.js"(exports, module) {
      var MersenneTwister2 = function(seed) {
        if (seed == void 0) {
          seed = (/* @__PURE__ */ new Date()).getTime();
        }
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 2567483615;
        this.UPPER_MASK = 2147483648;
        this.LOWER_MASK = 2147483647;
        this.mt = new Array(this.N);
        this.mti = this.N + 1;
        if (seed.constructor == Array) {
          this.init_by_array(seed, seed.length);
        } else {
          this.init_seed(seed);
        }
      };
      MersenneTwister2.prototype.init_seed = function(s) {
        this.mt[0] = s >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
          var s = this.mt[this.mti - 1] ^ this.mt[this.mti - 1] >>> 30;
          this.mt[this.mti] = (((s & 4294901760) >>> 16) * 1812433253 << 16) + (s & 65535) * 1812433253 + this.mti;
          this.mt[this.mti] >>>= 0;
        }
      };
      MersenneTwister2.prototype.init_by_array = function(init_key, key_length) {
        var i, j, k;
        this.init_seed(19650218);
        i = 1;
        j = 0;
        k = this.N > key_length ? this.N : key_length;
        for (; k; k--) {
          var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
          this.mt[i] = (this.mt[i] ^ (((s & 4294901760) >>> 16) * 1664525 << 16) + (s & 65535) * 1664525) + init_key[j] + j;
          this.mt[i] >>>= 0;
          i++;
          j++;
          if (i >= this.N) {
            this.mt[0] = this.mt[this.N - 1];
            i = 1;
          }
          if (j >= key_length) j = 0;
        }
        for (k = this.N - 1; k; k--) {
          var s = this.mt[i - 1] ^ this.mt[i - 1] >>> 30;
          this.mt[i] = (this.mt[i] ^ (((s & 4294901760) >>> 16) * 1566083941 << 16) + (s & 65535) * 1566083941) - i;
          this.mt[i] >>>= 0;
          i++;
          if (i >= this.N) {
            this.mt[0] = this.mt[this.N - 1];
            i = 1;
          }
        }
        this.mt[0] = 2147483648;
      };
      MersenneTwister2.prototype.random_int = function() {
        var y;
        var mag01 = new Array(0, this.MATRIX_A);
        if (this.mti >= this.N) {
          var kk;
          if (this.mti == this.N + 1)
            this.init_seed(5489);
          for (kk = 0; kk < this.N - this.M; kk++) {
            y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
            this.mt[kk] = this.mt[kk + this.M] ^ y >>> 1 ^ mag01[y & 1];
          }
          for (; kk < this.N - 1; kk++) {
            y = this.mt[kk] & this.UPPER_MASK | this.mt[kk + 1] & this.LOWER_MASK;
            this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ y >>> 1 ^ mag01[y & 1];
          }
          y = this.mt[this.N - 1] & this.UPPER_MASK | this.mt[0] & this.LOWER_MASK;
          this.mt[this.N - 1] = this.mt[this.M - 1] ^ y >>> 1 ^ mag01[y & 1];
          this.mti = 0;
        }
        y = this.mt[this.mti++];
        y ^= y >>> 11;
        y ^= y << 7 & 2636928640;
        y ^= y << 15 & 4022730752;
        y ^= y >>> 18;
        return y >>> 0;
      };
      MersenneTwister2.prototype.random_int31 = function() {
        return this.random_int() >>> 1;
      };
      MersenneTwister2.prototype.random_incl = function() {
        return this.random_int() * (1 / 4294967295);
      };
      MersenneTwister2.prototype.random = function() {
        return this.random_int() * (1 / 4294967296);
      };
      MersenneTwister2.prototype.random_excl = function() {
        return (this.random_int() + 0.5) * (1 / 4294967296);
      };
      MersenneTwister2.prototype.random_long = function() {
        var a = this.random_int() >>> 5, b = this.random_int() >>> 6;
        return (a * 67108864 + b) * (1 / 9007199254740992);
      };
      module.exports = MersenneTwister2;
    }
  });

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    Cartesian2: () => Cartesian2_default,
    Cartesian3: () => Cartesian3_default,
    Cartographic: () => Cartographic_default,
    CesiumMath: () => Math_default,
    Color: () => Color_default,
    HeadingPitchRange: () => HeadingPitchRange_default,
    HeadingPitchRoll: () => HeadingPitchRoll_default,
    NearFarScalar: () => NearFarScalar_default
  });

  // ../../node_modules/@cesium/engine/Source/Core/defined.js
  function defined(value) {
    return value !== void 0 && value !== null;
  }
  var defined_default = defined;

  // ../../node_modules/@cesium/engine/Source/Core/DeveloperError.js
  function DeveloperError(message) {
    this.name = "DeveloperError";
    this.message = message;
    let stack;
    try {
      throw new Error();
    } catch (e) {
      stack = e.stack;
    }
    this.stack = stack;
  }
  if (defined_default(Object.create)) {
    DeveloperError.prototype = Object.create(Error.prototype);
    DeveloperError.prototype.constructor = DeveloperError;
  }
  DeveloperError.prototype.toString = function() {
    let str = `${this.name}: ${this.message}`;
    if (defined_default(this.stack)) {
      str += `
${this.stack.toString()}`;
    }
    return str;
  };
  DeveloperError.throwInstantiationError = function() {
    throw new DeveloperError(
      "This function defines an interface and should not be called directly."
    );
  };
  var DeveloperError_default = DeveloperError;

  // ../../node_modules/@cesium/engine/Source/Core/Check.js
  var Check = {};
  Check.typeOf = {};
  function getUndefinedErrorMessage(name) {
    return `${name} is required, actual value was undefined`;
  }
  function getFailedTypeErrorMessage(actual, expected, name) {
    return `Expected ${name} to be typeof ${expected}, actual typeof was ${actual}`;
  }
  Check.defined = function(name, test) {
    if (!defined_default(test)) {
      throw new DeveloperError_default(getUndefinedErrorMessage(name));
    }
  };
  Check.typeOf.func = function(name, test) {
    if (typeof test !== "function") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "function", name)
      );
    }
  };
  Check.typeOf.string = function(name, test) {
    if (typeof test !== "string") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "string", name)
      );
    }
  };
  Check.typeOf.number = function(name, test) {
    if (typeof test !== "number") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "number", name)
      );
    }
  };
  Check.typeOf.number.lessThan = function(name, test, limit) {
    Check.typeOf.number(name, test);
    if (test >= limit) {
      throw new DeveloperError_default(
        `Expected ${name} to be less than ${limit}, actual value was ${test}`
      );
    }
  };
  Check.typeOf.number.lessThanOrEquals = function(name, test, limit) {
    Check.typeOf.number(name, test);
    if (test > limit) {
      throw new DeveloperError_default(
        `Expected ${name} to be less than or equal to ${limit}, actual value was ${test}`
      );
    }
  };
  Check.typeOf.number.greaterThan = function(name, test, limit) {
    Check.typeOf.number(name, test);
    if (test <= limit) {
      throw new DeveloperError_default(
        `Expected ${name} to be greater than ${limit}, actual value was ${test}`
      );
    }
  };
  Check.typeOf.number.greaterThanOrEquals = function(name, test, limit) {
    Check.typeOf.number(name, test);
    if (test < limit) {
      throw new DeveloperError_default(
        `Expected ${name} to be greater than or equal to ${limit}, actual value was ${test}`
      );
    }
  };
  Check.typeOf.object = function(name, test) {
    if (typeof test !== "object") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "object", name)
      );
    }
  };
  Check.typeOf.bool = function(name, test) {
    if (typeof test !== "boolean") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "boolean", name)
      );
    }
  };
  Check.typeOf.bigint = function(name, test) {
    if (typeof test !== "bigint") {
      throw new DeveloperError_default(
        getFailedTypeErrorMessage(typeof test, "bigint", name)
      );
    }
  };
  Check.typeOf.number.equals = function(name1, name2, test1, test2) {
    Check.typeOf.number(name1, test1);
    Check.typeOf.number(name2, test2);
    if (test1 !== test2) {
      throw new DeveloperError_default(
        `${name1} must be equal to ${name2}, the actual values are ${test1} and ${test2}`
      );
    }
  };
  var Check_default = Check;

  // ../../node_modules/@cesium/engine/Source/Core/Math.js
  var import_mersenne_twister = __toESM(require_mersenne_twister(), 1);
  var CesiumMath = {};
  CesiumMath.EPSILON1 = 0.1;
  CesiumMath.EPSILON2 = 0.01;
  CesiumMath.EPSILON3 = 1e-3;
  CesiumMath.EPSILON4 = 1e-4;
  CesiumMath.EPSILON5 = 1e-5;
  CesiumMath.EPSILON6 = 1e-6;
  CesiumMath.EPSILON7 = 1e-7;
  CesiumMath.EPSILON8 = 1e-8;
  CesiumMath.EPSILON9 = 1e-9;
  CesiumMath.EPSILON10 = 1e-10;
  CesiumMath.EPSILON11 = 1e-11;
  CesiumMath.EPSILON12 = 1e-12;
  CesiumMath.EPSILON13 = 1e-13;
  CesiumMath.EPSILON14 = 1e-14;
  CesiumMath.EPSILON15 = 1e-15;
  CesiumMath.EPSILON16 = 1e-16;
  CesiumMath.EPSILON17 = 1e-17;
  CesiumMath.EPSILON18 = 1e-18;
  CesiumMath.EPSILON19 = 1e-19;
  CesiumMath.EPSILON20 = 1e-20;
  CesiumMath.EPSILON21 = 1e-21;
  CesiumMath.GRAVITATIONALPARAMETER = 3986004418e5;
  CesiumMath.SOLAR_RADIUS = 6955e5;
  CesiumMath.LUNAR_RADIUS = 1737400;
  CesiumMath.SIXTY_FOUR_KILOBYTES = 64 * 1024;
  CesiumMath.FOUR_GIGABYTES = 4 * 1024 * 1024 * 1024;
  CesiumMath.sign = Math.sign ?? function sign(value) {
    value = +value;
    if (value === 0 || value !== value) {
      return value;
    }
    return value > 0 ? 1 : -1;
  };
  CesiumMath.signNotZero = function(value) {
    return value < 0 ? -1 : 1;
  };
  CesiumMath.toSNorm = function(value, rangeMaximum) {
    rangeMaximum = rangeMaximum ?? 255;
    return Math.round(
      (CesiumMath.clamp(value, -1, 1) * 0.5 + 0.5) * rangeMaximum
    );
  };
  CesiumMath.fromSNorm = function(value, rangeMaximum) {
    rangeMaximum = rangeMaximum ?? 255;
    return CesiumMath.clamp(value, 0, rangeMaximum) / rangeMaximum * 2 - 1;
  };
  CesiumMath.normalize = function(value, rangeMinimum, rangeMaximum) {
    rangeMaximum = Math.max(rangeMaximum - rangeMinimum, 0);
    return rangeMaximum === 0 ? 0 : CesiumMath.clamp((value - rangeMinimum) / rangeMaximum, 0, 1);
  };
  CesiumMath.sinh = Math.sinh ?? function sinh(value) {
    return (Math.exp(value) - Math.exp(-value)) / 2;
  };
  CesiumMath.cosh = Math.cosh ?? function cosh(value) {
    return (Math.exp(value) + Math.exp(-value)) / 2;
  };
  CesiumMath.lerp = function(p, q, time) {
    return (1 - time) * p + time * q;
  };
  CesiumMath.PI = Math.PI;
  CesiumMath.ONE_OVER_PI = 1 / Math.PI;
  CesiumMath.PI_OVER_TWO = Math.PI / 2;
  CesiumMath.PI_OVER_THREE = Math.PI / 3;
  CesiumMath.PI_OVER_FOUR = Math.PI / 4;
  CesiumMath.PI_OVER_SIX = Math.PI / 6;
  CesiumMath.THREE_PI_OVER_TWO = 3 * Math.PI / 2;
  CesiumMath.TWO_PI = 2 * Math.PI;
  CesiumMath.ONE_OVER_TWO_PI = 1 / (2 * Math.PI);
  CesiumMath.RADIANS_PER_DEGREE = Math.PI / 180;
  CesiumMath.DEGREES_PER_RADIAN = 180 / Math.PI;
  CesiumMath.RADIANS_PER_ARCSECOND = CesiumMath.RADIANS_PER_DEGREE / 3600;
  CesiumMath.toRadians = function(degrees) {
    if (!defined_default(degrees)) {
      throw new DeveloperError_default("degrees is required.");
    }
    return degrees * CesiumMath.RADIANS_PER_DEGREE;
  };
  CesiumMath.toDegrees = function(radians) {
    if (!defined_default(radians)) {
      throw new DeveloperError_default("radians is required.");
    }
    return radians * CesiumMath.DEGREES_PER_RADIAN;
  };
  CesiumMath.convertLongitudeRange = function(angle) {
    if (!defined_default(angle)) {
      throw new DeveloperError_default("angle is required.");
    }
    const twoPi = CesiumMath.TWO_PI;
    const simplified = angle - Math.floor(angle / twoPi) * twoPi;
    if (simplified < -Math.PI) {
      return simplified + twoPi;
    }
    if (simplified >= Math.PI) {
      return simplified - twoPi;
    }
    return simplified;
  };
  CesiumMath.clampToLatitudeRange = function(angle) {
    if (!defined_default(angle)) {
      throw new DeveloperError_default("angle is required.");
    }
    return CesiumMath.clamp(
      angle,
      -1 * CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO
    );
  };
  CesiumMath.negativePiToPi = function(angle) {
    if (!defined_default(angle)) {
      throw new DeveloperError_default("angle is required.");
    }
    if (angle >= -CesiumMath.PI && angle <= CesiumMath.PI) {
      return angle;
    }
    return CesiumMath.zeroToTwoPi(angle + CesiumMath.PI) - CesiumMath.PI;
  };
  CesiumMath.zeroToTwoPi = function(angle) {
    if (!defined_default(angle)) {
      throw new DeveloperError_default("angle is required.");
    }
    if (angle >= 0 && angle <= CesiumMath.TWO_PI) {
      return angle;
    }
    const mod = CesiumMath.mod(angle, CesiumMath.TWO_PI);
    if (Math.abs(mod) < CesiumMath.EPSILON14 && Math.abs(angle) > CesiumMath.EPSILON14) {
      return CesiumMath.TWO_PI;
    }
    return mod;
  };
  CesiumMath.mod = function(m, n) {
    if (!defined_default(m)) {
      throw new DeveloperError_default("m is required.");
    }
    if (!defined_default(n)) {
      throw new DeveloperError_default("n is required.");
    }
    if (n === 0) {
      throw new DeveloperError_default("divisor cannot be 0.");
    }
    if (CesiumMath.sign(m) === CesiumMath.sign(n) && Math.abs(m) < Math.abs(n)) {
      return m;
    }
    return (m % n + n) % n;
  };
  CesiumMath.equalsEpsilon = function(left, right, relativeEpsilon, absoluteEpsilon) {
    if (!defined_default(left)) {
      throw new DeveloperError_default("left is required.");
    }
    if (!defined_default(right)) {
      throw new DeveloperError_default("right is required.");
    }
    relativeEpsilon = relativeEpsilon ?? 0;
    absoluteEpsilon = absoluteEpsilon ?? relativeEpsilon;
    const absDiff = Math.abs(left - right);
    return absDiff <= absoluteEpsilon || absDiff <= relativeEpsilon * Math.max(Math.abs(left), Math.abs(right));
  };
  CesiumMath.lessThan = function(left, right, absoluteEpsilon) {
    if (!defined_default(left)) {
      throw new DeveloperError_default("first is required.");
    }
    if (!defined_default(right)) {
      throw new DeveloperError_default("second is required.");
    }
    if (!defined_default(absoluteEpsilon)) {
      throw new DeveloperError_default("absoluteEpsilon is required.");
    }
    return left - right < -absoluteEpsilon;
  };
  CesiumMath.lessThanOrEquals = function(left, right, absoluteEpsilon) {
    if (!defined_default(left)) {
      throw new DeveloperError_default("first is required.");
    }
    if (!defined_default(right)) {
      throw new DeveloperError_default("second is required.");
    }
    if (!defined_default(absoluteEpsilon)) {
      throw new DeveloperError_default("absoluteEpsilon is required.");
    }
    return left - right < absoluteEpsilon;
  };
  CesiumMath.greaterThan = function(left, right, absoluteEpsilon) {
    if (!defined_default(left)) {
      throw new DeveloperError_default("first is required.");
    }
    if (!defined_default(right)) {
      throw new DeveloperError_default("second is required.");
    }
    if (!defined_default(absoluteEpsilon)) {
      throw new DeveloperError_default("absoluteEpsilon is required.");
    }
    return left - right > absoluteEpsilon;
  };
  CesiumMath.greaterThanOrEquals = function(left, right, absoluteEpsilon) {
    if (!defined_default(left)) {
      throw new DeveloperError_default("first is required.");
    }
    if (!defined_default(right)) {
      throw new DeveloperError_default("second is required.");
    }
    if (!defined_default(absoluteEpsilon)) {
      throw new DeveloperError_default("absoluteEpsilon is required.");
    }
    return left - right > -absoluteEpsilon;
  };
  var factorials = [1];
  CesiumMath.factorial = function(n) {
    if (typeof n !== "number" || n < 0) {
      throw new DeveloperError_default(
        "A number greater than or equal to 0 is required."
      );
    }
    const length = factorials.length;
    if (n >= length) {
      let sum = factorials[length - 1];
      for (let i = length; i <= n; i++) {
        const next = sum * i;
        factorials.push(next);
        sum = next;
      }
    }
    return factorials[n];
  };
  CesiumMath.incrementWrap = function(n, maximumValue, minimumValue) {
    minimumValue = minimumValue ?? 0;
    if (!defined_default(n)) {
      throw new DeveloperError_default("n is required.");
    }
    if (maximumValue <= minimumValue) {
      throw new DeveloperError_default("maximumValue must be greater than minimumValue.");
    }
    ++n;
    if (n > maximumValue) {
      n = minimumValue;
    }
    return n;
  };
  CesiumMath.isPowerOfTwo = function(n) {
    if (typeof n !== "number" || n < 0 || n > 4294967295) {
      throw new DeveloperError_default("A number between 0 and (2^32)-1 is required.");
    }
    return n !== 0 && (n & n - 1) === 0;
  };
  CesiumMath.nextPowerOfTwo = function(n) {
    if (typeof n !== "number" || n < 0 || n > 2147483648) {
      throw new DeveloperError_default("A number between 0 and 2^31 is required.");
    }
    --n;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    ++n;
    return n;
  };
  CesiumMath.previousPowerOfTwo = function(n) {
    if (typeof n !== "number" || n < 0 || n > 4294967295) {
      throw new DeveloperError_default("A number between 0 and (2^32)-1 is required.");
    }
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    n |= n >> 32;
    n = (n >>> 0) - (n >>> 1);
    return n;
  };
  CesiumMath.clamp = function(value, min, max) {
    Check_default.typeOf.number("value", value);
    Check_default.typeOf.number("min", min);
    Check_default.typeOf.number("max", max);
    return value < min ? min : value > max ? max : value;
  };
  var randomNumberGenerator = new import_mersenne_twister.default();
  CesiumMath.setRandomNumberSeed = function(seed) {
    if (!defined_default(seed)) {
      throw new DeveloperError_default("seed is required.");
    }
    randomNumberGenerator = new import_mersenne_twister.default(seed);
  };
  CesiumMath.nextRandomNumber = function() {
    return randomNumberGenerator.random();
  };
  CesiumMath.randomBetween = function(min, max) {
    return CesiumMath.nextRandomNumber() * (max - min) + min;
  };
  CesiumMath.acosClamped = function(value) {
    if (!defined_default(value)) {
      throw new DeveloperError_default("value is required.");
    }
    return Math.acos(CesiumMath.clamp(value, -1, 1));
  };
  CesiumMath.asinClamped = function(value) {
    if (!defined_default(value)) {
      throw new DeveloperError_default("value is required.");
    }
    return Math.asin(CesiumMath.clamp(value, -1, 1));
  };
  CesiumMath.chordLength = function(angle, radius) {
    if (!defined_default(angle)) {
      throw new DeveloperError_default("angle is required.");
    }
    if (!defined_default(radius)) {
      throw new DeveloperError_default("radius is required.");
    }
    return 2 * radius * Math.sin(angle * 0.5);
  };
  CesiumMath.logBase = function(number, base) {
    if (!defined_default(number)) {
      throw new DeveloperError_default("number is required.");
    }
    if (!defined_default(base)) {
      throw new DeveloperError_default("base is required.");
    }
    return Math.log(number) / Math.log(base);
  };
  CesiumMath.cbrt = Math.cbrt ?? function cbrt(number) {
    const result = Math.pow(Math.abs(number), 1 / 3);
    return number < 0 ? -result : result;
  };
  CesiumMath.log2 = Math.log2 ?? function log2(number) {
    return Math.log(number) * Math.LOG2E;
  };
  CesiumMath.fog = function(distanceToCamera, density) {
    const scalar = distanceToCamera * density;
    return 1 - Math.exp(-(scalar * scalar));
  };
  CesiumMath.fastApproximateAtan = function(x) {
    Check_default.typeOf.number("x", x);
    return x * (-0.1784 * Math.abs(x) - 0.0663 * x * x + 1.0301);
  };
  CesiumMath.fastApproximateAtan2 = function(x, y) {
    Check_default.typeOf.number("x", x);
    Check_default.typeOf.number("y", y);
    let opposite;
    let t = Math.abs(x);
    opposite = Math.abs(y);
    const adjacent = Math.max(t, opposite);
    opposite = Math.min(t, opposite);
    const oppositeOverAdjacent = opposite / adjacent;
    if (isNaN(oppositeOverAdjacent)) {
      throw new DeveloperError_default("either x or y must be nonzero");
    }
    t = CesiumMath.fastApproximateAtan(oppositeOverAdjacent);
    t = Math.abs(y) > Math.abs(x) ? CesiumMath.PI_OVER_TWO - t : t;
    t = x < 0 ? CesiumMath.PI - t : t;
    t = y < 0 ? -t : t;
    return t;
  };
  var Math_default = CesiumMath;

  // ../../node_modules/@cesium/engine/Source/Core/Cartesian2.js
  var Cartesian2 = class _Cartesian2 {
    /**
     * @param {number} [x=0.0] The X component.
     * @param {number} [y=0.0] The Y component.
     */
    constructor(x, y) {
      this.x = x ?? 0;
      this.y = y ?? 0;
    }
    /**
     * Creates a Cartesian2 instance from x and y coordinates.
     *
     * @param {number} x The x coordinate.
     * @param {number} y The y coordinate.
     * @param {Cartesian2} [result] The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter or a new Cartesian2 instance if one was not provided.
     */
    static fromElements(x, y, result) {
      if (!defined_default(result)) {
        return new _Cartesian2(x, y);
      }
      result.x = x;
      result.y = y;
      return result;
    }
    /**
     * Duplicates a Cartesian2 instance.
     *
     * @param {Cartesian2} cartesian The Cartesian to duplicate.
     * @param {Cartesian2} [result] The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter or a new Cartesian2 instance if one was not provided. (Returns undefined if cartesian is undefined)
     */
    static clone(cartesian, result) {
      if (!defined_default(cartesian)) {
        return void 0;
      }
      if (!defined_default(result)) {
        return new _Cartesian2(cartesian.x, cartesian.y);
      }
      result.x = cartesian.x;
      result.y = cartesian.y;
      return result;
    }
    /**
     * Stores the provided instance into the provided array.
     *
     * @param {Cartesian2} value The value to pack.
     * @param {number[]} array The array to pack into.
     * @param {number} [startingIndex=0] The index into the array at which to start packing the elements.
     *
     * @returns {number[]} The array that was packed into
     */
    static pack(value, array, startingIndex) {
      Check_default.typeOf.object("value", value);
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      array[startingIndex++] = value.x;
      array[startingIndex] = value.y;
      return array;
    }
    /**
     * Retrieves an instance from a packed array.
     *
     * @param {number[]} array The packed array.
     * @param {number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {Cartesian2} [result] The object into which to store the result.
     * @returns {Cartesian2} The modified result parameter or a new Cartesian2 instance if one was not provided.
     */
    static unpack(array, startingIndex, result) {
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      if (!defined_default(result)) {
        result = new _Cartesian2();
      }
      result.x = array[startingIndex++];
      result.y = array[startingIndex];
      return result;
    }
    /**
     * Flattens an array of Cartesian2s into an array of components.
     *
     * @param {Cartesian2[]} array The array of cartesians to pack.
     * @param {number[]} [result] The array onto which to store the result. If this is a typed array, it must have array.length * 2 components, else a {@link DeveloperError} will be thrown. If it is a regular array, it will be resized to have (array.length * 2) elements.
     * @returns {number[]} The packed array.
     */
    static packArray(array, result) {
      Check_default.defined("array", array);
      const length = array.length;
      const resultLength = length * 2;
      if (!defined_default(result)) {
        result = new Array(resultLength);
      } else if (!Array.isArray(result) && result.length !== resultLength) {
        throw new DeveloperError_default(
          "If result is a typed array, it must have exactly array.length * 2 elements"
        );
      } else if (result.length !== resultLength) {
        result.length = resultLength;
      }
      for (let i = 0; i < length; ++i) {
        _Cartesian2.pack(array[i], result, i * 2);
      }
      return result;
    }
    /**
     * Unpacks an array of cartesian components into an array of Cartesian2s.
     *
     * @param {number[]} array The array of components to unpack.
     * @param {Cartesian2[]} [result] The array onto which to store the result.
     * @returns {Cartesian2[]} The unpacked array.
     */
    static unpackArray(array, result) {
      Check_default.defined("array", array);
      Check_default.typeOf.number.greaterThanOrEquals("array.length", array.length, 2);
      if (array.length % 2 !== 0) {
        throw new DeveloperError_default("array length must be a multiple of 2.");
      }
      const length = array.length;
      if (!defined_default(result)) {
        result = new Array(length / 2);
      } else {
        result.length = length / 2;
      }
      for (let i = 0; i < length; i += 2) {
        const index = i / 2;
        result[index] = _Cartesian2.unpack(array, i, result[index]);
      }
      return result;
    }
    /**
     * Computes the value of the maximum component for the supplied Cartesian.
     *
     * @param {Cartesian2} cartesian The cartesian to use.
     * @returns {number} The value of the maximum component.
     */
    static maximumComponent(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return Math.max(cartesian.x, cartesian.y);
    }
    /**
     * Computes the value of the minimum component for the supplied Cartesian.
     *
     * @param {Cartesian2} cartesian The cartesian to use.
     * @returns {number} The value of the minimum component.
     */
    static minimumComponent(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return Math.min(cartesian.x, cartesian.y);
    }
    /**
     * Compares two Cartesians and computes a Cartesian which contains the minimum components of the supplied Cartesians.
     *
     * @param {Cartesian2} first A cartesian to compare.
     * @param {Cartesian2} second A cartesian to compare.
     * @param {Cartesian2} result The object into which to store the result.
     * @returns {Cartesian2} A cartesian with the minimum components.
     */
    static minimumByComponent(first, second, result) {
      Check_default.typeOf.object("first", first);
      Check_default.typeOf.object("second", second);
      Check_default.typeOf.object("result", result);
      result.x = Math.min(first.x, second.x);
      result.y = Math.min(first.y, second.y);
      return result;
    }
    /**
     * Compares two Cartesians and computes a Cartesian which contains the maximum components of the supplied Cartesians.
     *
     * @param {Cartesian2} first A cartesian to compare.
     * @param {Cartesian2} second A cartesian to compare.
     * @param {Cartesian2} result The object into which to store the result.
     * @returns {Cartesian2} A cartesian with the maximum components.
     */
    static maximumByComponent(first, second, result) {
      Check_default.typeOf.object("first", first);
      Check_default.typeOf.object("second", second);
      Check_default.typeOf.object("result", result);
      result.x = Math.max(first.x, second.x);
      result.y = Math.max(first.y, second.y);
      return result;
    }
    /**
     * Constrain a value to lie between two values.
     *
     * @param {Cartesian2} value The value to clamp.
     * @param {Cartesian2} min The minimum bound.
     * @param {Cartesian2} max The maximum bound.
     * @param {Cartesian2} result The object into which to store the result.
     * @returns {Cartesian2} The clamped value such that min <= result <= max.
     */
    static clamp(value, min, max, result) {
      Check_default.typeOf.object("value", value);
      Check_default.typeOf.object("min", min);
      Check_default.typeOf.object("max", max);
      Check_default.typeOf.object("result", result);
      const x = Math_default.clamp(value.x, min.x, max.x);
      const y = Math_default.clamp(value.y, min.y, max.y);
      result.x = x;
      result.y = y;
      return result;
    }
    /**
     * Computes the provided Cartesian's squared magnitude.
     *
     * @param {Cartesian2} cartesian The Cartesian instance whose squared magnitude is to be computed.
     * @returns {number} The squared magnitude.
     */
    static magnitudeSquared(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return cartesian.x * cartesian.x + cartesian.y * cartesian.y;
    }
    /**
     * Computes the Cartesian's magnitude (length).
     *
     * @param {Cartesian2} cartesian The Cartesian instance whose magnitude is to be computed.
     * @returns {number} The magnitude.
     */
    static magnitude(cartesian) {
      return Math.sqrt(_Cartesian2.magnitudeSquared(cartesian));
    }
    /**
     * Computes the distance between two points.
     *
     * @param {Cartesian2} left The first point to compute the distance from.
     * @param {Cartesian2} right The second point to compute the distance to.
     * @returns {number} The distance between two points.
     *
     * @example
     * // Returns 1.0
     * const d = Cesium.Cartesian2.distance(new Cesium.Cartesian2(1.0, 0.0), new Cesium.Cartesian2(2.0, 0.0));
     */
    static distance(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian2.subtract(left, right, distanceScratch);
      return _Cartesian2.magnitude(distanceScratch);
    }
    /**
     * Computes the squared distance between two points.  Comparing squared distances
     * using this function is more efficient than comparing distances using {@link Cartesian2#distance}.
     *
     * @param {Cartesian2} left The first point to compute the distance from.
     * @param {Cartesian2} right The second point to compute the distance to.
     * @returns {number} The distance between two points.
     *
     * @example
     * // Returns 4.0, not 2.0
     * const d = Cesium.Cartesian2.distance(new Cesium.Cartesian2(1.0, 0.0), new Cesium.Cartesian2(3.0, 0.0));
     */
    static distanceSquared(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian2.subtract(left, right, distanceScratch);
      return _Cartesian2.magnitudeSquared(distanceScratch);
    }
    /**
     * Computes the normalized form of the supplied Cartesian.
     *
     * @param {Cartesian2} cartesian The Cartesian to be normalized.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static normalize(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      const magnitude = _Cartesian2.magnitude(cartesian);
      result.x = cartesian.x / magnitude;
      result.y = cartesian.y / magnitude;
      if (isNaN(result.x) || isNaN(result.y)) {
        throw new DeveloperError_default("normalized result is not a number");
      }
      return result;
    }
    /**
     * Computes the dot (scalar) product of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @returns {number} The dot product.
     */
    static dot(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      return left.x * right.x + left.y * right.y;
    }
    /**
     * Computes the magnitude of the cross product that would result from implicitly setting the Z coordinate of the input vectors to 0
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @returns {number} The cross product.
     */
    static cross(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      return left.x * right.y - left.y * right.x;
    }
    /**
     * Computes the componentwise product of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static multiplyComponents(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x * right.x;
      result.y = left.y * right.y;
      return result;
    }
    /**
     * Computes the componentwise quotient of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static divideComponents(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x / right.x;
      result.y = left.y / right.y;
      return result;
    }
    /**
     * Computes the componentwise sum of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static add(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x + right.x;
      result.y = left.y + right.y;
      return result;
    }
    /**
     * Computes the componentwise difference of two Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static subtract(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x - right.x;
      result.y = left.y - right.y;
      return result;
    }
    /**
     * Multiplies the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian2} cartesian The Cartesian to be scaled.
     * @param {number} scalar The scalar to multiply with.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static multiplyByScalar(cartesian, scalar, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.x = cartesian.x * scalar;
      result.y = cartesian.y * scalar;
      return result;
    }
    /**
     * Divides the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian2} cartesian The Cartesian to be divided.
     * @param {number} scalar The scalar to divide by.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static divideByScalar(cartesian, scalar, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.x = cartesian.x / scalar;
      result.y = cartesian.y / scalar;
      return result;
    }
    /**
     * Negates the provided Cartesian.
     *
     * @param {Cartesian2} cartesian The Cartesian to be negated.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static negate(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      result.x = -cartesian.x;
      result.y = -cartesian.y;
      return result;
    }
    /**
     * Computes the absolute value of the provided Cartesian.
     *
     * @param {Cartesian2} cartesian The Cartesian whose absolute value is to be computed.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static abs(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      result.x = Math.abs(cartesian.x);
      result.y = Math.abs(cartesian.y);
      return result;
    }
    /**
     * Computes the linear interpolation or extrapolation at t using the provided cartesians.
     *
     * @param {Cartesian2} start The value corresponding to t at 0.0.
     * @param {Cartesian2} end The value corresponding to t at 1.0.
     * @param {number} t The point along t at which to interpolate.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter.
     */
    static lerp(start, end, t, result) {
      Check_default.typeOf.object("start", start);
      Check_default.typeOf.object("end", end);
      Check_default.typeOf.number("t", t);
      Check_default.typeOf.object("result", result);
      _Cartesian2.multiplyByScalar(end, t, lerpScratch);
      result = _Cartesian2.multiplyByScalar(start, 1 - t, result);
      return _Cartesian2.add(lerpScratch, result, result);
    }
    /**
     * Returns the angle, in radians, between the provided Cartesians.
     *
     * @param {Cartesian2} left The first Cartesian.
     * @param {Cartesian2} right The second Cartesian.
     * @returns {number} The angle between the Cartesians.
     */
    static angleBetween(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian2.normalize(left, angleBetweenScratch);
      _Cartesian2.normalize(right, angleBetweenScratch2);
      return Math_default.acosClamped(
        _Cartesian2.dot(angleBetweenScratch, angleBetweenScratch2)
      );
    }
    /**
     * Returns the axis that is most orthogonal to the provided Cartesian.
     *
     * @param {Cartesian2} cartesian The Cartesian on which to find the most orthogonal axis.
     * @param {Cartesian2} result The object onto which to store the result.
     * @returns {Cartesian2} The most orthogonal axis.
     */
    static mostOrthogonalAxis(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      const f = _Cartesian2.normalize(cartesian, mostOrthogonalAxisScratch);
      _Cartesian2.abs(f, f);
      if (f.x <= f.y) {
        result = _Cartesian2.clone(_Cartesian2.UNIT_X, result);
      } else {
        result = _Cartesian2.clone(_Cartesian2.UNIT_Y, result);
      }
      return result;
    }
    /**
     * Compares the provided Cartesians componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartesian2} [left] The first Cartesian.
     * @param {Cartesian2} [right] The second Cartesian.
     * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
     */
    static equals(left, right) {
      return left === right || defined_default(left) && defined_default(right) && left.x === right.x && left.y === right.y;
    }
    /**
     * @param {Cartesian2} cartesian
     * @param {number[]} array
     * @param {number} offset
     * @ignore
     */
    static equalsArray(cartesian, array, offset) {
      return cartesian.x === array[offset] && cartesian.y === array[offset + 1];
    }
    /**
     * Compares the provided Cartesians componentwise and returns
     * <code>true</code> if they pass an absolute or relative tolerance test,
     * <code>false</code> otherwise.
     *
     * @param {Cartesian2} [left] The first Cartesian.
     * @param {Cartesian2} [right] The second Cartesian.
     * @param {number} [relativeEpsilon=0] The relative epsilon tolerance to use for equality testing.
     * @param {number} [absoluteEpsilon=relativeEpsilon] The absolute epsilon tolerance to use for equality testing.
     * @returns {boolean} <code>true</code> if left and right are within the provided epsilon, <code>false</code> otherwise.
     */
    static equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
      return left === right || defined_default(left) && defined_default(right) && Math_default.equalsEpsilon(
        left.x,
        right.x,
        relativeEpsilon,
        absoluteEpsilon
      ) && Math_default.equalsEpsilon(
        left.y,
        right.y,
        relativeEpsilon,
        absoluteEpsilon
      );
    }
    /**
     * Duplicates this Cartesian2 instance.
     *
     * @param {Cartesian2} [result] The object onto which to store the result.
     * @returns {Cartesian2} The modified result parameter or a new Cartesian2 instance if one was not provided.
     */
    clone(result) {
      return _Cartesian2.clone(this, result);
    }
    /**
     * Compares this Cartesian against the provided Cartesian componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartesian2} [right] The right hand side Cartesian.
     * @returns {boolean} <code>true</code> if they are equal, <code>false</code> otherwise.
     */
    equals(right) {
      return _Cartesian2.equals(this, right);
    }
    /**
     * Compares this Cartesian against the provided Cartesian componentwise and returns
     * <code>true</code> if they pass an absolute or relative tolerance test,
     * <code>false</code> otherwise.
     *
     * @param {Cartesian2} [right] The right hand side Cartesian.
     * @param {number} [relativeEpsilon=0] The relative epsilon tolerance to use for equality testing.
     * @param {number} [absoluteEpsilon=relativeEpsilon] The absolute epsilon tolerance to use for equality testing.
     * @returns {boolean} <code>true</code> if they are within the provided epsilon, <code>false</code> otherwise.
     */
    equalsEpsilon(right, relativeEpsilon, absoluteEpsilon) {
      return _Cartesian2.equalsEpsilon(
        this,
        right,
        relativeEpsilon,
        absoluteEpsilon
      );
    }
    /**
     * Creates a string representing this Cartesian in the format '(x, y)'.
     *
     * @returns {string} A string representing the provided Cartesian in the format '(x, y)'.
     */
    toString() {
      return `(${this.x}, ${this.y})`;
    }
  };
  Cartesian2.fromCartesian3 = Cartesian2.clone;
  Cartesian2.fromCartesian4 = Cartesian2.clone;
  Cartesian2.packedLength = 2;
  Cartesian2.fromArray = Cartesian2.unpack;
  var distanceScratch = new Cartesian2();
  var lerpScratch = new Cartesian2();
  var angleBetweenScratch = new Cartesian2();
  var angleBetweenScratch2 = new Cartesian2();
  var mostOrthogonalAxisScratch = new Cartesian2();
  Cartesian2.ZERO = Object.freeze(new Cartesian2(0, 0));
  Cartesian2.ONE = Object.freeze(new Cartesian2(1, 1));
  Cartesian2.UNIT_X = Object.freeze(new Cartesian2(1, 0));
  Cartesian2.UNIT_Y = Object.freeze(new Cartesian2(0, 1));
  var Cartesian2_default = Cartesian2;

  // ../../node_modules/@cesium/engine/Source/Core/Cartesian3.js
  var Cartesian3 = class _Cartesian3 {
    /**
     * @param {number} [x=0.0] The X component.
     * @param {number} [y=0.0] The Y component.
     * @param {number} [z=0.0] The Z component.
     */
    constructor(x, y, z) {
      this.x = x ?? 0;
      this.y = y ?? 0;
      this.z = z ?? 0;
    }
    /**
     * Converts the provided Spherical into Cartesian3 coordinates.
     *
     * @param {Spherical} spherical The Spherical to be converted to Cartesian3.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    static fromSpherical(spherical, result) {
      Check_default.typeOf.object("spherical", spherical);
      if (!defined_default(result)) {
        result = new _Cartesian3();
      }
      const clock = spherical.clock;
      const cone = spherical.cone;
      const magnitude = spherical.magnitude ?? 1;
      const radial = magnitude * Math.sin(cone);
      result.x = radial * Math.cos(clock);
      result.y = radial * Math.sin(clock);
      result.z = magnitude * Math.cos(cone);
      return result;
    }
    /**
     * Creates a Cartesian3 instance from x, y and z coordinates.
     *
     * @param {number} x The x coordinate.
     * @param {number} y The y coordinate.
     * @param {number} z The z coordinate.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    static fromElements(x, y, z, result) {
      if (!defined_default(result)) {
        return new _Cartesian3(x, y, z);
      }
      result.x = x;
      result.y = y;
      result.z = z;
      return result;
    }
    /**
     * Duplicates a Cartesian3 instance.
     *
     * @param {Cartesian3} cartesian The Cartesian to duplicate.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided. (Returns undefined if cartesian is undefined)
     */
    static clone(cartesian, result) {
      if (!defined_default(cartesian)) {
        return void 0;
      }
      if (!defined_default(result)) {
        return new _Cartesian3(cartesian.x, cartesian.y, cartesian.z);
      }
      result.x = cartesian.x;
      result.y = cartesian.y;
      result.z = cartesian.z;
      return result;
    }
    /**
     * Stores the provided instance into the provided array.
     *
     * @param {Cartesian3} value The value to pack.
     * @param {number[]} array The array to pack into.
     * @param {number} [startingIndex=0] The index into the array at which to start packing the elements.
     *
     * @returns {number[]} The array that was packed into
     */
    static pack(value, array, startingIndex) {
      Check_default.typeOf.object("value", value);
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      array[startingIndex++] = value.x;
      array[startingIndex++] = value.y;
      array[startingIndex] = value.z;
      return array;
    }
    /**
     * Retrieves an instance from a packed array.
     *
     * @param {number[]} array The packed array.
     * @param {number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {Cartesian3} [result] The object into which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    static unpack(array, startingIndex, result) {
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      if (!defined_default(result)) {
        result = new _Cartesian3();
      }
      result.x = array[startingIndex++];
      result.y = array[startingIndex++];
      result.z = array[startingIndex];
      return result;
    }
    /**
     * Flattens an array of Cartesian3s into an array of components.
     *
     * @param {Cartesian3[]} array The array of cartesians to pack.
     * @param {number[]} [result] The array onto which to store the result. If this is a typed array, it must have array.length * 3 components, else a {@link DeveloperError} will be thrown. If it is a regular array, it will be resized to have (array.length * 3) elements.
     * @returns {number[]} The packed array.
     */
    static packArray(array, result) {
      Check_default.defined("array", array);
      const length = array.length;
      const resultLength = length * 3;
      if (!defined_default(result)) {
        result = new Array(resultLength);
      } else if (!Array.isArray(result) && result.length !== resultLength) {
        throw new DeveloperError_default(
          "If result is a typed array, it must have exactly array.length * 3 elements"
        );
      } else if (result.length !== resultLength) {
        result.length = resultLength;
      }
      for (let i = 0; i < length; ++i) {
        _Cartesian3.pack(array[i], result, i * 3);
      }
      return result;
    }
    /**
     * Unpacks an array of cartesian components into an array of Cartesian3s.
     *
     * @param {number[]} array The array of components to unpack.
     * @param {Cartesian3[]} [result] The array onto which to store the result.
     * @returns {Cartesian3[]} The unpacked array.
     */
    static unpackArray(array, result) {
      Check_default.defined("array", array);
      Check_default.typeOf.number.greaterThanOrEquals("array.length", array.length, 3);
      if (array.length % 3 !== 0) {
        throw new DeveloperError_default("array length must be a multiple of 3.");
      }
      const length = array.length;
      if (!defined_default(result)) {
        result = new Array(length / 3);
      } else {
        result.length = length / 3;
      }
      for (let i = 0; i < length; i += 3) {
        const index = i / 3;
        result[index] = _Cartesian3.unpack(array, i, result[index]);
      }
      return result;
    }
    /**
     * Computes the value of the maximum component for the supplied Cartesian.
     *
     * @param {Cartesian3} cartesian The cartesian to use.
     * @returns {number} The value of the maximum component.
     */
    static maximumComponent(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return Math.max(cartesian.x, cartesian.y, cartesian.z);
    }
    /**
     * Computes the value of the minimum component for the supplied Cartesian.
     *
     * @param {Cartesian3} cartesian The cartesian to use.
     * @returns {number} The value of the minimum component.
     */
    static minimumComponent(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return Math.min(cartesian.x, cartesian.y, cartesian.z);
    }
    /**
     * Compares two Cartesians and computes a Cartesian which contains the minimum components of the supplied Cartesians.
     *
     * @param {Cartesian3} first A cartesian to compare.
     * @param {Cartesian3} second A cartesian to compare.
     * @param {Cartesian3} result The object into which to store the result.
     * @returns {Cartesian3} A cartesian with the minimum components.
     */
    static minimumByComponent(first, second, result) {
      Check_default.typeOf.object("first", first);
      Check_default.typeOf.object("second", second);
      Check_default.typeOf.object("result", result);
      result.x = Math.min(first.x, second.x);
      result.y = Math.min(first.y, second.y);
      result.z = Math.min(first.z, second.z);
      return result;
    }
    /**
     * Compares two Cartesians and computes a Cartesian which contains the maximum components of the supplied Cartesians.
     *
     * @param {Cartesian3} first A cartesian to compare.
     * @param {Cartesian3} second A cartesian to compare.
     * @param {Cartesian3} result The object into which to store the result.
     * @returns {Cartesian3} A cartesian with the maximum components.
     */
    static maximumByComponent(first, second, result) {
      Check_default.typeOf.object("first", first);
      Check_default.typeOf.object("second", second);
      Check_default.typeOf.object("result", result);
      result.x = Math.max(first.x, second.x);
      result.y = Math.max(first.y, second.y);
      result.z = Math.max(first.z, second.z);
      return result;
    }
    /**
     * Constrain a value to lie between two values.
     *
     * @param {Cartesian3} value The value to clamp.
     * @param {Cartesian3} min The minimum bound.
     * @param {Cartesian3} max The maximum bound.
     * @param {Cartesian3} result The object into which to store the result.
     * @returns {Cartesian3} The clamped value such that min <= value <= max.
     */
    static clamp(value, min, max, result) {
      Check_default.typeOf.object("value", value);
      Check_default.typeOf.object("min", min);
      Check_default.typeOf.object("max", max);
      Check_default.typeOf.object("result", result);
      const x = Math_default.clamp(value.x, min.x, max.x);
      const y = Math_default.clamp(value.y, min.y, max.y);
      const z = Math_default.clamp(value.z, min.z, max.z);
      result.x = x;
      result.y = y;
      result.z = z;
      return result;
    }
    /**
     * Computes the provided Cartesian's squared magnitude.
     *
     * @param {Cartesian3} cartesian The Cartesian instance whose squared magnitude is to be computed.
     * @returns {number} The squared magnitude.
     */
    static magnitudeSquared(cartesian) {
      Check_default.typeOf.object("cartesian", cartesian);
      return cartesian.x * cartesian.x + cartesian.y * cartesian.y + cartesian.z * cartesian.z;
    }
    /**
     * Computes the Cartesian's magnitude (length).
     *
     * @param {Cartesian3} cartesian The Cartesian instance whose magnitude is to be computed.
     * @returns {number} The magnitude.
     */
    static magnitude(cartesian) {
      return Math.sqrt(_Cartesian3.magnitudeSquared(cartesian));
    }
    /**
     * Computes the distance between two points.
     *
     * @param {Cartesian3} left The first point to compute the distance from.
     * @param {Cartesian3} right The second point to compute the distance to.
     * @returns {number} The distance between two points.
     *
     * @example
     * // Returns 1.0
     * const d = Cesium.Cartesian3.distance(new Cesium.Cartesian3(1.0, 0.0, 0.0), new Cesium.Cartesian3(2.0, 0.0, 0.0));
     */
    static distance(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian3.subtract(left, right, distanceScratch2);
      return _Cartesian3.magnitude(distanceScratch2);
    }
    /**
     * Computes the squared distance between two points.  Comparing squared distances
     * using this function is more efficient than comparing distances using {@link Cartesian3#distance}.
     *
     * @param {Cartesian3} left The first point to compute the distance from.
     * @param {Cartesian3} right The second point to compute the distance to.
     * @returns {number} The distance between two points.
     *
     * @example
     * // Returns 4.0, not 2.0
     * const d = Cesium.Cartesian3.distanceSquared(new Cesium.Cartesian3(1.0, 0.0, 0.0), new Cesium.Cartesian3(3.0, 0.0, 0.0));
     */
    static distanceSquared(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian3.subtract(left, right, distanceScratch2);
      return _Cartesian3.magnitudeSquared(distanceScratch2);
    }
    /**
     * Computes the normalized form of the supplied Cartesian.
     *
     * @param {Cartesian3} cartesian The Cartesian to be normalized.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static normalize(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      const magnitude = _Cartesian3.magnitude(cartesian);
      result.x = cartesian.x / magnitude;
      result.y = cartesian.y / magnitude;
      result.z = cartesian.z / magnitude;
      if (isNaN(result.x) || isNaN(result.y) || isNaN(result.z)) {
        throw new DeveloperError_default("normalized result is not a number");
      }
      return result;
    }
    /**
     * Computes the dot (scalar) product of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @returns {number} The dot product.
     */
    static dot(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      return left.x * right.x + left.y * right.y + left.z * right.z;
    }
    /**
     * Computes the componentwise product of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static multiplyComponents(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x * right.x;
      result.y = left.y * right.y;
      result.z = left.z * right.z;
      return result;
    }
    /**
     * Computes the componentwise quotient of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static divideComponents(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x / right.x;
      result.y = left.y / right.y;
      result.z = left.z / right.z;
      return result;
    }
    /**
     * Computes the componentwise sum of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static add(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x + right.x;
      result.y = left.y + right.y;
      result.z = left.z + right.z;
      return result;
    }
    /**
     * Computes the componentwise difference of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static subtract(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = left.x - right.x;
      result.y = left.y - right.y;
      result.z = left.z - right.z;
      return result;
    }
    /**
     * Multiplies the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian3} cartesian The Cartesian to be scaled.
     * @param {number} scalar The scalar to multiply with.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static multiplyByScalar(cartesian, scalar, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.x = cartesian.x * scalar;
      result.y = cartesian.y * scalar;
      result.z = cartesian.z * scalar;
      return result;
    }
    /**
     * Divides the provided Cartesian componentwise by the provided scalar.
     *
     * @param {Cartesian3} cartesian The Cartesian to be divided.
     * @param {number} scalar The scalar to divide by.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static divideByScalar(cartesian, scalar, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.x = cartesian.x / scalar;
      result.y = cartesian.y / scalar;
      result.z = cartesian.z / scalar;
      return result;
    }
    /**
     * Negates the provided Cartesian.
     *
     * @param {Cartesian3} cartesian The Cartesian to be negated.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static negate(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      result.x = -cartesian.x;
      result.y = -cartesian.y;
      result.z = -cartesian.z;
      return result;
    }
    /**
     * Computes the absolute value of the provided Cartesian.
     *
     * @param {Cartesian3} cartesian The Cartesian whose absolute value is to be computed.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static abs(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      result.x = Math.abs(cartesian.x);
      result.y = Math.abs(cartesian.y);
      result.z = Math.abs(cartesian.z);
      return result;
    }
    /**
     * Computes the linear interpolation or extrapolation at t using the provided cartesians.
     *
     * @param {Cartesian3} start The value corresponding to t at 0.0.
     * @param {Cartesian3} end The value corresponding to t at 1.0.
     * @param {number} t The point along t at which to interpolate.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter.
     */
    static lerp(start, end, t, result) {
      Check_default.typeOf.object("start", start);
      Check_default.typeOf.object("end", end);
      Check_default.typeOf.number("t", t);
      Check_default.typeOf.object("result", result);
      _Cartesian3.multiplyByScalar(end, t, lerpScratch2);
      result = _Cartesian3.multiplyByScalar(start, 1 - t, result);
      return _Cartesian3.add(lerpScratch2, result, result);
    }
    /**
     * Returns the angle, in radians, between the provided Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @returns {number} The angle between the Cartesians.
     */
    static angleBetween(left, right) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      _Cartesian3.normalize(left, angleBetweenScratch3);
      _Cartesian3.normalize(right, angleBetweenScratch22);
      const cosine = _Cartesian3.dot(angleBetweenScratch3, angleBetweenScratch22);
      const sine = _Cartesian3.magnitude(
        _Cartesian3.cross(
          angleBetweenScratch3,
          angleBetweenScratch22,
          angleBetweenScratch3
        )
      );
      return Math.atan2(sine, cosine);
    }
    /**
     * Returns the axis that is most orthogonal to the provided Cartesian.
     *
     * @param {Cartesian3} cartesian The Cartesian on which to find the most orthogonal axis.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The most orthogonal axis.
     */
    static mostOrthogonalAxis(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      Check_default.typeOf.object("result", result);
      const f = _Cartesian3.normalize(cartesian, mostOrthogonalAxisScratch2);
      _Cartesian3.abs(f, f);
      if (f.x <= f.y) {
        if (f.x <= f.z) {
          result = _Cartesian3.clone(_Cartesian3.UNIT_X, result);
        } else {
          result = _Cartesian3.clone(_Cartesian3.UNIT_Z, result);
        }
      } else if (f.y <= f.z) {
        result = _Cartesian3.clone(_Cartesian3.UNIT_Y, result);
      } else {
        result = _Cartesian3.clone(_Cartesian3.UNIT_Z, result);
      }
      return result;
    }
    /**
     * Projects vector a onto vector b
     * @param {Cartesian3} a The vector that needs projecting
     * @param {Cartesian3} b The vector to project onto
     * @param {Cartesian3} result The result cartesian
     * @returns {Cartesian3} The modified result parameter
     */
    static projectVector(a, b, result) {
      Check_default.defined("a", a);
      Check_default.defined("b", b);
      Check_default.defined("result", result);
      const scalar = _Cartesian3.dot(a, b) / _Cartesian3.dot(b, b);
      return _Cartesian3.multiplyByScalar(b, scalar, result);
    }
    /**
     * Compares the provided Cartesians componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartesian3} [left] The first Cartesian.
     * @param {Cartesian3} [right] The second Cartesian.
     * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
     */
    static equals(left, right) {
      return left === right || defined_default(left) && defined_default(right) && left.x === right.x && left.y === right.y && left.z === right.z;
    }
    /**
     * @param {Cartesian3} cartesian
     * @param {number[]} array
     * @param {number} offset
     * @ignore
     */
    static equalsArray(cartesian, array, offset) {
      return cartesian.x === array[offset] && cartesian.y === array[offset + 1] && cartesian.z === array[offset + 2];
    }
    /**
     * Compares the provided Cartesians componentwise and returns
     * <code>true</code> if they pass an absolute or relative tolerance test,
     * <code>false</code> otherwise.
     *
     * @param {Cartesian3} [left] The first Cartesian.
     * @param {Cartesian3} [right] The second Cartesian.
     * @param {number} [relativeEpsilon=0] The relative epsilon tolerance to use for equality testing.
     * @param {number} [absoluteEpsilon=relativeEpsilon] The absolute epsilon tolerance to use for equality testing.
     * @returns {boolean} <code>true</code> if left and right are within the provided epsilon, <code>false</code> otherwise.
     */
    static equalsEpsilon(left, right, relativeEpsilon, absoluteEpsilon) {
      return left === right || defined_default(left) && defined_default(right) && Math_default.equalsEpsilon(
        left.x,
        right.x,
        relativeEpsilon,
        absoluteEpsilon
      ) && Math_default.equalsEpsilon(
        left.y,
        right.y,
        relativeEpsilon,
        absoluteEpsilon
      ) && Math_default.equalsEpsilon(
        left.z,
        right.z,
        relativeEpsilon,
        absoluteEpsilon
      );
    }
    /**
     * Computes the cross (outer) product of two Cartesians.
     *
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The cross product.
     */
    static cross(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      const leftX = left.x;
      const leftY = left.y;
      const leftZ = left.z;
      const rightX = right.x;
      const rightY = right.y;
      const rightZ = right.z;
      const x = leftY * rightZ - leftZ * rightY;
      const y = leftZ * rightX - leftX * rightZ;
      const z = leftX * rightY - leftY * rightX;
      result.x = x;
      result.y = y;
      result.z = z;
      return result;
    }
    /**
     * Computes the midpoint between the right and left Cartesian.
     * @param {Cartesian3} left The first Cartesian.
     * @param {Cartesian3} right The second Cartesian.
     * @param {Cartesian3} result The object onto which to store the result.
     * @returns {Cartesian3} The midpoint.
     */
    static midpoint(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.x = (left.x + right.x) * 0.5;
      result.y = (left.y + right.y) * 0.5;
      result.z = (left.z + right.z) * 0.5;
      return result;
    }
    /**
     * Returns a Cartesian3 position from longitude and latitude values given in degrees.
     *
     * @param {number} longitude The longitude, in degrees
     * @param {number} latitude The latitude, in degrees
     * @param {number} [height=0.0] The height, in meters, above the ellipsoid.
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The position
     *
     * @example
     * const position = Cesium.Cartesian3.fromDegrees(-115.0, 37.0);
     */
    static fromDegrees(longitude, latitude, height, ellipsoid, result) {
      Check_default.typeOf.number("longitude", longitude);
      Check_default.typeOf.number("latitude", latitude);
      longitude = Math_default.toRadians(longitude);
      latitude = Math_default.toRadians(latitude);
      return _Cartesian3.fromRadians(
        longitude,
        latitude,
        height,
        ellipsoid,
        result
      );
    }
    /**
     * Returns a Cartesian3 position from longitude and latitude values given in radians.
     *
     * @param {number} longitude The longitude, in radians
     * @param {number} latitude The latitude, in radians
     * @param {number} [height=0.0] The height, in meters, above the ellipsoid.
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The position
     *
     * @example
     * const position = Cesium.Cartesian3.fromRadians(-2.007, 0.645);
     */
    static fromRadians(longitude, latitude, height, ellipsoid, result) {
      Check_default.typeOf.number("longitude", longitude);
      Check_default.typeOf.number("latitude", latitude);
      height = height ?? 0;
      const radiiSquared = !defined_default(ellipsoid) ? _Cartesian3._ellipsoidRadiiSquared : ellipsoid.radiiSquared;
      const cosLatitude = Math.cos(latitude);
      scratchN.x = cosLatitude * Math.cos(longitude);
      scratchN.y = cosLatitude * Math.sin(longitude);
      scratchN.z = Math.sin(latitude);
      scratchN = _Cartesian3.normalize(scratchN, scratchN);
      _Cartesian3.multiplyComponents(radiiSquared, scratchN, scratchK);
      const gamma = Math.sqrt(_Cartesian3.dot(scratchN, scratchK));
      scratchK = _Cartesian3.divideByScalar(scratchK, gamma, scratchK);
      scratchN = _Cartesian3.multiplyByScalar(scratchN, height, scratchN);
      if (!defined_default(result)) {
        result = new _Cartesian3();
      }
      return _Cartesian3.add(scratchK, scratchN, result);
    }
    /**
     * Returns an array of Cartesian3 positions given an array of longitude and latitude values given in degrees.
     *
     * @param {number[]} coordinates A list of longitude and latitude values. Values alternate [longitude, latitude, longitude, latitude...].
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the coordinates lie.
     * @param {Cartesian3[]} [result] An array of Cartesian3 objects to store the result.
     * @returns {Cartesian3[]} The array of positions.
     *
     * @example
     * const positions = Cesium.Cartesian3.fromDegreesArray([-115.0, 37.0, -107.0, 33.0]);
     */
    static fromDegreesArray(coordinates, ellipsoid, result) {
      Check_default.defined("coordinates", coordinates);
      if (coordinates.length < 2 || coordinates.length % 2 !== 0) {
        throw new DeveloperError_default(
          "the number of coordinates must be a multiple of 2 and at least 2"
        );
      }
      const length = coordinates.length;
      if (!defined_default(result)) {
        result = new Array(length / 2);
      } else {
        result.length = length / 2;
      }
      for (let i = 0; i < length; i += 2) {
        const longitude = coordinates[i];
        const latitude = coordinates[i + 1];
        const index = i / 2;
        result[index] = _Cartesian3.fromDegrees(
          longitude,
          latitude,
          0,
          ellipsoid,
          result[index]
        );
      }
      return result;
    }
    /**
     * Returns an array of Cartesian3 positions given an array of longitude and latitude values given in radians.
     *
     * @param {number[]} coordinates A list of longitude and latitude values. Values alternate [longitude, latitude, longitude, latitude...].
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the coordinates lie.
     * @param {Cartesian3[]} [result] An array of Cartesian3 objects to store the result.
     * @returns {Cartesian3[]} The array of positions.
     *
     * @example
     * const positions = Cesium.Cartesian3.fromRadiansArray([-2.007, 0.645, -1.867, .575]);
     */
    static fromRadiansArray(coordinates, ellipsoid, result) {
      Check_default.defined("coordinates", coordinates);
      if (coordinates.length < 2 || coordinates.length % 2 !== 0) {
        throw new DeveloperError_default(
          "the number of coordinates must be a multiple of 2 and at least 2"
        );
      }
      const length = coordinates.length;
      if (!defined_default(result)) {
        result = new Array(length / 2);
      } else {
        result.length = length / 2;
      }
      for (let i = 0; i < length; i += 2) {
        const longitude = coordinates[i];
        const latitude = coordinates[i + 1];
        const index = i / 2;
        result[index] = _Cartesian3.fromRadians(
          longitude,
          latitude,
          0,
          ellipsoid,
          result[index]
        );
      }
      return result;
    }
    /**
     * Returns an array of Cartesian3 positions given an array of longitude, latitude and height values where longitude and latitude are given in degrees.
     *
     * @param {number[]} coordinates A list of longitude, latitude and height values. Values alternate [longitude, latitude, height, longitude, latitude, height...].
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartesian3[]} [result] An array of Cartesian3 objects to store the result.
     * @returns {Cartesian3[]} The array of positions.
     *
     * @example
     * const positions = Cesium.Cartesian3.fromDegreesArrayHeights([-115.0, 37.0, 100000.0, -107.0, 33.0, 150000.0]);
     */
    static fromDegreesArrayHeights(coordinates, ellipsoid, result) {
      Check_default.defined("coordinates", coordinates);
      if (coordinates.length < 3 || coordinates.length % 3 !== 0) {
        throw new DeveloperError_default(
          "the number of coordinates must be a multiple of 3 and at least 3"
        );
      }
      const length = coordinates.length;
      if (!defined_default(result)) {
        result = new Array(length / 3);
      } else {
        result.length = length / 3;
      }
      for (let i = 0; i < length; i += 3) {
        const longitude = coordinates[i];
        const latitude = coordinates[i + 1];
        const height = coordinates[i + 2];
        const index = i / 3;
        result[index] = _Cartesian3.fromDegrees(
          longitude,
          latitude,
          height,
          ellipsoid,
          result[index]
        );
      }
      return result;
    }
    /**
     * Returns an array of Cartesian3 positions given an array of longitude, latitude and height values where longitude and latitude are given in radians.
     *
     * @param {number[]} coordinates A list of longitude, latitude and height values. Values alternate [longitude, latitude, height, longitude, latitude, height...].
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartesian3[]} [result] An array of Cartesian3 objects to store the result.
     * @returns {Cartesian3[]} The array of positions.
     *
     * @example
     * const positions = Cesium.Cartesian3.fromRadiansArrayHeights([-2.007, 0.645, 100000.0, -1.867, .575, 150000.0]);
     */
    static fromRadiansArrayHeights(coordinates, ellipsoid, result) {
      Check_default.defined("coordinates", coordinates);
      if (coordinates.length < 3 || coordinates.length % 3 !== 0) {
        throw new DeveloperError_default(
          "the number of coordinates must be a multiple of 3 and at least 3"
        );
      }
      const length = coordinates.length;
      if (!defined_default(result)) {
        result = new Array(length / 3);
      } else {
        result.length = length / 3;
      }
      for (let i = 0; i < length; i += 3) {
        const longitude = coordinates[i];
        const latitude = coordinates[i + 1];
        const height = coordinates[i + 2];
        const index = i / 3;
        result[index] = _Cartesian3.fromRadians(
          longitude,
          latitude,
          height,
          ellipsoid,
          result[index]
        );
      }
      return result;
    }
    /**
     * Duplicates this Cartesian3 instance.
     *
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The modified result parameter or a new Cartesian3 instance if one was not provided.
     */
    clone(result) {
      return _Cartesian3.clone(this, result);
    }
    /**
     * Compares this Cartesian against the provided Cartesian componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartesian3} [right] The right hand side Cartesian.
     * @returns {boolean} <code>true</code> if they are equal, <code>false</code> otherwise.
     */
    equals(right) {
      return _Cartesian3.equals(this, right);
    }
    /**
     * Compares this Cartesian against the provided Cartesian componentwise and returns
     * <code>true</code> if they pass an absolute or relative tolerance test,
     * <code>false</code> otherwise.
     *
     * @param {Cartesian3} [right] The right hand side Cartesian.
     * @param {number} [relativeEpsilon=0] The relative epsilon tolerance to use for equality testing.
     * @param {number} [absoluteEpsilon=relativeEpsilon] The absolute epsilon tolerance to use for equality testing.
     * @returns {boolean} <code>true</code> if they are within the provided epsilon, <code>false</code> otherwise.
     */
    equalsEpsilon(right, relativeEpsilon, absoluteEpsilon) {
      return _Cartesian3.equalsEpsilon(
        this,
        right,
        relativeEpsilon,
        absoluteEpsilon
      );
    }
    /**
     * Creates a string representing this Cartesian in the format '(x, y, z)'.
     *
     * @returns {string} A string representing this Cartesian in the format '(x, y, z)'.
     */
    toString() {
      return `(${this.x}, ${this.y}, ${this.z})`;
    }
  };
  Cartesian3.fromCartesian4 = Cartesian3.clone;
  Cartesian3.packedLength = 3;
  Cartesian3.fromArray = Cartesian3.unpack;
  var distanceScratch2 = new Cartesian3();
  var lerpScratch2 = new Cartesian3();
  var angleBetweenScratch3 = new Cartesian3();
  var angleBetweenScratch22 = new Cartesian3();
  var mostOrthogonalAxisScratch2 = new Cartesian3();
  var scratchN = new Cartesian3();
  var scratchK = new Cartesian3();
  Cartesian3._ellipsoidRadiiSquared = new Cartesian3(
    6378137 * 6378137,
    6378137 * 6378137,
    6356752314245179e-9 * 6356752314245179e-9
  );
  Cartesian3.ZERO = Object.freeze(new Cartesian3(0, 0, 0));
  Cartesian3.ONE = Object.freeze(new Cartesian3(1, 1, 1));
  Cartesian3.UNIT_X = Object.freeze(new Cartesian3(1, 0, 0));
  Cartesian3.UNIT_Y = Object.freeze(new Cartesian3(0, 1, 0));
  Cartesian3.UNIT_Z = Object.freeze(new Cartesian3(0, 0, 1));
  var Cartesian3_default = Cartesian3;

  // ../../node_modules/@cesium/engine/Source/Core/scaleToGeodeticSurface.js
  var scaleToGeodeticSurfaceIntersection = new Cartesian3_default();
  var scaleToGeodeticSurfaceGradient = new Cartesian3_default();
  function scaleToGeodeticSurface(cartesian, oneOverRadii, oneOverRadiiSquared, centerToleranceSquared, result) {
    if (!defined_default(cartesian)) {
      throw new DeveloperError_default("cartesian is required.");
    }
    if (!defined_default(oneOverRadii)) {
      throw new DeveloperError_default("oneOverRadii is required.");
    }
    if (!defined_default(oneOverRadiiSquared)) {
      throw new DeveloperError_default("oneOverRadiiSquared is required.");
    }
    if (!defined_default(centerToleranceSquared)) {
      throw new DeveloperError_default("centerToleranceSquared is required.");
    }
    const positionX = cartesian.x;
    const positionY = cartesian.y;
    const positionZ = cartesian.z;
    const oneOverRadiiX = oneOverRadii.x;
    const oneOverRadiiY = oneOverRadii.y;
    const oneOverRadiiZ = oneOverRadii.z;
    const x2 = positionX * positionX * oneOverRadiiX * oneOverRadiiX;
    const y2 = positionY * positionY * oneOverRadiiY * oneOverRadiiY;
    const z2 = positionZ * positionZ * oneOverRadiiZ * oneOverRadiiZ;
    const squaredNorm = x2 + y2 + z2;
    const ratio = Math.sqrt(1 / squaredNorm);
    const intersection = Cartesian3_default.multiplyByScalar(
      cartesian,
      ratio,
      scaleToGeodeticSurfaceIntersection
    );
    if (squaredNorm < centerToleranceSquared) {
      return !isFinite(ratio) ? void 0 : Cartesian3_default.clone(intersection, result);
    }
    const oneOverRadiiSquaredX = oneOverRadiiSquared.x;
    const oneOverRadiiSquaredY = oneOverRadiiSquared.y;
    const oneOverRadiiSquaredZ = oneOverRadiiSquared.z;
    const gradient = scaleToGeodeticSurfaceGradient;
    gradient.x = intersection.x * oneOverRadiiSquaredX * 2;
    gradient.y = intersection.y * oneOverRadiiSquaredY * 2;
    gradient.z = intersection.z * oneOverRadiiSquaredZ * 2;
    let lambda = (1 - ratio) * Cartesian3_default.magnitude(cartesian) / (0.5 * Cartesian3_default.magnitude(gradient));
    let correction = 0;
    let func;
    let denominator;
    let xMultiplier;
    let yMultiplier;
    let zMultiplier;
    let xMultiplier2;
    let yMultiplier2;
    let zMultiplier2;
    let xMultiplier3;
    let yMultiplier3;
    let zMultiplier3;
    do {
      lambda -= correction;
      xMultiplier = 1 / (1 + lambda * oneOverRadiiSquaredX);
      yMultiplier = 1 / (1 + lambda * oneOverRadiiSquaredY);
      zMultiplier = 1 / (1 + lambda * oneOverRadiiSquaredZ);
      xMultiplier2 = xMultiplier * xMultiplier;
      yMultiplier2 = yMultiplier * yMultiplier;
      zMultiplier2 = zMultiplier * zMultiplier;
      xMultiplier3 = xMultiplier2 * xMultiplier;
      yMultiplier3 = yMultiplier2 * yMultiplier;
      zMultiplier3 = zMultiplier2 * zMultiplier;
      func = x2 * xMultiplier2 + y2 * yMultiplier2 + z2 * zMultiplier2 - 1;
      denominator = x2 * xMultiplier3 * oneOverRadiiSquaredX + y2 * yMultiplier3 * oneOverRadiiSquaredY + z2 * zMultiplier3 * oneOverRadiiSquaredZ;
      const derivative = -2 * denominator;
      correction = func / derivative;
    } while (Math.abs(func) > Math_default.EPSILON12);
    if (!defined_default(result)) {
      return new Cartesian3_default(
        positionX * xMultiplier,
        positionY * yMultiplier,
        positionZ * zMultiplier
      );
    }
    result.x = positionX * xMultiplier;
    result.y = positionY * yMultiplier;
    result.z = positionZ * zMultiplier;
    return result;
  }
  var scaleToGeodeticSurface_default = scaleToGeodeticSurface;

  // ../../node_modules/@cesium/engine/Source/Core/Cartographic.js
  var Cartographic = class _Cartographic {
    /**
     * @param {number} [longitude=0.0] The longitude, in radians.
     * @param {number} [latitude=0.0] The latitude, in radians.
     * @param {number} [height=0.0] The height, in meters, above the ellipsoid.
     */
    constructor(longitude, latitude, height) {
      this.longitude = longitude ?? 0;
      this.latitude = latitude ?? 0;
      this.height = height ?? 0;
    }
    /**
     * Creates a new Cartographic instance from longitude and latitude
     * specified in radians.
     *
     * @param {number} longitude The longitude, in radians.
     * @param {number} latitude The latitude, in radians.
     * @param {number} [height=0.0] The height, in meters, above the ellipsoid.
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter or a new Cartographic instance if one was not provided.
     */
    static fromRadians(longitude, latitude, height, result) {
      Check_default.typeOf.number("longitude", longitude);
      Check_default.typeOf.number("latitude", latitude);
      height = height ?? 0;
      if (!defined_default(result)) {
        return new _Cartographic(longitude, latitude, height);
      }
      result.longitude = longitude;
      result.latitude = latitude;
      result.height = height;
      return result;
    }
    /**
     * Creates a new Cartographic instance from longitude and latitude
     * specified in degrees.  The values in the resulting object will
     * be in radians.
     *
     * @param {number} longitude The longitude, in degrees.
     * @param {number} latitude The latitude, in degrees.
     * @param {number} [height=0.0] The height, in meters, above the ellipsoid.
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter or a new Cartographic instance if one was not provided.
     */
    static fromDegrees(longitude, latitude, height, result) {
      Check_default.typeOf.number("longitude", longitude);
      Check_default.typeOf.number("latitude", latitude);
      longitude = Math_default.toRadians(longitude);
      latitude = Math_default.toRadians(latitude);
      return _Cartographic.fromRadians(longitude, latitude, height, result);
    }
    /**
     * Creates a new Cartographic instance from a Cartesian position. The values in the
     * resulting object will be in radians.
     *
     * @param {Cartesian3} cartesian The Cartesian position to convert to cartographic representation.
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter, new Cartographic instance if none was provided, or undefined if the cartesian is at the center of the ellipsoid.
     */
    static fromCartesian(cartesian, ellipsoid, result) {
      const oneOverRadii = defined_default(ellipsoid) ? ellipsoid.oneOverRadii : _Cartographic._ellipsoidOneOverRadii;
      const oneOverRadiiSquared = defined_default(ellipsoid) ? ellipsoid.oneOverRadiiSquared : _Cartographic._ellipsoidOneOverRadiiSquared;
      const centerToleranceSquared = defined_default(ellipsoid) ? ellipsoid._centerToleranceSquared : _Cartographic._ellipsoidCenterToleranceSquared;
      const p = scaleToGeodeticSurface_default(
        cartesian,
        oneOverRadii,
        oneOverRadiiSquared,
        centerToleranceSquared,
        cartesianToCartographicP
      );
      if (!defined_default(p)) {
        return void 0;
      }
      let n = Cartesian3_default.multiplyComponents(
        p,
        oneOverRadiiSquared,
        cartesianToCartographicN
      );
      n = Cartesian3_default.normalize(n, n);
      const h = Cartesian3_default.subtract(cartesian, p, cartesianToCartographicH);
      const longitude = Math.atan2(n.y, n.x);
      const latitude = Math.asin(n.z);
      const height = Math_default.sign(Cartesian3_default.dot(h, cartesian)) * Cartesian3_default.magnitude(h);
      if (!defined_default(result)) {
        return new _Cartographic(longitude, latitude, height);
      }
      result.longitude = longitude;
      result.latitude = latitude;
      result.height = height;
      return result;
    }
    /**
     * Creates a new Cartesian3 instance from a Cartographic input. The values in the inputted
     * object should be in radians.
     *
     * @param {Cartographic} cartographic Input to be converted into a Cartesian3 output.
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid on which the position lies.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The position
     */
    static toCartesian(cartographic, ellipsoid, result) {
      Check_default.defined("cartographic", cartographic);
      return Cartesian3_default.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height,
        ellipsoid,
        result
      );
    }
    /**
     * Duplicates a Cartographic instance.
     *
     * @param {Cartographic} cartographic The cartographic to duplicate.
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter or a new Cartographic instance if one was not provided. (Returns undefined if cartographic is undefined)
     */
    static clone(cartographic, result) {
      if (!defined_default(cartographic)) {
        return void 0;
      }
      if (!defined_default(result)) {
        return new _Cartographic(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height
        );
      }
      result.longitude = cartographic.longitude;
      result.latitude = cartographic.latitude;
      result.height = cartographic.height;
      return result;
    }
    /**
     * Compares the provided cartographics componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartographic} [left] The first cartographic.
     * @param {Cartographic} [right] The second cartographic.
     * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
     */
    static equals(left, right) {
      return left === right || defined_default(left) && defined_default(right) && left.longitude === right.longitude && left.latitude === right.latitude && left.height === right.height;
    }
    /**
     * Compares the provided cartographics componentwise and returns
     * <code>true</code> if they are within the provided epsilon,
     * <code>false</code> otherwise.
     *
     * @param {Cartographic} [left] The first cartographic.
     * @param {Cartographic} [right] The second cartographic.
     * @param {number} [epsilon=0] The epsilon to use for equality testing.
     * @returns {boolean} <code>true</code> if left and right are within the provided epsilon, <code>false</code> otherwise.
     */
    static equalsEpsilon(left, right, epsilon) {
      epsilon = epsilon ?? 0;
      return left === right || defined_default(left) && defined_default(right) && Math.abs(left.longitude - right.longitude) <= epsilon && Math.abs(left.latitude - right.latitude) <= epsilon && Math.abs(left.height - right.height) <= epsilon;
    }
    /**
     * Duplicates this instance.
     *
     * @param {Cartographic} [result] The object onto which to store the result.
     * @returns {Cartographic} The modified result parameter or a new Cartographic instance if one was not provided.
     */
    clone(result) {
      return _Cartographic.clone(this, result);
    }
    /**
     * Compares the provided against this cartographic componentwise and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Cartographic} [right] The second cartographic.
     * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
     */
    equals(right) {
      return _Cartographic.equals(this, right);
    }
    /**
     * Compares the provided against this cartographic componentwise and returns
     * <code>true</code> if they are within the provided epsilon,
     * <code>false</code> otherwise.
     *
     * @param {Cartographic} [right] The second cartographic.
     * @param {number} [epsilon=0] The epsilon to use for equality testing.
     * @returns {boolean} <code>true</code> if left and right are within the provided epsilon, <code>false</code> otherwise.
     */
    equalsEpsilon(right, epsilon) {
      return _Cartographic.equalsEpsilon(this, right, epsilon);
    }
    /**
     * Creates a string representing this cartographic in the format '(longitude, latitude, height)'.
     *
     * @returns {string} A string representing the provided cartographic in the format '(longitude, latitude, height)'.
     */
    toString() {
      return `(${this.longitude}, ${this.latitude}, ${this.height})`;
    }
    // To avoid circular dependencies, these are set by Ellipsoid when Ellipsoid.default is set.
    static _ellipsoidOneOverRadii = new Cartesian3_default(
      1 / 6378137,
      1 / 6378137,
      1 / 6356752314245179e-9
    );
    static _ellipsoidOneOverRadiiSquared = new Cartesian3_default(
      1 / (6378137 * 6378137),
      1 / (6378137 * 6378137),
      1 / (6356752314245179e-9 * 6356752314245179e-9)
    );
    static _ellipsoidCenterToleranceSquared = Math_default.EPSILON1;
  };
  Cartographic.ZERO = Object.freeze(new Cartographic(0, 0, 0));
  var cartesianToCartographicN = new Cartesian3_default();
  var cartesianToCartographicP = new Cartesian3_default();
  var cartesianToCartographicH = new Cartesian3_default();
  var Cartographic_default = Cartographic;

  // ../../node_modules/@cesium/engine/Source/Core/Frozen.js
  var Frozen = {};
  Frozen.EMPTY_OBJECT = Object.freeze({});
  Frozen.EMPTY_ARRAY = Object.freeze([]);
  var Frozen_default = Frozen;

  // ../../node_modules/@cesium/engine/Source/Core/Fullscreen.js
  var _supportsFullscreen;
  var _names = {
    requestFullscreen: void 0,
    exitFullscreen: void 0,
    fullscreenEnabled: void 0,
    fullscreenElement: void 0,
    fullscreenchange: void 0,
    fullscreenerror: void 0
  };
  var Fullscreen = {};
  Object.defineProperties(Fullscreen, {
    /**
     * The element that is currently fullscreen, if any.  To simply check if the
     * browser is in fullscreen mode or not, use {@link Fullscreen#fullscreen}.
     * @memberof Fullscreen
     * @type {object}
     * @readonly
     */
    element: {
      get: function() {
        if (!Fullscreen.supportsFullscreen()) {
          return void 0;
        }
        return document[_names.fullscreenElement];
      }
    },
    /**
     * The name of the event on the document that is fired when fullscreen is
     * entered or exited.  This event name is intended for use with addEventListener.
     * In your event handler, to determine if the browser is in fullscreen mode or not,
     * use {@link Fullscreen#fullscreen}.
     * @memberof Fullscreen
     * @type {string}
     * @readonly
     */
    changeEventName: {
      get: function() {
        if (!Fullscreen.supportsFullscreen()) {
          return void 0;
        }
        return _names.fullscreenchange;
      }
    },
    /**
     * The name of the event that is fired when a fullscreen error
     * occurs.  This event name is intended for use with addEventListener.
     * @memberof Fullscreen
     * @type {string}
     * @readonly
     */
    errorEventName: {
      get: function() {
        if (!Fullscreen.supportsFullscreen()) {
          return void 0;
        }
        return _names.fullscreenerror;
      }
    },
    /**
     * Determine whether the browser will allow an element to be made fullscreen, or not.
     * For example, by default, iframes cannot go fullscreen unless the containing page
     * adds an "allowfullscreen" attribute (or prefixed equivalent).
     * @memberof Fullscreen
     * @type {boolean}
     * @readonly
     */
    enabled: {
      get: function() {
        if (!Fullscreen.supportsFullscreen()) {
          return void 0;
        }
        return document[_names.fullscreenEnabled];
      }
    },
    /**
     * Determines if the browser is currently in fullscreen mode.
     * @memberof Fullscreen
     * @type {boolean}
     * @readonly
     */
    fullscreen: {
      get: function() {
        if (!Fullscreen.supportsFullscreen()) {
          return void 0;
        }
        return Fullscreen.element !== null;
      }
    }
  });
  Fullscreen.supportsFullscreen = function() {
    if (defined_default(_supportsFullscreen)) {
      return _supportsFullscreen;
    }
    _supportsFullscreen = false;
    const body = document.body;
    if (typeof body.requestFullscreen === "function") {
      _names.requestFullscreen = "requestFullscreen";
      _names.exitFullscreen = "exitFullscreen";
      _names.fullscreenEnabled = "fullscreenEnabled";
      _names.fullscreenElement = "fullscreenElement";
      _names.fullscreenchange = "fullscreenchange";
      _names.fullscreenerror = "fullscreenerror";
      _supportsFullscreen = true;
      return _supportsFullscreen;
    }
    const prefixes = ["webkit", "moz", "o", "ms", "khtml"];
    let name;
    for (let i = 0, len = prefixes.length; i < len; ++i) {
      const prefix = prefixes[i];
      name = `${prefix}RequestFullscreen`;
      if (typeof body[name] === "function") {
        _names.requestFullscreen = name;
        _supportsFullscreen = true;
      } else {
        name = `${prefix}RequestFullScreen`;
        if (typeof body[name] === "function") {
          _names.requestFullscreen = name;
          _supportsFullscreen = true;
        }
      }
      name = `${prefix}ExitFullscreen`;
      if (typeof document[name] === "function") {
        _names.exitFullscreen = name;
      } else {
        name = `${prefix}CancelFullScreen`;
        if (typeof document[name] === "function") {
          _names.exitFullscreen = name;
        }
      }
      name = `${prefix}FullscreenEnabled`;
      if (document[name] !== void 0) {
        _names.fullscreenEnabled = name;
      } else {
        name = `${prefix}FullScreenEnabled`;
        if (document[name] !== void 0) {
          _names.fullscreenEnabled = name;
        }
      }
      name = `${prefix}FullscreenElement`;
      if (document[name] !== void 0) {
        _names.fullscreenElement = name;
      } else {
        name = `${prefix}FullScreenElement`;
        if (document[name] !== void 0) {
          _names.fullscreenElement = name;
        }
      }
      name = `${prefix}fullscreenchange`;
      if (document[`on${name}`] !== void 0) {
        if (prefix === "ms") {
          name = "MSFullscreenChange";
        }
        _names.fullscreenchange = name;
      }
      name = `${prefix}fullscreenerror`;
      if (document[`on${name}`] !== void 0) {
        if (prefix === "ms") {
          name = "MSFullscreenError";
        }
        _names.fullscreenerror = name;
      }
    }
    return _supportsFullscreen;
  };
  Fullscreen.requestFullscreen = function(element, vrDevice) {
    if (!Fullscreen.supportsFullscreen()) {
      return;
    }
    element[_names.requestFullscreen]({ vrDisplay: vrDevice });
  };
  Fullscreen.exitFullscreen = function() {
    if (!Fullscreen.supportsFullscreen()) {
      return;
    }
    document[_names.exitFullscreen]();
  };
  Fullscreen._names = _names;
  var Fullscreen_default = Fullscreen;

  // ../../node_modules/@cesium/engine/Source/Core/FeatureDetection.js
  var theNavigator;
  if (typeof navigator !== "undefined") {
    theNavigator = navigator;
  } else {
    theNavigator = {};
  }
  function extractVersion(versionString) {
    const parts = versionString.split(".");
    for (let i = 0, len = parts.length; i < len; ++i) {
      parts[i] = parseInt(parts[i], 10);
    }
    return parts;
  }
  var isChromeResult;
  var chromeVersionResult;
  function isChrome() {
    if (!defined_default(isChromeResult)) {
      isChromeResult = false;
      if (!isEdge()) {
        const fields = / Chrome\/([\.0-9]+)/.exec(theNavigator.userAgent);
        if (fields !== null) {
          isChromeResult = true;
          chromeVersionResult = extractVersion(fields[1]);
        }
      }
    }
    return isChromeResult;
  }
  function chromeVersion() {
    return isChrome() && chromeVersionResult;
  }
  var isSafariResult;
  var safariVersionResult;
  function isSafari() {
    if (!defined_default(isSafariResult)) {
      isSafariResult = false;
      if (!isChrome() && !isEdge() && / Safari\/[\.0-9]+/.test(theNavigator.userAgent)) {
        const fields = / Version\/([\.0-9]+)/.exec(theNavigator.userAgent);
        if (fields !== null) {
          isSafariResult = true;
          safariVersionResult = extractVersion(fields[1]);
        }
      }
    }
    return isSafariResult;
  }
  function safariVersion() {
    return isSafari() && safariVersionResult;
  }
  var isWebkitResult;
  var webkitVersionResult;
  function isWebkit() {
    if (!defined_default(isWebkitResult)) {
      isWebkitResult = false;
      const fields = / AppleWebKit\/([\.0-9]+)(\+?)/.exec(theNavigator.userAgent);
      if (fields !== null) {
        isWebkitResult = true;
        webkitVersionResult = extractVersion(fields[1]);
        webkitVersionResult.isNightly = !!fields[2];
      }
    }
    return isWebkitResult;
  }
  function webkitVersion() {
    return isWebkit() && webkitVersionResult;
  }
  var isEdgeResult;
  var edgeVersionResult;
  function isEdge() {
    if (!defined_default(isEdgeResult)) {
      isEdgeResult = false;
      const fields = / Edg\/([\.0-9]+)/.exec(theNavigator.userAgent);
      if (fields !== null) {
        isEdgeResult = true;
        edgeVersionResult = extractVersion(fields[1]);
      }
    }
    return isEdgeResult;
  }
  function edgeVersion() {
    return isEdge() && edgeVersionResult;
  }
  var isFirefoxResult;
  var firefoxVersionResult;
  function isFirefox() {
    if (!defined_default(isFirefoxResult)) {
      isFirefoxResult = false;
      const fields = /Firefox\/([\.0-9]+)/.exec(theNavigator.userAgent);
      if (fields !== null) {
        isFirefoxResult = true;
        firefoxVersionResult = extractVersion(fields[1]);
      }
    }
    return isFirefoxResult;
  }
  var isWindowsResult;
  function isWindows() {
    if (!defined_default(isWindowsResult)) {
      isWindowsResult = /Windows/i.test(theNavigator.appVersion);
    }
    return isWindowsResult;
  }
  var isIPadOrIOSResult;
  function isIPadOrIOS() {
    if (!defined_default(isIPadOrIOSResult)) {
      isIPadOrIOSResult = navigator.platform === "iPhone" || navigator.platform === "iPod" || navigator.platform === "iPad";
    }
    return isIPadOrIOSResult;
  }
  function firefoxVersion() {
    return isFirefox() && firefoxVersionResult;
  }
  var hasPointerEvents;
  function supportsPointerEvents() {
    if (!defined_default(hasPointerEvents)) {
      hasPointerEvents = !isFirefox() && typeof PointerEvent !== "undefined" && (!defined_default(theNavigator.pointerEnabled) || theNavigator.pointerEnabled);
    }
    return hasPointerEvents;
  }
  var imageRenderingValueResult;
  var supportsImageRenderingPixelatedResult;
  function supportsImageRenderingPixelated() {
    if (!defined_default(supportsImageRenderingPixelatedResult)) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute(
        "style",
        "image-rendering: -moz-crisp-edges;image-rendering: pixelated;"
      );
      const tmp = canvas.style.imageRendering;
      supportsImageRenderingPixelatedResult = defined_default(tmp) && tmp !== "";
      if (supportsImageRenderingPixelatedResult) {
        imageRenderingValueResult = tmp;
      }
    }
    return supportsImageRenderingPixelatedResult;
  }
  function imageRenderingValue() {
    return supportsImageRenderingPixelated() ? imageRenderingValueResult : void 0;
  }
  function supportsWebP() {
    if (!supportsWebP.initialized) {
      throw new DeveloperError_default(
        "You must call FeatureDetection.supportsWebP.initialize and wait for the promise to resolve before calling FeatureDetection.supportsWebP"
      );
    }
    return supportsWebP._result;
  }
  supportsWebP._promise = void 0;
  supportsWebP._result = void 0;
  supportsWebP.initialize = function() {
    if (defined_default(supportsWebP._promise)) {
      return supportsWebP._promise;
    }
    supportsWebP._promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = function() {
        supportsWebP._result = image.width > 0 && image.height > 0;
        resolve(supportsWebP._result);
      };
      image.onerror = function() {
        supportsWebP._result = false;
        resolve(supportsWebP._result);
      };
      image.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
    });
    return supportsWebP._promise;
  };
  Object.defineProperties(supportsWebP, {
    initialized: {
      get: function() {
        return defined_default(supportsWebP._result);
      }
    }
  });
  var typedArrayTypes = [];
  if (typeof ArrayBuffer !== "undefined") {
    typedArrayTypes.push(
      Int8Array,
      Uint8Array,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array
    );
    if (typeof Uint8ClampedArray !== "undefined") {
      typedArrayTypes.push(Uint8ClampedArray);
    }
    if (typeof Uint8ClampedArray !== "undefined") {
      typedArrayTypes.push(Uint8ClampedArray);
    }
    if (typeof BigInt64Array !== "undefined") {
      typedArrayTypes.push(BigInt64Array);
    }
    if (typeof BigUint64Array !== "undefined") {
      typedArrayTypes.push(BigUint64Array);
    }
  }
  var FeatureDetection = {
    isChrome,
    chromeVersion,
    isSafari,
    safariVersion,
    isWebkit,
    webkitVersion,
    isEdge,
    edgeVersion,
    isFirefox,
    firefoxVersion,
    isWindows,
    isIPadOrIOS,
    hardwareConcurrency: theNavigator.hardwareConcurrency ?? 3,
    supportsPointerEvents,
    supportsImageRenderingPixelated,
    supportsWebP,
    imageRenderingValue,
    typedArrayTypes
  };
  FeatureDetection.supportsBasis = function(scene) {
    return FeatureDetection.supportsWebAssembly() && scene.context.supportsBasis;
  };
  FeatureDetection.supportsFullscreen = function() {
    return Fullscreen_default.supportsFullscreen();
  };
  FeatureDetection.supportsTypedArrays = function() {
    return typeof ArrayBuffer !== "undefined";
  };
  FeatureDetection.supportsBigInt64Array = function() {
    return typeof BigInt64Array !== "undefined";
  };
  FeatureDetection.supportsBigUint64Array = function() {
    return typeof BigUint64Array !== "undefined";
  };
  FeatureDetection.supportsBigInt = function() {
    return typeof BigInt !== "undefined";
  };
  FeatureDetection.supportsWebWorkers = function() {
    return typeof Worker !== "undefined";
  };
  FeatureDetection.supportsWebAssembly = function() {
    return typeof WebAssembly !== "undefined";
  };
  FeatureDetection.supportsWebgl2 = function(scene) {
    Check_default.defined("scene", scene);
    return scene.context.webgl2;
  };
  FeatureDetection.supportsEsmWebWorkers = function() {
    return !isFirefox() || parseInt(firefoxVersionResult) >= 114;
  };
  var FeatureDetection_default = FeatureDetection;

  // ../../node_modules/@cesium/engine/Source/Core/Color.js
  function hue2rgb(m1, m2, h) {
    if (h < 0) {
      h += 1;
    }
    if (h > 1) {
      h -= 1;
    }
    if (h * 6 < 1) {
      return m1 + (m2 - m1) * 6 * h;
    }
    if (h * 2 < 1) {
      return m2;
    }
    if (h * 3 < 2) {
      return m1 + (m2 - m1) * (2 / 3 - h) * 6;
    }
    return m1;
  }
  var Color = class _Color {
    /**
     * @param {number} [red=1.0] The red component.
     * @param {number} [green=1.0] The green component.
     * @param {number} [blue=1.0] The blue component.
     * @param {number} [alpha=1.0] The alpha component.
     */
    constructor(red, green, blue, alpha) {
      this.red = red ?? 1;
      this.green = green ?? 1;
      this.blue = blue ?? 1;
      this.alpha = alpha ?? 1;
    }
    /**
     * Creates a Color instance from a {@link Cartesian4}. <code>x</code>, <code>y</code>, <code>z</code>,
     * and <code>w</code> map to <code>red</code>, <code>green</code>, <code>blue</code>, and <code>alpha</code>, respectively.
     *
     * @param {Cartesian4} cartesian The source cartesian.
     * @param {Color} [result] The object onto which to store the result.
     * @returns {Color} The modified result parameter or a new Color instance if one was not provided.
     */
    static fromCartesian4(cartesian, result) {
      Check_default.typeOf.object("cartesian", cartesian);
      if (!defined_default(result)) {
        return new _Color(cartesian.x, cartesian.y, cartesian.z, cartesian.w);
      }
      result.red = cartesian.x;
      result.green = cartesian.y;
      result.blue = cartesian.z;
      result.alpha = cartesian.w;
      return result;
    }
    /**
     * Creates a new Color specified using red, green, blue, and alpha values
     * that are in the range of 0 to 255, converting them internally to a range of 0.0 to 1.0.
     *
     * @param {number} [red=255] The red component.
     * @param {number} [green=255] The green component.
     * @param {number} [blue=255] The blue component.
     * @param {number} [alpha=255] The alpha component.
     * @param {Color} [result] The object onto which to store the result.
     * @returns {Color} The modified result parameter or a new Color instance if one was not provided.
     */
    static fromBytes(red, green, blue, alpha, result) {
      red = _Color.byteToFloat(red ?? 255);
      green = _Color.byteToFloat(green ?? 255);
      blue = _Color.byteToFloat(blue ?? 255);
      alpha = _Color.byteToFloat(alpha ?? 255);
      if (!defined_default(result)) {
        return new _Color(red, green, blue, alpha);
      }
      result.red = red;
      result.green = green;
      result.blue = blue;
      result.alpha = alpha;
      return result;
    }
    /**
     * Creates a new Color that has the same red, green, and blue components
     * of the specified color, but with the specified alpha value.
     *
     * @param {Color} color The base color
     * @param {number} alpha The new alpha component.
     * @param {Color} [result] The object onto which to store the result.
     * @returns {Color} The modified result parameter or a new Color instance if one was not provided.
     *
     * @example const translucentRed = Cesium.Color.fromAlpha(Cesium.Color.RED, 0.9);
     */
    static fromAlpha(color, alpha, result) {
      Check_default.typeOf.object("color", color);
      Check_default.typeOf.number("alpha", alpha);
      if (!defined_default(result)) {
        return new _Color(color.red, color.green, color.blue, alpha);
      }
      result.red = color.red;
      result.green = color.green;
      result.blue = color.blue;
      result.alpha = alpha;
      return result;
    }
    /**
     * Creates a new Color from a single numeric unsigned 32-bit RGBA value, using the endianness
     * of the system.
     *
     * @param {number} rgba A single numeric unsigned 32-bit RGBA value.
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The color object.
     *
     * @example
     * const color = Cesium.Color.fromRgba(0x67ADDFFF);
     *
     * @see Color#toRgba
     */
    static fromRgba(rgba, result) {
      scratchUint32Array[0] = rgba;
      return _Color.fromBytes(
        scratchUint8Array[0],
        scratchUint8Array[1],
        scratchUint8Array[2],
        scratchUint8Array[3],
        result
      );
    }
    /**
     * Creates a Color instance from hue, saturation, and lightness.
     *
     * @param {number} [hue=0] The hue angle 0...1
     * @param {number} [saturation=0] The saturation value 0...1
     * @param {number} [lightness=0] The lightness value 0...1
     * @param {number} [alpha=1.0] The alpha component 0...1
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The color object.
     *
     * @see {@link http://www.w3.org/TR/css3-color/#hsl-color|CSS color values}
     */
    static fromHsl(hue, saturation, lightness, alpha, result) {
      hue = (hue ?? 0) % 1;
      saturation = saturation ?? 0;
      lightness = lightness ?? 0;
      alpha = alpha ?? 1;
      let red = lightness;
      let green = lightness;
      let blue = lightness;
      if (saturation !== 0) {
        let m2;
        if (lightness < 0.5) {
          m2 = lightness * (1 + saturation);
        } else {
          m2 = lightness + saturation - lightness * saturation;
        }
        const m1 = 2 * lightness - m2;
        red = hue2rgb(m1, m2, hue + 1 / 3);
        green = hue2rgb(m1, m2, hue);
        blue = hue2rgb(m1, m2, hue - 1 / 3);
      }
      if (!defined_default(result)) {
        return new _Color(red, green, blue, alpha);
      }
      result.red = red;
      result.green = green;
      result.blue = blue;
      result.alpha = alpha;
      return result;
    }
    /**
     * Creates a random color using the provided options. For reproducible random colors, you should
     * call {@link CesiumMath#setRandomNumberSeed} once at the beginning of your application.
     *
     * @param {object} [options] Object with the following properties:
     * @param {number} [options.red] If specified, the red component to use instead of a randomized value.
     * @param {number} [options.minimumRed=0.0] The maximum red value to generate if none was specified.
     * @param {number} [options.maximumRed=1.0] The minimum red value to generate if none was specified.
     * @param {number} [options.green] If specified, the green component to use instead of a randomized value.
     * @param {number} [options.minimumGreen=0.0] The maximum green value to generate if none was specified.
     * @param {number} [options.maximumGreen=1.0] The minimum green value to generate if none was specified.
     * @param {number} [options.blue] If specified, the blue component to use instead of a randomized value.
     * @param {number} [options.minimumBlue=0.0] The maximum blue value to generate if none was specified.
     * @param {number} [options.maximumBlue=1.0] The minimum blue value to generate if none was specified.
     * @param {number} [options.alpha] If specified, the alpha component to use instead of a randomized value.
     * @param {number} [options.minimumAlpha=0.0] The maximum alpha value to generate if none was specified.
     * @param {number} [options.maximumAlpha=1.0] The minimum alpha value to generate if none was specified.
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The modified result parameter or a new instance if result was undefined.
     *
     * @exception {DeveloperError} minimumRed must be less than or equal to maximumRed.
     * @exception {DeveloperError} minimumGreen must be less than or equal to maximumGreen.
     * @exception {DeveloperError} minimumBlue must be less than or equal to maximumBlue.
     * @exception {DeveloperError} minimumAlpha must be less than or equal to maximumAlpha.
     *
     * @example
     * //Create a completely random color
     * const color = Cesium.Color.fromRandom();
     *
     * //Create a random shade of yellow.
     * const color1 = Cesium.Color.fromRandom({
     *     red : 1.0,
     *     green : 1.0,
     *     alpha : 1.0
     * });
     *
     * //Create a random bright color.
     * const color2 = Cesium.Color.fromRandom({
     *     minimumRed : 0.75,
     *     minimumGreen : 0.75,
     *     minimumBlue : 0.75,
     *     alpha : 1.0
     * });
     */
    static fromRandom(options, result) {
      options = options ?? Frozen_default.EMPTY_OBJECT;
      let red = options.red;
      if (!defined_default(red)) {
        const minimumRed = options.minimumRed ?? 0;
        const maximumRed = options.maximumRed ?? 1;
        Check_default.typeOf.number.lessThanOrEquals(
          "minimumRed",
          minimumRed,
          maximumRed
        );
        red = minimumRed + Math_default.nextRandomNumber() * (maximumRed - minimumRed);
      }
      let green = options.green;
      if (!defined_default(green)) {
        const minimumGreen = options.minimumGreen ?? 0;
        const maximumGreen = options.maximumGreen ?? 1;
        Check_default.typeOf.number.lessThanOrEquals(
          "minimumGreen",
          minimumGreen,
          maximumGreen
        );
        green = minimumGreen + Math_default.nextRandomNumber() * (maximumGreen - minimumGreen);
      }
      let blue = options.blue;
      if (!defined_default(blue)) {
        const minimumBlue = options.minimumBlue ?? 0;
        const maximumBlue = options.maximumBlue ?? 1;
        Check_default.typeOf.number.lessThanOrEquals(
          "minimumBlue",
          minimumBlue,
          maximumBlue
        );
        blue = minimumBlue + Math_default.nextRandomNumber() * (maximumBlue - minimumBlue);
      }
      let alpha = options.alpha;
      if (!defined_default(alpha)) {
        const minimumAlpha = options.minimumAlpha ?? 0;
        const maximumAlpha = options.maximumAlpha ?? 1;
        Check_default.typeOf.number.lessThanOrEquals(
          "minimumAlpha",
          minimumAlpha,
          maximumAlpha
        );
        alpha = minimumAlpha + Math_default.nextRandomNumber() * (maximumAlpha - minimumAlpha);
      }
      if (!defined_default(result)) {
        return new _Color(red, green, blue, alpha);
      }
      result.red = red;
      result.green = green;
      result.blue = blue;
      result.alpha = alpha;
      return result;
    }
    /**
     * Creates a Color instance from a CSS color value.
     *
     * @param {string} color The CSS color value in #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), or hsla() format.
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The color object, or undefined if the string was not a valid CSS color.
     *
     *
     * @example
     * const cesiumBlue = Cesium.Color.fromCssColorString('#67ADDF');
     * const green = Cesium.Color.fromCssColorString('green');
     *
     * @see {@link http://www.w3.org/TR/css3-color|CSS color values}
     */
    static fromCssColorString(color, result) {
      Check_default.typeOf.string("color", color);
      if (!defined_default(result)) {
        result = new _Color();
      }
      color = color.trim();
      const namedColor = _Color[color.toUpperCase()];
      if (defined_default(namedColor)) {
        _Color.clone(namedColor, result);
        return result;
      }
      let matches = rgbaMatcher.exec(color);
      if (matches !== null) {
        result.red = parseInt(matches[1], 16) / 15;
        result.green = parseInt(matches[2], 16) / 15;
        result.blue = parseInt(matches[3], 16) / 15;
        result.alpha = parseInt(matches[4] ?? "f", 16) / 15;
        return result;
      }
      matches = rrggbbaaMatcher.exec(color);
      if (matches !== null) {
        result.red = parseInt(matches[1], 16) / 255;
        result.green = parseInt(matches[2], 16) / 255;
        result.blue = parseInt(matches[3], 16) / 255;
        result.alpha = parseInt(matches[4] ?? "ff", 16) / 255;
        return result;
      }
      matches = rgbParenthesesMatcher.exec(color);
      if (matches !== null) {
        result.red = parseFloat(matches[1]) / ("%" === matches[1].substr(-1) ? 100 : 255);
        result.green = parseFloat(matches[2]) / ("%" === matches[2].substr(-1) ? 100 : 255);
        result.blue = parseFloat(matches[3]) / ("%" === matches[3].substr(-1) ? 100 : 255);
        result.alpha = parseFloat(matches[4] ?? "1.0");
        return result;
      }
      matches = hslParenthesesMatcher.exec(color);
      if (matches !== null) {
        return _Color.fromHsl(
          parseFloat(matches[1]) / 360,
          parseFloat(matches[2]) / 100,
          parseFloat(matches[3]) / 100,
          parseFloat(matches[4] ?? "1.0"),
          result
        );
      }
      result = void 0;
      return result;
    }
    /**
     * Stores the provided instance into the provided array.
     *
     * @param {Color} value The value to pack.
     * @param {number[]|TypedArray} array The array to pack into.
     * @param {number} [startingIndex=0] The index into the array at which to start packing the elements.
     *
     * @returns {number[]|TypedArray} The array that was packed into
     */
    static pack(value, array, startingIndex) {
      Check_default.typeOf.object("value", value);
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      array[startingIndex++] = value.red;
      array[startingIndex++] = value.green;
      array[startingIndex++] = value.blue;
      array[startingIndex] = value.alpha;
      return array;
    }
    /**
     * Retrieves an instance from a packed array.
     *
     * @param {number[]|TypedArray} array The packed array.
     * @param {number} [startingIndex=0] The starting index of the element to be unpacked.
     * @param {Color} [result] The object into which to store the result.
     * @returns {Color} The modified result parameter or a new Color instance if one was not provided.
     */
    static unpack(array, startingIndex, result) {
      Check_default.defined("array", array);
      startingIndex = startingIndex ?? 0;
      if (!defined_default(result)) {
        result = new _Color();
      }
      result.red = array[startingIndex++];
      result.green = array[startingIndex++];
      result.blue = array[startingIndex++];
      result.alpha = array[startingIndex];
      return result;
    }
    /**
     * Converts a 'byte' color component in the range of 0 to 255 into
     * a 'float' color component in the range of 0 to 1.0.
     *
     * @param {number} number The number to be converted.
     * @returns {number} The converted number.
     */
    static byteToFloat(number) {
      return number / 255;
    }
    /**
     * Converts a 'float' color component in the range of 0 to 1.0 into
     * a 'byte' color component in the range of 0 to 255.
     *
     * @param {number} number The number to be converted.
     * @returns {number} The converted number.
     */
    static floatToByte(number) {
      return number === 1 ? 255 : number * 256 | 0;
    }
    /**
     * Duplicates a Color.
     *
     * @param {Color} color The Color to duplicate.
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The modified result parameter or a new instance if result was undefined. (Returns undefined if color is undefined)
     */
    static clone(color, result) {
      if (!defined_default(color)) {
        return void 0;
      }
      if (!defined_default(result)) {
        return new _Color(color.red, color.green, color.blue, color.alpha);
      }
      result.red = color.red;
      result.green = color.green;
      result.blue = color.blue;
      result.alpha = color.alpha;
      return result;
    }
    /**
     * Returns true if the first Color equals the second color.
     *
     * @param {Color} [left] The first Color to compare for equality.
     * @param {Color} [right] The second Color to compare for equality.
     * @returns {boolean} <code>true</code> if the Colors are equal; otherwise, <code>false</code>.
     */
    static equals(left, right) {
      return left === right || //
      defined_default(left) && //
      defined_default(right) && //
      left.red === right.red && //
      left.green === right.green && //
      left.blue === right.blue && //
      left.alpha === right.alpha;
    }
    /**
     * @private
     */
    static equalsArray(color, array, offset) {
      return color.red === array[offset] && color.green === array[offset + 1] && color.blue === array[offset + 2] && color.alpha === array[offset + 3];
    }
    /**
     * Returns a duplicate of a Color instance.
     *
     * @param {Color} [result] The object to store the result in, if undefined a new instance will be created.
     * @returns {Color} The modified result parameter or a new instance if result was undefined.
     */
    clone(result) {
      return _Color.clone(this, result);
    }
    /**
     * Returns true if this Color equals other.
     *
     * @param {Color} [other] The Color to compare for equality.
     * @returns {boolean} <code>true</code> if the Colors are equal; otherwise, <code>false</code>.
     */
    equals(other) {
      return _Color.equals(this, other);
    }
    /**
     * Returns <code>true</code> if this Color equals other componentwise within the specified epsilon.
     *
     * @param {Color} other The Color to compare for equality.
     * @param {number} [epsilon=0.0] The epsilon to use for equality testing.
     * @returns {boolean} <code>true</code> if the Colors are equal within the specified epsilon; otherwise, <code>false</code>.
     */
    equalsEpsilon(other, epsilon) {
      return this === other || //
      defined_default(other) && //
      Math.abs(this.red - other.red) <= epsilon && //
      Math.abs(this.green - other.green) <= epsilon && //
      Math.abs(this.blue - other.blue) <= epsilon && //
      Math.abs(this.alpha - other.alpha) <= epsilon;
    }
    /**
     * Creates a string representing this Color in the format '(red, green, blue, alpha)'.
     *
     * @returns {string} A string representing this Color in the format '(red, green, blue, alpha)'.
     */
    toString() {
      return `(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
    }
    /**
     * Creates a string containing the CSS color value for this color.
     *
     * @returns {string} The CSS equivalent of this color.
     *
     * @see {@link http://www.w3.org/TR/css3-color/#rgba-color|CSS RGB or RGBA color values}
     */
    toCssColorString() {
      const red = _Color.floatToByte(this.red);
      const green = _Color.floatToByte(this.green);
      const blue = _Color.floatToByte(this.blue);
      if (this.alpha === 1) {
        return `rgb(${red},${green},${blue})`;
      }
      return `rgba(${red},${green},${blue},${this.alpha})`;
    }
    /**
     * Creates a string containing CSS hex string color value for this color.
     *
     * @returns {string} The CSS hex string equivalent of this color.
     */
    toCssHexString() {
      let r = _Color.floatToByte(this.red).toString(16);
      if (r.length < 2) {
        r = `0${r}`;
      }
      let g = _Color.floatToByte(this.green).toString(16);
      if (g.length < 2) {
        g = `0${g}`;
      }
      let b = _Color.floatToByte(this.blue).toString(16);
      if (b.length < 2) {
        b = `0${b}`;
      }
      if (this.alpha < 1) {
        let hexAlpha = _Color.floatToByte(this.alpha).toString(16);
        if (hexAlpha.length < 2) {
          hexAlpha = `0${hexAlpha}`;
        }
        return `#${r}${g}${b}${hexAlpha}`;
      }
      return `#${r}${g}${b}`;
    }
    /**
     * Converts this color to an array of red, green, blue, and alpha values
     * that are in the range of 0 to 255.
     *
     * @param {number[]} [result] The array to store the result in, if undefined a new instance will be created.
     * @returns {number[]} The modified result parameter or a new instance if result was undefined.
     */
    toBytes(result) {
      const red = _Color.floatToByte(this.red);
      const green = _Color.floatToByte(this.green);
      const blue = _Color.floatToByte(this.blue);
      const alpha = _Color.floatToByte(this.alpha);
      if (!defined_default(result)) {
        return [red, green, blue, alpha];
      }
      result[0] = red;
      result[1] = green;
      result[2] = blue;
      result[3] = alpha;
      return result;
    }
    /**
     * Converts RGBA values in bytes to a single numeric unsigned 32-bit RGBA value, using the endianness
     * of the system.
     *
     * @returns {number} A single numeric unsigned 32-bit RGBA value.
     *
     * @see Color.toRgba
     */
    static bytesToRgba(red, green, blue, alpha) {
      scratchUint8Array[0] = red;
      scratchUint8Array[1] = green;
      scratchUint8Array[2] = blue;
      scratchUint8Array[3] = alpha;
      return scratchUint32Array[0];
    }
    /**
     * Converts this color to a single numeric unsigned 32-bit RGBA value, using the endianness
     * of the system.
     *
     * @returns {number} A single numeric unsigned 32-bit RGBA value.
     *
     *
     * @example
     * const rgba = Cesium.Color.BLUE.toRgba();
     *
     * @see Color.fromRgba
     */
    toRgba() {
      return _Color.bytesToRgba(
        _Color.floatToByte(this.red),
        _Color.floatToByte(this.green),
        _Color.floatToByte(this.blue),
        _Color.floatToByte(this.alpha)
      );
    }
    /**
     * Brightens this color by the provided magnitude.
     *
     * @param {number} magnitude A positive number indicating the amount to brighten.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     *
     * @example
     * const brightBlue = Cesium.Color.BLUE.brighten(0.5, new Cesium.Color());
     */
    brighten(magnitude, result) {
      Check_default.typeOf.number("magnitude", magnitude);
      Check_default.typeOf.number.greaterThanOrEquals("magnitude", magnitude, 0);
      Check_default.typeOf.object("result", result);
      magnitude = 1 - magnitude;
      result.red = 1 - (1 - this.red) * magnitude;
      result.green = 1 - (1 - this.green) * magnitude;
      result.blue = 1 - (1 - this.blue) * magnitude;
      result.alpha = this.alpha;
      return result;
    }
    /**
     * Darkens this color by the provided magnitude.
     *
     * @param {number} magnitude A positive number indicating the amount to darken.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     *
     * @example
     * const darkBlue = Cesium.Color.BLUE.darken(0.5, new Cesium.Color());
     */
    darken(magnitude, result) {
      Check_default.typeOf.number("magnitude", magnitude);
      Check_default.typeOf.number.greaterThanOrEquals("magnitude", magnitude, 0);
      Check_default.typeOf.object("result", result);
      magnitude = 1 - magnitude;
      result.red = this.red * magnitude;
      result.green = this.green * magnitude;
      result.blue = this.blue * magnitude;
      result.alpha = this.alpha;
      return result;
    }
    /**
     * Creates a new Color that has the same red, green, and blue components
     * as this Color, but with the specified alpha value.
     *
     * @param {number} alpha The new alpha component.
     * @param {Color} [result] The object onto which to store the result.
     * @returns {Color} The modified result parameter or a new Color instance if one was not provided.
     *
     * @example const translucentRed = Cesium.Color.RED.withAlpha(0.9);
     */
    withAlpha(alpha, result) {
      return _Color.fromAlpha(this, alpha, result);
    }
    /**
     * Computes the componentwise sum of two Colors.
     *
     * @param {Color} left The first Color.
     * @param {Color} right The second Color.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static add(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.red = left.red + right.red;
      result.green = left.green + right.green;
      result.blue = left.blue + right.blue;
      result.alpha = left.alpha + right.alpha;
      return result;
    }
    /**
     * Computes the componentwise difference of two Colors.
     *
     * @param {Color} left The first Color.
     * @param {Color} right The second Color.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static subtract(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.red = left.red - right.red;
      result.green = left.green - right.green;
      result.blue = left.blue - right.blue;
      result.alpha = left.alpha - right.alpha;
      return result;
    }
    /**
     * Computes the componentwise product of two Colors.
     *
     * @param {Color} left The first Color.
     * @param {Color} right The second Color.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static multiply(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.red = left.red * right.red;
      result.green = left.green * right.green;
      result.blue = left.blue * right.blue;
      result.alpha = left.alpha * right.alpha;
      return result;
    }
    /**
     * Computes the componentwise quotient of two Colors.
     *
     * @param {Color} left The first Color.
     * @param {Color} right The second Color.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static divide(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.red = left.red / right.red;
      result.green = left.green / right.green;
      result.blue = left.blue / right.blue;
      result.alpha = left.alpha / right.alpha;
      return result;
    }
    /**
     * Computes the componentwise modulus of two Colors.
     *
     * @param {Color} left The first Color.
     * @param {Color} right The second Color.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static mod(left, right, result) {
      Check_default.typeOf.object("left", left);
      Check_default.typeOf.object("right", right);
      Check_default.typeOf.object("result", result);
      result.red = left.red % right.red;
      result.green = left.green % right.green;
      result.blue = left.blue % right.blue;
      result.alpha = left.alpha % right.alpha;
      return result;
    }
    /**
     * Computes the linear interpolation or extrapolation at t between the provided colors.
     *
     * @param {Color} start The color corresponding to t at 0.0.
     * @param {Color} end The color corresponding to t at 1.0.
     * @param {number} t The point along t at which to interpolate.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static lerp(start, end, t, result) {
      Check_default.typeOf.object("start", start);
      Check_default.typeOf.object("end", end);
      Check_default.typeOf.number("t", t);
      Check_default.typeOf.object("result", result);
      result.red = Math_default.lerp(start.red, end.red, t);
      result.green = Math_default.lerp(start.green, end.green, t);
      result.blue = Math_default.lerp(start.blue, end.blue, t);
      result.alpha = Math_default.lerp(start.alpha, end.alpha, t);
      return result;
    }
    /**
     * Multiplies the provided Color componentwise by the provided scalar.
     *
     * @param {Color} color The Color to be scaled.
     * @param {number} scalar The scalar to multiply with.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static multiplyByScalar(color, scalar, result) {
      Check_default.typeOf.object("color", color);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.red = color.red * scalar;
      result.green = color.green * scalar;
      result.blue = color.blue * scalar;
      result.alpha = color.alpha * scalar;
      return result;
    }
    /**
     * Divides the provided Color componentwise by the provided scalar.
     *
     * @param {Color} color The Color to be divided.
     * @param {number} scalar The scalar to divide with.
     * @param {Color} result The object onto which to store the result.
     * @returns {Color} The modified result parameter.
     */
    static divideByScalar(color, scalar, result) {
      Check_default.typeOf.object("color", color);
      Check_default.typeOf.number("scalar", scalar);
      Check_default.typeOf.object("result", result);
      result.red = color.red / scalar;
      result.green = color.green / scalar;
      result.blue = color.blue / scalar;
      result.alpha = color.alpha / scalar;
      return result;
    }
  };
  var scratchArrayBuffer;
  var scratchUint32Array;
  var scratchUint8Array;
  if (FeatureDetection_default.supportsTypedArrays()) {
    scratchArrayBuffer = new ArrayBuffer(4);
    scratchUint32Array = new Uint32Array(scratchArrayBuffer);
    scratchUint8Array = new Uint8Array(scratchArrayBuffer);
  }
  var rgbaMatcher = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
  var rrggbbaaMatcher = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
  var rgbParenthesesMatcher = /^rgba?\s*\(\s*([0-9.]+%?)\s*[,\s]+\s*([0-9.]+%?)\s*[,\s]+\s*([0-9.]+%?)(?:\s*[,\s/]+\s*([0-9.]+))?\s*\)$/i;
  var hslParenthesesMatcher = /^hsla?\s*\(\s*([0-9.]+)\s*[,\s]+\s*([0-9.]+%)\s*[,\s]+\s*([0-9.]+%)(?:\s*[,\s/]+\s*([0-9.]+))?\s*\)$/i;
  Color.packedLength = 4;
  Color.ALICEBLUE = Object.freeze(Color.fromCssColorString("#F0F8FF"));
  Color.ANTIQUEWHITE = Object.freeze(Color.fromCssColorString("#FAEBD7"));
  Color.AQUA = Object.freeze(Color.fromCssColorString("#00FFFF"));
  Color.AQUAMARINE = Object.freeze(Color.fromCssColorString("#7FFFD4"));
  Color.AZURE = Object.freeze(Color.fromCssColorString("#F0FFFF"));
  Color.BEIGE = Object.freeze(Color.fromCssColorString("#F5F5DC"));
  Color.BISQUE = Object.freeze(Color.fromCssColorString("#FFE4C4"));
  Color.BLACK = Object.freeze(Color.fromCssColorString("#000000"));
  Color.BLANCHEDALMOND = Object.freeze(Color.fromCssColorString("#FFEBCD"));
  Color.BLUE = Object.freeze(Color.fromCssColorString("#0000FF"));
  Color.BLUEVIOLET = Object.freeze(Color.fromCssColorString("#8A2BE2"));
  Color.BROWN = Object.freeze(Color.fromCssColorString("#A52A2A"));
  Color.BURLYWOOD = Object.freeze(Color.fromCssColorString("#DEB887"));
  Color.CADETBLUE = Object.freeze(Color.fromCssColorString("#5F9EA0"));
  Color.CHARTREUSE = Object.freeze(Color.fromCssColorString("#7FFF00"));
  Color.CHOCOLATE = Object.freeze(Color.fromCssColorString("#D2691E"));
  Color.CORAL = Object.freeze(Color.fromCssColorString("#FF7F50"));
  Color.CORNFLOWERBLUE = Object.freeze(Color.fromCssColorString("#6495ED"));
  Color.CORNSILK = Object.freeze(Color.fromCssColorString("#FFF8DC"));
  Color.CRIMSON = Object.freeze(Color.fromCssColorString("#DC143C"));
  Color.CYAN = Object.freeze(Color.fromCssColorString("#00FFFF"));
  Color.DARKBLUE = Object.freeze(Color.fromCssColorString("#00008B"));
  Color.DARKCYAN = Object.freeze(Color.fromCssColorString("#008B8B"));
  Color.DARKGOLDENROD = Object.freeze(Color.fromCssColorString("#B8860B"));
  Color.DARKGRAY = Object.freeze(Color.fromCssColorString("#A9A9A9"));
  Color.DARKGREEN = Object.freeze(Color.fromCssColorString("#006400"));
  Color.DARKGREY = Color.DARKGRAY;
  Color.DARKKHAKI = Object.freeze(Color.fromCssColorString("#BDB76B"));
  Color.DARKMAGENTA = Object.freeze(Color.fromCssColorString("#8B008B"));
  Color.DARKOLIVEGREEN = Object.freeze(Color.fromCssColorString("#556B2F"));
  Color.DARKORANGE = Object.freeze(Color.fromCssColorString("#FF8C00"));
  Color.DARKORCHID = Object.freeze(Color.fromCssColorString("#9932CC"));
  Color.DARKRED = Object.freeze(Color.fromCssColorString("#8B0000"));
  Color.DARKSALMON = Object.freeze(Color.fromCssColorString("#E9967A"));
  Color.DARKSEAGREEN = Object.freeze(Color.fromCssColorString("#8FBC8F"));
  Color.DARKSLATEBLUE = Object.freeze(Color.fromCssColorString("#483D8B"));
  Color.DARKSLATEGRAY = Object.freeze(Color.fromCssColorString("#2F4F4F"));
  Color.DARKSLATEGREY = Color.DARKSLATEGRAY;
  Color.DARKTURQUOISE = Object.freeze(Color.fromCssColorString("#00CED1"));
  Color.DARKVIOLET = Object.freeze(Color.fromCssColorString("#9400D3"));
  Color.DEEPPINK = Object.freeze(Color.fromCssColorString("#FF1493"));
  Color.DEEPSKYBLUE = Object.freeze(Color.fromCssColorString("#00BFFF"));
  Color.DIMGRAY = Object.freeze(Color.fromCssColorString("#696969"));
  Color.DIMGREY = Color.DIMGRAY;
  Color.DODGERBLUE = Object.freeze(Color.fromCssColorString("#1E90FF"));
  Color.FIREBRICK = Object.freeze(Color.fromCssColorString("#B22222"));
  Color.FLORALWHITE = Object.freeze(Color.fromCssColorString("#FFFAF0"));
  Color.FORESTGREEN = Object.freeze(Color.fromCssColorString("#228B22"));
  Color.FUCHSIA = Object.freeze(Color.fromCssColorString("#FF00FF"));
  Color.GAINSBORO = Object.freeze(Color.fromCssColorString("#DCDCDC"));
  Color.GHOSTWHITE = Object.freeze(Color.fromCssColorString("#F8F8FF"));
  Color.GOLD = Object.freeze(Color.fromCssColorString("#FFD700"));
  Color.GOLDENROD = Object.freeze(Color.fromCssColorString("#DAA520"));
  Color.GRAY = Object.freeze(Color.fromCssColorString("#808080"));
  Color.GREEN = Object.freeze(Color.fromCssColorString("#008000"));
  Color.GREENYELLOW = Object.freeze(Color.fromCssColorString("#ADFF2F"));
  Color.GREY = Color.GRAY;
  Color.HONEYDEW = Object.freeze(Color.fromCssColorString("#F0FFF0"));
  Color.HOTPINK = Object.freeze(Color.fromCssColorString("#FF69B4"));
  Color.INDIANRED = Object.freeze(Color.fromCssColorString("#CD5C5C"));
  Color.INDIGO = Object.freeze(Color.fromCssColorString("#4B0082"));
  Color.IVORY = Object.freeze(Color.fromCssColorString("#FFFFF0"));
  Color.KHAKI = Object.freeze(Color.fromCssColorString("#F0E68C"));
  Color.LAVENDER = Object.freeze(Color.fromCssColorString("#E6E6FA"));
  Color.LAVENDAR_BLUSH = Object.freeze(Color.fromCssColorString("#FFF0F5"));
  Color.LAWNGREEN = Object.freeze(Color.fromCssColorString("#7CFC00"));
  Color.LEMONCHIFFON = Object.freeze(Color.fromCssColorString("#FFFACD"));
  Color.LIGHTBLUE = Object.freeze(Color.fromCssColorString("#ADD8E6"));
  Color.LIGHTCORAL = Object.freeze(Color.fromCssColorString("#F08080"));
  Color.LIGHTCYAN = Object.freeze(Color.fromCssColorString("#E0FFFF"));
  Color.LIGHTGOLDENRODYELLOW = Object.freeze(Color.fromCssColorString("#FAFAD2"));
  Color.LIGHTGRAY = Object.freeze(Color.fromCssColorString("#D3D3D3"));
  Color.LIGHTGREEN = Object.freeze(Color.fromCssColorString("#90EE90"));
  Color.LIGHTGREY = Color.LIGHTGRAY;
  Color.LIGHTPINK = Object.freeze(Color.fromCssColorString("#FFB6C1"));
  Color.LIGHTSEAGREEN = Object.freeze(Color.fromCssColorString("#20B2AA"));
  Color.LIGHTSKYBLUE = Object.freeze(Color.fromCssColorString("#87CEFA"));
  Color.LIGHTSLATEGRAY = Object.freeze(Color.fromCssColorString("#778899"));
  Color.LIGHTSLATEGREY = Color.LIGHTSLATEGRAY;
  Color.LIGHTSTEELBLUE = Object.freeze(Color.fromCssColorString("#B0C4DE"));
  Color.LIGHTYELLOW = Object.freeze(Color.fromCssColorString("#FFFFE0"));
  Color.LIME = Object.freeze(Color.fromCssColorString("#00FF00"));
  Color.LIMEGREEN = Object.freeze(Color.fromCssColorString("#32CD32"));
  Color.LINEN = Object.freeze(Color.fromCssColorString("#FAF0E6"));
  Color.MAGENTA = Object.freeze(Color.fromCssColorString("#FF00FF"));
  Color.MAROON = Object.freeze(Color.fromCssColorString("#800000"));
  Color.MEDIUMAQUAMARINE = Object.freeze(Color.fromCssColorString("#66CDAA"));
  Color.MEDIUMBLUE = Object.freeze(Color.fromCssColorString("#0000CD"));
  Color.MEDIUMORCHID = Object.freeze(Color.fromCssColorString("#BA55D3"));
  Color.MEDIUMPURPLE = Object.freeze(Color.fromCssColorString("#9370DB"));
  Color.MEDIUMSEAGREEN = Object.freeze(Color.fromCssColorString("#3CB371"));
  Color.MEDIUMSLATEBLUE = Object.freeze(Color.fromCssColorString("#7B68EE"));
  Color.MEDIUMSPRINGGREEN = Object.freeze(Color.fromCssColorString("#00FA9A"));
  Color.MEDIUMTURQUOISE = Object.freeze(Color.fromCssColorString("#48D1CC"));
  Color.MEDIUMVIOLETRED = Object.freeze(Color.fromCssColorString("#C71585"));
  Color.MIDNIGHTBLUE = Object.freeze(Color.fromCssColorString("#191970"));
  Color.MINTCREAM = Object.freeze(Color.fromCssColorString("#F5FFFA"));
  Color.MISTYROSE = Object.freeze(Color.fromCssColorString("#FFE4E1"));
  Color.MOCCASIN = Object.freeze(Color.fromCssColorString("#FFE4B5"));
  Color.NAVAJOWHITE = Object.freeze(Color.fromCssColorString("#FFDEAD"));
  Color.NAVY = Object.freeze(Color.fromCssColorString("#000080"));
  Color.OLDLACE = Object.freeze(Color.fromCssColorString("#FDF5E6"));
  Color.OLIVE = Object.freeze(Color.fromCssColorString("#808000"));
  Color.OLIVEDRAB = Object.freeze(Color.fromCssColorString("#6B8E23"));
  Color.ORANGE = Object.freeze(Color.fromCssColorString("#FFA500"));
  Color.ORANGERED = Object.freeze(Color.fromCssColorString("#FF4500"));
  Color.ORCHID = Object.freeze(Color.fromCssColorString("#DA70D6"));
  Color.PALEGOLDENROD = Object.freeze(Color.fromCssColorString("#EEE8AA"));
  Color.PALEGREEN = Object.freeze(Color.fromCssColorString("#98FB98"));
  Color.PALETURQUOISE = Object.freeze(Color.fromCssColorString("#AFEEEE"));
  Color.PALEVIOLETRED = Object.freeze(Color.fromCssColorString("#DB7093"));
  Color.PAPAYAWHIP = Object.freeze(Color.fromCssColorString("#FFEFD5"));
  Color.PEACHPUFF = Object.freeze(Color.fromCssColorString("#FFDAB9"));
  Color.PERU = Object.freeze(Color.fromCssColorString("#CD853F"));
  Color.PINK = Object.freeze(Color.fromCssColorString("#FFC0CB"));
  Color.PLUM = Object.freeze(Color.fromCssColorString("#DDA0DD"));
  Color.POWDERBLUE = Object.freeze(Color.fromCssColorString("#B0E0E6"));
  Color.PURPLE = Object.freeze(Color.fromCssColorString("#800080"));
  Color.RED = Object.freeze(Color.fromCssColorString("#FF0000"));
  Color.ROSYBROWN = Object.freeze(Color.fromCssColorString("#BC8F8F"));
  Color.ROYALBLUE = Object.freeze(Color.fromCssColorString("#4169E1"));
  Color.SADDLEBROWN = Object.freeze(Color.fromCssColorString("#8B4513"));
  Color.SALMON = Object.freeze(Color.fromCssColorString("#FA8072"));
  Color.SANDYBROWN = Object.freeze(Color.fromCssColorString("#F4A460"));
  Color.SEAGREEN = Object.freeze(Color.fromCssColorString("#2E8B57"));
  Color.SEASHELL = Object.freeze(Color.fromCssColorString("#FFF5EE"));
  Color.SIENNA = Object.freeze(Color.fromCssColorString("#A0522D"));
  Color.SILVER = Object.freeze(Color.fromCssColorString("#C0C0C0"));
  Color.SKYBLUE = Object.freeze(Color.fromCssColorString("#87CEEB"));
  Color.SLATEBLUE = Object.freeze(Color.fromCssColorString("#6A5ACD"));
  Color.SLATEGRAY = Object.freeze(Color.fromCssColorString("#708090"));
  Color.SLATEGREY = Color.SLATEGRAY;
  Color.SNOW = Object.freeze(Color.fromCssColorString("#FFFAFA"));
  Color.SPRINGGREEN = Object.freeze(Color.fromCssColorString("#00FF7F"));
  Color.STEELBLUE = Object.freeze(Color.fromCssColorString("#4682B4"));
  Color.TAN = Object.freeze(Color.fromCssColorString("#D2B48C"));
  Color.TEAL = Object.freeze(Color.fromCssColorString("#008080"));
  Color.THISTLE = Object.freeze(Color.fromCssColorString("#D8BFD8"));
  Color.TOMATO = Object.freeze(Color.fromCssColorString("#FF6347"));
  Color.TURQUOISE = Object.freeze(Color.fromCssColorString("#40E0D0"));
  Color.VIOLET = Object.freeze(Color.fromCssColorString("#EE82EE"));
  Color.WHEAT = Object.freeze(Color.fromCssColorString("#F5DEB3"));
  Color.WHITE = Object.freeze(Color.fromCssColorString("#FFFFFF"));
  Color.WHITESMOKE = Object.freeze(Color.fromCssColorString("#F5F5F5"));
  Color.YELLOW = Object.freeze(Color.fromCssColorString("#FFFF00"));
  Color.YELLOWGREEN = Object.freeze(Color.fromCssColorString("#9ACD32"));
  Color.TRANSPARENT = Object.freeze(new Color(0, 0, 0, 0));
  var Color_default = Color;

  // ../../node_modules/@cesium/engine/Source/Core/HeadingPitchRange.js
  function HeadingPitchRange(heading, pitch, range) {
    this.heading = heading ?? 0;
    this.pitch = pitch ?? 0;
    this.range = range ?? 0;
  }
  HeadingPitchRange.clone = function(hpr, result) {
    if (!defined_default(hpr)) {
      return void 0;
    }
    if (!defined_default(result)) {
      result = new HeadingPitchRange();
    }
    result.heading = hpr.heading;
    result.pitch = hpr.pitch;
    result.range = hpr.range;
    return result;
  };
  var HeadingPitchRange_default = HeadingPitchRange;

  // ../../node_modules/@cesium/engine/Source/Core/HeadingPitchRoll.js
  function HeadingPitchRoll(heading, pitch, roll) {
    this.heading = heading ?? 0;
    this.pitch = pitch ?? 0;
    this.roll = roll ?? 0;
  }
  HeadingPitchRoll.fromQuaternion = function(quaternion, result) {
    if (!defined_default(quaternion)) {
      throw new DeveloperError_default("quaternion is required");
    }
    if (!defined_default(result)) {
      result = new HeadingPitchRoll();
    }
    const test = 2 * (quaternion.w * quaternion.y - quaternion.z * quaternion.x);
    const denominatorRoll = 1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
    const numeratorRoll = 2 * (quaternion.w * quaternion.x + quaternion.y * quaternion.z);
    const denominatorHeading = 1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z);
    const numeratorHeading = 2 * (quaternion.w * quaternion.z + quaternion.x * quaternion.y);
    result.heading = -Math.atan2(numeratorHeading, denominatorHeading);
    result.roll = Math.atan2(numeratorRoll, denominatorRoll);
    result.pitch = -Math_default.asinClamped(test);
    return result;
  };
  HeadingPitchRoll.fromDegrees = function(heading, pitch, roll, result) {
    if (!defined_default(heading)) {
      throw new DeveloperError_default("heading is required");
    }
    if (!defined_default(pitch)) {
      throw new DeveloperError_default("pitch is required");
    }
    if (!defined_default(roll)) {
      throw new DeveloperError_default("roll is required");
    }
    if (!defined_default(result)) {
      result = new HeadingPitchRoll();
    }
    result.heading = heading * Math_default.RADIANS_PER_DEGREE;
    result.pitch = pitch * Math_default.RADIANS_PER_DEGREE;
    result.roll = roll * Math_default.RADIANS_PER_DEGREE;
    return result;
  };
  HeadingPitchRoll.clone = function(headingPitchRoll, result) {
    if (!defined_default(headingPitchRoll)) {
      return void 0;
    }
    if (!defined_default(result)) {
      return new HeadingPitchRoll(
        headingPitchRoll.heading,
        headingPitchRoll.pitch,
        headingPitchRoll.roll
      );
    }
    result.heading = headingPitchRoll.heading;
    result.pitch = headingPitchRoll.pitch;
    result.roll = headingPitchRoll.roll;
    return result;
  };
  HeadingPitchRoll.equals = function(left, right) {
    return left === right || defined_default(left) && defined_default(right) && left.heading === right.heading && left.pitch === right.pitch && left.roll === right.roll;
  };
  HeadingPitchRoll.equalsEpsilon = function(left, right, relativeEpsilon, absoluteEpsilon) {
    return left === right || defined_default(left) && defined_default(right) && Math_default.equalsEpsilon(
      left.heading,
      right.heading,
      relativeEpsilon,
      absoluteEpsilon
    ) && Math_default.equalsEpsilon(
      left.pitch,
      right.pitch,
      relativeEpsilon,
      absoluteEpsilon
    ) && Math_default.equalsEpsilon(
      left.roll,
      right.roll,
      relativeEpsilon,
      absoluteEpsilon
    );
  };
  HeadingPitchRoll.prototype.clone = function(result) {
    return HeadingPitchRoll.clone(this, result);
  };
  HeadingPitchRoll.prototype.equals = function(right) {
    return HeadingPitchRoll.equals(this, right);
  };
  HeadingPitchRoll.prototype.equalsEpsilon = function(right, relativeEpsilon, absoluteEpsilon) {
    return HeadingPitchRoll.equalsEpsilon(
      this,
      right,
      relativeEpsilon,
      absoluteEpsilon
    );
  };
  HeadingPitchRoll.prototype.toString = function() {
    return `(${this.heading}, ${this.pitch}, ${this.roll})`;
  };
  var HeadingPitchRoll_default = HeadingPitchRoll;

  // ../../node_modules/@cesium/engine/Source/Core/NearFarScalar.js
  function NearFarScalar(near, nearValue, far, farValue) {
    this.near = near ?? 0;
    this.nearValue = nearValue ?? 0;
    this.far = far ?? 1;
    this.farValue = farValue ?? 0;
  }
  NearFarScalar.clone = function(nearFarScalar, result) {
    if (!defined_default(nearFarScalar)) {
      return void 0;
    }
    if (!defined_default(result)) {
      return new NearFarScalar(
        nearFarScalar.near,
        nearFarScalar.nearValue,
        nearFarScalar.far,
        nearFarScalar.farValue
      );
    }
    result.near = nearFarScalar.near;
    result.nearValue = nearFarScalar.nearValue;
    result.far = nearFarScalar.far;
    result.farValue = nearFarScalar.farValue;
    return result;
  };
  NearFarScalar.packedLength = 4;
  NearFarScalar.pack = function(value, array, startingIndex) {
    if (!defined_default(value)) {
      throw new DeveloperError_default("value is required");
    }
    if (!defined_default(array)) {
      throw new DeveloperError_default("array is required");
    }
    startingIndex = startingIndex ?? 0;
    array[startingIndex++] = value.near;
    array[startingIndex++] = value.nearValue;
    array[startingIndex++] = value.far;
    array[startingIndex] = value.farValue;
    return array;
  };
  NearFarScalar.unpack = function(array, startingIndex, result) {
    if (!defined_default(array)) {
      throw new DeveloperError_default("array is required");
    }
    startingIndex = startingIndex ?? 0;
    if (!defined_default(result)) {
      result = new NearFarScalar();
    }
    result.near = array[startingIndex++];
    result.nearValue = array[startingIndex++];
    result.far = array[startingIndex++];
    result.farValue = array[startingIndex];
    return result;
  };
  NearFarScalar.equals = function(left, right) {
    return left === right || defined_default(left) && defined_default(right) && left.near === right.near && left.nearValue === right.nearValue && left.far === right.far && left.farValue === right.farValue;
  };
  NearFarScalar.prototype.clone = function(result) {
    return NearFarScalar.clone(this, result);
  };
  NearFarScalar.prototype.equals = function(right) {
    return NearFarScalar.equals(this, right);
  };
  var NearFarScalar_default = NearFarScalar;
  return __toCommonJS(stdin_exports);
})();

}

const __cesiumCoreBundleFnText__ = __cesiumCoreBundleSource__.toString();
export const CESIUM_CORE_BUNDLE_SOURCE = __cesiumCoreBundleFnText__.slice(
  __cesiumCoreBundleFnText__.indexOf("{") + 1,
  __cesiumCoreBundleFnText__.lastIndexOf("}"),
);
