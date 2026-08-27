import type { Feature, FeatureCollection, Geometry } from "geojson";

/** Flattens a resolved Feature/FeatureCollection (from {@link resolveGeoJson}) into a feature array. */
export function toFeatureArray(
  resolved: Feature<Geometry> | FeatureCollection<Geometry>,
): Feature<Geometry>[] {
  return resolved.type === "FeatureCollection" ? resolved.features : [resolved];
}

/**
 * Every geometry type name in `features` that isn't in `allowed`, deduplicated. Used to reject
 * wrong-shaped input (e.g. polygons passed where points are expected) with a clear tool error
 * instead of letting it reach Turf and throw an opaque internal error.
 */
export function findDisallowedGeometryTypes(
  features: Feature<Geometry>[],
  allowed: readonly string[],
): string[] {
  const found = new Set<string>();
  for (const feature of features) {
    const type = feature.geometry?.type;
    if (type && !allowed.includes(type)) found.add(type);
  }
  return [...found];
}
