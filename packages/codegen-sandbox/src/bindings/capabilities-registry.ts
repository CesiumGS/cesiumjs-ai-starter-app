import capabilities from "../../cesium-capabilities.json" with { type: "json" };

/** Reviewed CesiumJS capability policy consumed by runtime bindings and upgrade tooling. */
export const CESIUM_SANDBOX_CAPABILITIES = capabilities;

export const BLOCKED_STATIC_CESIUM_EXPORTS = new Set(capabilities.blockedStaticExports);
export const BLOCKED_SANDBOX_PROPERTIES = new Set(capabilities.blockedProperties);
export const CESIUM_VALUE_TYPE_NAMES = Object.keys(capabilities.valueTypes);
export const CESIUM_DYNAMIC_PROMISE_RUNTIME_COVERAGE = capabilities.dynamicPromiseRuntimeCoverage;
export const CESIUM_DYNAMIC_PROMISE_RUNTIME_GAPS = capabilities.dynamicPromiseRuntimeGaps;
