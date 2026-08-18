/**
 * Merges per-field `.describe()` override text over a tool's default hints, dropping any
 * override explicitly set to `undefined` so it falls back to the default rather than clobbering
 * it. Deliberately duplicated rather than imported from `@cesium-ai/tools-schemas` or
 * `@cesium-ai/codegen-cesium`: this generic schema-building helper has no viewer/codegen-cesium
 * dependency, and every codegen package keeps its own copy (see `@cesium-ai/codegen-cesium`'s
 * identical file).
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
