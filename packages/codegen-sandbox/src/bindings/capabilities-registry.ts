import capabilities from "./cesium-capabilities.json" with { type: "json" };

export interface CesiumAsyncBindingCapability {
  hostName: string;
  cesiumPath: string;
}

/** Reviewed CesiumJS capability policy consumed by runtime bindings and upgrade tooling. */
export const CESIUM_SANDBOX_CAPABILITIES = capabilities;

export const SAFE_STATIC_CESIUM_EXPORTS = new Set(capabilities.staticExports);
export const BLOCKED_SANDBOX_PROPERTIES = new Set(capabilities.blockedProperties);
export const CESIUM_VALUE_TYPE_NAMES = capabilities.valueTypes;
export const CESIUM_ASYNC_BINDINGS: readonly CesiumAsyncBindingCapability[] =
  capabilities.asyncBindings;
export const CESIUM_ASYNC_BINDING_NAMES = capabilities.asyncBindings.map(
  ({ hostName }) => hostName,
);
export const CESIUM_DYNAMIC_PROMISE_RUNTIME_COVERAGE =
  capabilities.dynamicPromiseRuntimeCoverage;
export const CESIUM_DYNAMIC_PROMISE_RUNTIME_GAPS = capabilities.dynamicPromiseRuntimeGaps;
