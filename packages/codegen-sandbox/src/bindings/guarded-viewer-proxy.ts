/**
 * Proxy-based guardrail layer around a real CesiumJS `Viewer`.
 *
 * Instead of maintaining an exhaustive manifest of every Cesium method, `createProxiedViewer`
 * wraps the real `Viewer` in a `Proxy` that transparently forwards *everything* to the real API,
 * and only intercepts a small, explicit set of properties:
 *
 *   viewer.entities.add(...)           → entity cap checked, then forwarded
 *   viewer.scene.primitives.add(...)   → primitive cap checked, then forwarded
 *   viewer.dataSources.add(...)        → data source cap checked, then forwarded
 *   viewer.camera.getPositionCartographic() → synthetic method (real API is property-only)
 *   viewer.scene.setTerrainProvider(...)    → synthetic method (real API is property-only)
 *   everything else                    → transparent forward to the real API
 *
 * `viewer.flyTo`/`viewer.zoomTo` are notably absent from this proxy's own interception list too:
 * they're genuinely Promise-returning, but the generic remote-proxy bridge (`registerHostApply` in
 * `host-bridge.ts`) already bridges any Promise-returning call result back to the guest via a real
 * `ctx.newPromise()`, so no special-casing is needed here — they're just forwarded transparently
 * like every other real `Viewer` method. (An earlier design routed them guest-side through
 * QuickJS's Asyncify mechanism instead — that reproducibly crashed the interpreter with a native
 * `free_zero_refcount` assertion failure; removed in favor of this already-safe generic path.)
 *
 * `createGuardedProxy` is the single generic `get`-trap factory every wrapper below builds on;
 * each wrapper only declares its own exceptions to "forward everything transparently" via a
 * `GuardedProxySpec`. This means the guest-visible API surface tracks real CesiumJS automatically
 * as it evolves — nothing here needs updating when Cesium adds a new method.
 */
import type { Viewer } from "cesium";
import {
  DEFAULT_MAX_ITEMS_PER_COLLECTION,
  assertCollectionCapNotExceeded,
  assertEntityCapNotExceeded,
  type SceneCollectionCapOptions,
} from "../execution-guards.js";
import { PROXY_MARKER } from "./sandbox-handles.js";
import { BLOCKED_SANDBOX_PROPERTIES } from "./capabilities-registry.js";

/**
 * Host properties that must never cross the guest boundary. This applies to every opaque host
 * handle, not only the initial Viewer proxy: otherwise a guest could reach a DOM or lifecycle
 * object through a nested Cesium object that was returned from an allowed call.
 */
/** Rejects host properties that would escape the Cesium capability boundary or mutate prior state. */
export function assertSandboxPropertyAllowed(property: string): void {
  if (property.startsWith("_") || BLOCKED_SANDBOX_PROPERTIES.has(property)) {
    throw new Error(`Cesium sandbox access to "${property}" is not allowed.`);
  }
}

/**
 * Declarative description of the *exceptions* a `createGuardedProxy` wrapper makes to plain
 * transparent forwarding, keyed by property name:
 *
 * - `synthetic`: the property doesn't exist on the real target at all (or its real value should
 *   be ignored) — `factory(target)` builds a replacement value/method from scratch. Checked
 *   before the real property is even read.
 * - `guarded`: the property's real value is a method that must run a guardrail check before
 *   (and instead of a plain `.bind()` of) the real call — `wrap(realMethod, target)` returns the
 *   replacement function. Only applied when the real property actually is a function.
 * - `nested`: the property's real value is itself an object that needs its own guarded proxy —
 *   `wrap(realValue)` returns the wrapped replacement. Only applied when the real property is a
 *   non-null object.
 *
 * Every other property is forwarded transparently: functions are `.bind()`ed to the real target
 * (preserving `this`), everything else (including symbol-keyed properties, e.g. `Symbol.iterator`
 * on an iterable collection) passes through as-is.
 */
interface GuardedProxySpec {
  synthetic?: Record<string, (target: object) => unknown>;
  guarded?: Record<string, (real: (...args: unknown[]) => unknown, target: object) => unknown>;
  nested?: Record<string, (real: object) => unknown>;
}

/**
 * Generic `get`-trap Proxy factory underlying every `createProxied*` wrapper below
 * (`Viewer`, `Camera`, `EntityCollection`, `Scene`, `PrimitiveCollection`,
 * `DataSourceCollection`). Each of those is a real CesiumJS object that should behave exactly
 * like the real API for every property *except* a small, explicit set of names — a synthetic
 * method the real API doesn't have, a guardrail-checked method, or a child collection that
 * itself needs guarding. `spec` declares only those exceptions; this function supplies the
 * shared "transparently forward everything else, binding real methods to their real `this`"
 * behavior once, instead of once per wrapper.
 */
function createGuardedProxy(target: object, spec: GuardedProxySpec): unknown {
  return new Proxy(target, {
    get(t: object, prop: PropertyKey): unknown {
      if (prop === PROXY_MARKER) return true;

      if (typeof prop === "string") assertSandboxPropertyAllowed(prop);

      if (typeof prop === "string" && spec.synthetic?.[prop]) {
        return spec.synthetic[prop](t);
      }

      const real = Reflect.get(t, prop);

      if (typeof prop === "string" && typeof real === "function" && spec.guarded?.[prop]) {
        return spec.guarded[prop](real as (...args: unknown[]) => unknown, t);
      }

      if (
        typeof prop === "string" &&
        typeof real === "object" &&
        real !== null &&
        spec.nested?.[prop]
      ) {
        return spec.nested[prop](real);
      }

      // Transparently forward everything else. Methods keep their real `this` binding;
      // symbol-keyed properties (e.g. `Symbol.iterator`) and plain data pass through untouched.
      return typeof real === "function" ? real.bind(t) : real;
    },
    // Many real CesiumJS accessor properties (e.g. `Viewer.prototype.trackedEntity`'s setter
    // internally does `this._cesiumWidget.trackedEntity = value`) run their setter logic against
    // `this`. Without this trap, the Proxy's *default* set behavior invokes that setter with
    // `receiver` = the guarded Proxy itself (since the host bridge's `Reflect.set(target, prop,
    // value)` has no explicit receiver, which defaults to `target` = this Proxy) — so the
    // setter's own internal `this._cesiumWidget` access re-enters this SAME Proxy's `get` trap
    // and trips `assertSandboxPropertyAllowed` on a legitimate Cesium-internal underscore-prefixed
    // property, even though the guest never asked to read it. Explicitly forwarding with
    // `receiver = t` (the real underlying object, not the Proxy) makes the setter run with the
    // correct real `this`, exactly mirroring how the `get` trap already `.bind()`s real methods
    // to the real target instead of the Proxy.
    set(t: object, prop: PropertyKey, value: unknown): boolean {
      if (typeof prop === "string") assertSandboxPropertyAllowed(prop);
      return Reflect.set(t, prop, value, t);
    },
  });
}

/**
 * Shared guardrail-checked replacement for a collection's `add(item)` method, used by the
 * `entities`, `scene.primitives`, and `dataSources` wrappers below — each just supplies its own
 * cap-assertion call.
 */
function guardedAdd(
  real: (...args: unknown[]) => unknown,
  target: object,
  assertCapNotExceeded: (item: unknown) => void,
): (item: unknown) => unknown {
  return function addWithGuardrails(item: unknown): unknown {
    assertCapNotExceeded(item);
    return Reflect.apply(real, target, [item]);
  };
}

/**
 * Creates a Proxy-wrapped Cesium Viewer that automatically applies guardrails
 * (entity/primitive/data-source caps) to all API calls without requiring an
 * exhaustive manifest of every method.
 *
 * Note: there is no `apply` trap here — `viewer` is proxied as a plain object,
 * never invoked as a function (`proxiedViewer(...)`), so an `apply` trap would
 * be unreachable dead code.
 */
export function createProxiedViewer(
  viewer: Viewer,
  options: SceneCollectionCapOptions = {},
): Viewer {
  const maxCount = options.maxItemsPerCollection ?? DEFAULT_MAX_ITEMS_PER_COLLECTION;
  return createGuardedProxy(viewer, {
    nested: {
      entities: (real) => createProxiedEntities(real, viewer, maxCount),
      // Camera needs a synthetic `getPositionCartographic()` accessor — the real Cesium `Camera`
      // only exposes `positionCartographic` as a readonly property, but generated code (and
      // callers going through the async host bridge) uniformly `await` every viewer call, so a
      // plain property read needs a matching zero-arg method form too.
      camera: (real) => createProxiedCamera(real),
      scene: (real) => createProxiedScene(real, viewer, maxCount),
      dataSources: (real) => createProxiedDataSources(real, maxCount),
      imageryLayers: (real) =>
        createProxiedCollection(real, "Imagery layer", maxCount, ["add", "addImageryProvider"]),
    },
  }) as Viewer;
}

/**
 * Creates a Proxy-wrapped Camera that adds a synthetic `getPositionCartographic()` method
 * (real CesiumJS only exposes `positionCartographic` as a readonly property) while transparently
 * forwarding everything else (`flyTo`, `setView`, `lookAt`, etc.).
 */
function createProxiedCamera(camera: object): unknown {
  return createGuardedProxy(camera, {
    synthetic: {
      getPositionCartographic: (target) => () => Reflect.get(target, "positionCartographic"),
    },
  });
}

/**
 * Creates a Proxy-wrapped EntityCollection that applies the entity cap
 * to `add` calls while transparently forwarding all other operations.
 */
function createProxiedEntities(entities: object, viewer: Viewer, maxItems: number): unknown {
  return createGuardedProxy(entities, {
    guarded: {
      add: (real, target) =>
        guardedAdd(real, target, () =>
          assertEntityCapNotExceeded(viewer, { maxItemsPerCollection: maxItems }),
        ),
    },
  });
}

/**
 * Creates a Proxy-wrapped Scene that applies the primitive cap to
 * `scene.primitives.add` calls while transparently forwarding everything
 * else (camera, postProcessStages, etc.), plus a synthetic
 * `setTerrainProvider(terrainProvider)` method that assigns
 * `viewer.terrainProvider` — real CesiumJS exposes terrain switching as a plain
 * `viewer.terrainProvider = ...` assignment rather than a `scene` method, but
 * generated code (and the async factory bridge) uniformly call methods rather
 * than assign properties, so this bridges the two.
 */
function createProxiedScene(scene: object, viewer: Viewer, maxCount: number): unknown {
  return createGuardedProxy(scene, {
    synthetic: {
      setTerrainProvider: () => (terrainProvider: unknown) => {
        (viewer as unknown as Record<string, unknown>).terrainProvider = terrainProvider;
      },
    },
    nested: {
      primitives: (real) => createProxiedCollection(real, "Primitive", maxCount),
      groundPrimitives: (real) => createProxiedCollection(real, "Ground primitive", maxCount),
      postProcessStages: (real) => createProxiedCollection(real, "Post-process stage", maxCount),
    },
  });
}

/**
 * Creates a Proxy-wrapped PrimitiveCollection that applies a collection cap
 * to `add` calls (guards against unbounded 3D Tileset/primitive growth
 * bypassing the entity cap) while transparently forwarding everything else.
 */
function createProxiedCollection(
  collection: object,
  kind: string,
  maxCount: number,
  addMethods = ["add"],
): unknown {
  const guarded = Object.fromEntries(
    addMethods.map((method) => [
      method,
      (real: (...args: unknown[]) => unknown, target: object) =>
        guardedAdd(real, target, () =>
          assertCollectionCapNotExceeded((target as { length: number }).length, kind, { maxCount }),
        ),
    ]),
  );
  return createGuardedProxy(collection, {
    guarded,
  });
}

function createProxiedDataSources(dataSources: object, maxCount: number): unknown {
  return createGuardedProxy(dataSources, {
    guarded: {
      add: (real, target) =>
        guardedAdd(real, target, (item) => {
          assertCollectionCapNotExceeded((target as { length: number }).length, "Data source", {
            maxCount,
          });
          const entityCount = (item as { entities?: { values?: unknown[] } } | null)?.entities
            ?.values?.length;
          if (entityCount !== undefined) {
            assertCollectionCapNotExceeded(entityCount, "Data source entity", { maxCount });
          }
        }),
    },
  });
}
