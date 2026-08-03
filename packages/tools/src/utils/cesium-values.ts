import { Cartesian2, Cartesian3, Color } from "cesium";

/** Structural shape shared by every `position`/`destination`/`target` field across the tool schemas. */
export interface CartographicPosition {
  longitude: number;
  latitude: number;
  height?: number;
}

/** Converts a validated geographic position into the `Cartesian3` Cesium APIs expect. */
export function positionToCartesian3(position: CartographicPosition): Cartesian3 {
  return Cartesian3.fromDegrees(position.longitude, position.latitude, position.height ?? 0);
}

/** Converts an optional `{x, y}` pixel offset into a `Cartesian2`, or `undefined` if omitted. */
export function toCartesian2(offset?: { x: number; y: number }): Cartesian2 | undefined {
  return offset ? new Cartesian2(offset.x, offset.y) : undefined;
}

/**
 * Parses a CSS color string (e.g. `"#ff0000"`, `"red"`) into a Cesium `Color`,
 * falling back to `fallback` when `css` is omitted or fails to parse — every
 * `*Color`/`material` field across the entity tools is a plain string in the
 * schema, so this is the one place that string gets turned into a real
 * `Color` (which `PointGraphics.color`, `PolygonGraphics.material`, etc. all
 * accept directly).
 */
export function parseColor(css?: string, fallback?: Color): Color | undefined {
  if (!css) return fallback;
  const parsed = Color.fromCssColorString(css);
  return parsed ?? fallback;
}

/** Generates an id for tools whose schema makes `id` optional (e.g. `entityAddBox`). */
export function generateEntityId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
