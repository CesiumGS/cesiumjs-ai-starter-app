/**
 * Merges per-field `.describe()` override text over a tool's default hints,
 * dropping any override explicitly set to `undefined` so it falls back to the
 * default rather than clobbering it. Every codegen-cesium tool's
 * `buildXInputSchema` needs this exact merge — extracted here (mirroring
 * `@cesium-ai/tools-cesium`'s identical helper) so adding a tool doesn't mean
 * re-deriving it. Deliberately duplicated rather than imported from
 * `@cesium-ai/tools-cesium`: that package is reserved for viewer-specific
 * tools, and this generic schema-building helper has no viewer dependency.
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
