/**
 * Merges per-field `.describe()` override text over a tool's default hints,
 * dropping any override explicitly set to `undefined` so it falls back to the
 * default rather than clobbering it. Every Cesium tool's `buildXInputSchema`
 * needs this exact merge — extracted here so adding a tool doesn't mean
 * re-deriving it.
 */
export function mergeDescriptions<T extends Record<string, string>>(
  defaults: T,
  overrides: Partial<T> = {},
): T {
  return {
    ...defaults,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
  } as T;
}
