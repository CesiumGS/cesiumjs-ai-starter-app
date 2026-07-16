/**
 * Marshaling boundary between real CesiumJS host objects and the untrusted QuickJS guest sandbox.
 *
 * The guest can never hold a live reference to a real `Viewer`/`Entity` instance — QuickJS runs in
 * a separate WASM value space, so anything crossing the boundary must be either plain JSON data or
 * an opaque reference. Concretely, everything crossing the boundary is one of:
 *  - plain JSON-shaped data (primitives, arrays, plain object literals) — passed through as-is
 *  - a known CesiumJS *value* type (`Cartesian2`, `Cartesian3`, `Color`, ...) — pure, side-effect-
 *    free data, so it's tagged and passed through as plain JSON too (see {@link VALUE_TYPE_MARK})
 *  - anything else (a real class instance, a function) — stored host-side and replaced with an
 *    opaque `{ [HANDLE_MARK]: id }` reference the guest can only pass back into another bound
 *    call, never introspect or forge
 */
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileStyle,
  Color,
  HeadingPitchRange,
  HeadingPitchRoll,
  NearFarScalar,
} from "cesium";

/** Marker key identifying a wrapped opaque host-object reference crossing the sandbox boundary. */
export const HANDLE_MARK = "__cesiumSandboxHandle__";

/**
 * Marker key identifying a JSON-safe, tagged plain-data encoding of a known CesiumJS *value* type
 * (`Cartesian2`, `Cartesian3`, `Color`) crossing the sandbox boundary, as opposed to an opaque
 * `HANDLE_MARK` reference. Unlike `Entity`/`Viewer` instances — which have real host-side identity
 * and behavior the guest must never introspect — these are pure, side-effect-free data values (a
 * few numbers), so they're deliberately marshaled *transparently* as plain JSON instead of behind
 * an opaque handle: the guest-side prelude (`buildCesiumValueTypeGuestPrelude`) constructs,
 * inspects, and derives new values from them entirely in-sandbox with no host round trip at all,
 * and only pays the "reconstruct a real CesiumJS instance" cost at the boundary of an actual bound
 * call (e.g. `viewer.entities.add`), where `SandboxHandles.unwrap` revives the tagged data back
 * into a real `Cartesian2`/`Cartesian3`/`Color` before it reaches real CesiumJS.
 */
export const VALUE_TYPE_MARK = "__cesiumType__";

/**
 * Marker key identifying a guest-side `undefined` argument crossing the sandbox boundary. Plain
 * `JSON.stringify`/`JSON.parse` can't round-trip `undefined` (it's silently coerced to `null`
 * inside arrays), but callers frequently omit trailing optional arguments (e.g.
 * `Cesium.Cesium3DTileset.fromUrl(url)` without `options`) and real CesiumJS/test-double call
 * sites can observably distinguish an explicit `undefined` from `null` — so it's tagged instead of
 * silently collapsing to `null`.
 */
export const UNDEFINED_MARK = "__cesiumUndefined__";

/** Marker key identifying a small allowlist of guest-native scalar constructors. */
export const NATIVE_CONSTRUCTOR_MARK = "__cesiumNativeConstructor__";

const NATIVE_CONSTRUCTORS: Record<string, Function> = {
  Boolean,
  Number,
  String,
};

/** Hard cap on live handles a single sandboxed run may accumulate (bounds unbounded retention). */
const MAX_HANDLES = 500;

/**
 * Marks a `createProxied*` wrapper (viewer, camera, entities, scene, primitives, dataSources) so
 * `SandboxHandles.isPlainData` never mistakes it for inert plain JSON data. Without this, a Proxy
 * wrapping a plain object *literal* (as opposed to a real CesiumJS class instance — e.g. a test
 * double, or in principle any host object whose prototype happens to be `Object.prototype`) would
 * otherwise satisfy the "plain data" check purely by prototype shape, causing `wrap()` to flatten
 * it into a static snapshot via `Object.entries` — silently discarding the Proxy's `get` trap
 * (guardrails, synthetic methods) since a snapshot copy no longer routes through it at all.
 */
export const PROXY_MARKER = Symbol("cesiumHostProxy");

/**
 * Marshals values crossing the host/guest JSON boundary. Plain, JSON-shaped data (primitives,
 * arrays, and plain `{}` object literals) passes through as-is; anything else — a real CesiumJS
 * class instance like `Cartesian3`, `Color`, or `Entity`, which isn't structured-clonable/JSON-safe
 * and must never be reconstructed from untrusted guest-provided fields — is stored host-side and
 * replaced with an opaque `{ [HANDLE_MARK]: id }` reference the guest can only pass back into
 * another bound call, never introspect or forge (an unrecognized id is rejected).
 */
export class SandboxHandles {
  private readonly byId = new Map<string, unknown>();
  private counter = 0;

  private isPlainData(value: unknown): boolean {
    // Functions must never be treated as plain data: `JSON.stringify` silently drops them (or
    // turns them into `null` inside arrays), so a function returned as "plain" would vanish
    // across the boundary instead of becoming a callable opaque handle the guest can invoke.
    if (typeof value === "function") return false;
    if (value === null || typeof value !== "object") return true;
    if (Array.isArray(value)) return true;
    // See {@link PROXY_MARKER} — always an opaque handle, regardless of prototype shape.
    if (Reflect.get(value as object, PROXY_MARKER) === true) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  /**
   * Converts a known CesiumJS *value* type instance (`Cartesian2`, `Cartesian3`, `Color`) into
   * its JSON-safe tagged-data encoding, or returns `undefined` if `value` isn't one of these.
   * These are pure data (a handful of numbers, no side effects), unlike `Entity`/`Viewer`
   * instances, so they cross the boundary transparently instead of behind an opaque handle — see
   * {@link VALUE_TYPE_MARK}.
   */
  private tagValueType(value: unknown): Record<string, unknown> | undefined {
    if (value instanceof Cartesian2) {
      return { [VALUE_TYPE_MARK]: "Cartesian2", x: value.x, y: value.y };
    }
    if (value instanceof Cartesian3) {
      return { [VALUE_TYPE_MARK]: "Cartesian3", x: value.x, y: value.y, z: value.z };
    }
    if (value instanceof Color) {
      return {
        [VALUE_TYPE_MARK]: "Color",
        red: value.red,
        green: value.green,
        blue: value.blue,
        alpha: value.alpha,
      };
    }
    if (value instanceof NearFarScalar) {
      return {
        [VALUE_TYPE_MARK]: "NearFarScalar",
        near: value.near,
        nearValue: value.nearValue,
        far: value.far,
        farValue: value.farValue,
      };
    }
    if (value instanceof Cartographic) {
      return {
        [VALUE_TYPE_MARK]: "Cartographic",
        longitude: value.longitude,
        latitude: value.latitude,
        height: value.height,
      };
    }
    if (value instanceof HeadingPitchRange) {
      return {
        [VALUE_TYPE_MARK]: "HeadingPitchRange",
        heading: value.heading,
        pitch: value.pitch,
        range: value.range,
      };
    }
    if (value instanceof HeadingPitchRoll) {
      return {
        [VALUE_TYPE_MARK]: "HeadingPitchRoll",
        heading: value.heading,
        pitch: value.pitch,
        roll: value.roll,
      };
    }
    if (value instanceof Cesium3DTileStyle) {
      return { [VALUE_TYPE_MARK]: "Cesium3DTileStyle", style: value.style };
    }
    return undefined;
  }

  /** Reconstructs a real CesiumJS value-type instance from its tagged-data encoding. */
  private reviveValueType(record: Record<string, unknown>): unknown {
    switch (record[VALUE_TYPE_MARK]) {
      case "Cartesian2":
        return new Cartesian2(record.x as number, record.y as number);
      case "Cartesian3":
        return new Cartesian3(record.x as number, record.y as number, record.z as number);
      case "Color":
        return new Color(
          record.red as number,
          record.green as number,
          record.blue as number,
          record.alpha as number,
        );
      case "NearFarScalar":
        return new NearFarScalar(
          record.near as number,
          record.nearValue as number,
          record.far as number,
          record.farValue as number,
        );
      case "Cartographic":
        return new Cartographic(
          record.longitude as number,
          record.latitude as number,
          record.height as number,
        );
      case "HeadingPitchRange":
        return new HeadingPitchRange(
          record.heading as number,
          record.pitch as number,
          record.range as number,
        );
      case "HeadingPitchRoll":
        return new HeadingPitchRoll(
          record.heading as number,
          record.pitch as number,
          record.roll as number,
        );
      case "Cesium3DTileStyle":
        return new Cesium3DTileStyle(record.style as object);
      default:
        throw new Error(`Unknown tagged value type "${String(record[VALUE_TYPE_MARK])}"`);
    }
  }

  /** Converts a real host value into JSON-safe data for the guest, opaquely wrapping instances. */
  wrap(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.wrap(item));
    const tagged = this.tagValueType(value);
    if (tagged) return tagged;
    if (this.isPlainData(value)) {
      if (value === null || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, this.wrap(v)]),
      );
    }
    if (this.byId.size >= MAX_HANDLES) {
      throw new Error("Sandbox object handle limit exceeded");
    }
    const id = `h${this.counter++}`;
    this.byId.set(id, value);
    return { [HANDLE_MARK]: id };
  }

  /** Converts guest-provided JSON data back into real host values, resolving handle references. */
  unwrap(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.unwrap(item));
    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (HANDLE_MARK in record) {
        const id = record[HANDLE_MARK] as string;
        if (!this.byId.has(id)) throw new Error(`Unknown or expired sandbox handle "${id}"`);
        return this.byId.get(id);
      }
      if (VALUE_TYPE_MARK in record) return this.reviveValueType(record);
      if (UNDEFINED_MARK in record) return undefined;
      if (NATIVE_CONSTRUCTOR_MARK in record) {
        const name = record[NATIVE_CONSTRUCTOR_MARK] as string;
        const constructor = NATIVE_CONSTRUCTORS[name];
        if (!constructor) throw new Error(`Unsupported native constructor "${name}"`);
        return constructor;
      }
      return Object.fromEntries(Object.entries(record).map(([key, v]) => [key, this.unwrap(v)]));
    }
    return value;
  }

  /**
   * Stores `value` as a fresh opaque handle and returns its bare id (not the `{[HANDLE_MARK]:
   * id}` envelope `wrap()` produces). Intended for the sandbox's root-level bindings (e.g. the
   * proxied `viewer`), which are declared directly in the guest prelude rather than crossing the
   * boundary as a call result.
   */
  wrapRoot(value: unknown): string {
    if (this.byId.size >= MAX_HANDLES) {
      throw new Error("Sandbox object handle limit exceeded");
    }
    const id = `h${this.counter++}`;
    this.byId.set(id, value);
    return id;
  }

  /** Resolves a bare handle id (as sent by the guest's remote-proxy bridge) to its real value. */
  resolve(id: string): unknown {
    if (!this.byId.has(id)) throw new Error(`Unknown or expired sandbox handle "${id}"`);
    return this.byId.get(id);
  }
}
