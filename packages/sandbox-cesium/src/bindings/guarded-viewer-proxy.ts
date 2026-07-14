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
 * `createGuardedProxy` is the single generic `get`-trap factory every wrapper below builds on;
 * each wrapper only declares its own exceptions to "forward everything transparently" via a
 * `GuardedProxySpec`. This means the guest-visible API surface tracks real CesiumJS automatically
 * as it evolves — nothing here needs updating when Cesium adds a new method.
 */
import type { Viewer } from "cesium";
import {
  assertCollectionCapNotExceeded,
  assertEntityCapNotExceeded,
  DEFAULT_MAX_ENTITIES,
} from "../execution-guards.js";
import { PROXY_MARKER } from "./sandbox-handles.js";

/**
 * Host properties that must never cross the guest boundary. This applies to every opaque host
 * handle, not only the initial Viewer proxy: otherwise a guest could reach a DOM or lifecycle
 * object through a nested Cesium object that was returned from an allowed call.
 */
const BLOCKED_SANDBOX_PROPERTIES = new Set([
  "__proto__",
  "arguments",
  "caller",
  "canvas",
  "constructor",
  "container",
  "contentDocument",
  "contentWindow",
  "creditContainer",
  "creditViewport",
  "defaultView",
  "destroy",
  "document",
  "element",
  "isDestroyed",
  "ownerDocument",
  "parentElement",
  "prototype",
  "removeAll",
  "window",
]);

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
  assertCapNotExceeded: () => void,
): (item: unknown) => unknown {
  return function addWithGuardrails(item: unknown): unknown {
    assertCapNotExceeded();
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
export function createProxiedViewer(viewer: Viewer): Viewer {
  return createGuardedProxy(viewer, {
    nested: {
      entities: (real) => createProxiedEntities(real, viewer),
      // Camera needs a synthetic `getPositionCartographic()` accessor — the real Cesium `Camera`
      // only exposes `positionCartographic` as a readonly property, but generated code (and
      // callers going through the async host bridge) uniformly `await` every viewer call, so a
      // plain property read needs a matching zero-arg method form too.
      camera: (real) => createProxiedCamera(real),
      scene: (real) => createProxiedScene(real, viewer),
      dataSources: (real) => createProxiedDataSources(real),
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
function createProxiedEntities(entities: object, viewer: Viewer): unknown {
  return createGuardedProxy(entities, {
    guarded: {
      add: (real, target) =>
        guardedAdd(real, target, () =>
          assertEntityCapNotExceeded(viewer, { maxEntities: DEFAULT_MAX_ENTITIES }),
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
function createProxiedScene(scene: object, viewer: Viewer): unknown {
  return createGuardedProxy(scene, {
    synthetic: {
      setTerrainProvider: () => (terrainProvider: unknown) => {
        (viewer as unknown as Record<string, unknown>).terrainProvider = terrainProvider;
      },
    },
    nested: {
      primitives: (real) => createProxiedPrimitives(real),
    },
  });
}

/**
 * Creates a Proxy-wrapped PrimitiveCollection that applies a collection cap
 * to `add` calls (guards against unbounded 3D Tileset/primitive growth
 * bypassing the entity cap) while transparently forwarding everything else.
 */
function createProxiedPrimitives(primitives: object): unknown {
  return createGuardedProxy(primitives, {
    guarded: {
      add: (real, target) =>
        guardedAdd(real, target, () =>
          assertCollectionCapNotExceeded((target as { length: number }).length, "Primitive", {
            maxCount: DEFAULT_MAX_ENTITIES,
          }),
        ),
    },
  });
}

/**
 * Creates a Proxy-wrapped DataSourceCollection that applies a collection cap
 * to `add` calls (guards against unbounded GeoJSON/KML data source growth
 * bypassing the entity cap) while transparently forwarding everything else.
 */
function createProxiedDataSources(dataSources: object): unknown {
  return createGuardedProxy(dataSources, {
    guarded: {
      add: (real, target) =>
        guardedAdd(real, target, () =>
          assertCollectionCapNotExceeded((target as { length: number }).length, "Data source", {
            maxCount: DEFAULT_MAX_ENTITIES,
          }),
        ),
    },
  });
}