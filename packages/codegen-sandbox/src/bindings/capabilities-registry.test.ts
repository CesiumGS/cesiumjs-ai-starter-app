import { describe, expect, test } from "vitest";
import * as Cesium from "cesium";
import {
  CESIUM_ASYNC_BINDINGS,
  CESIUM_VALUE_TYPE_NAMES,
  SAFE_STATIC_CESIUM_EXPORTS,
} from "./capabilities-registry.js";
import {
  CESIUM_ASYNC_FACTORY_NAMES,
  DEFAULT_CESIUM_ASYNC_FACTORIES,
} from "./cesium-async-factories.js";
import { buildCesiumValueTypeGuestPrelude } from "./guest-prelude-value-types.js";

describe("Cesium capability registry", () => {
  test("all allowed static exports exist in the installed Cesium namespace", () => {
    for (const exportName of SAFE_STATIC_CESIUM_EXPORTS) {
      expect(Cesium, `Cesium.${exportName}`).toHaveProperty(exportName);
    }
  });

  test("async factory registry exactly matches non-Viewer manifest bindings", () => {
    const manifestFactoryNames = CESIUM_ASYNC_BINDINGS.filter(
      ({ cesiumPath }) => !cesiumPath.startsWith("Viewer."),
    )
      .map(({ hostName }) => hostName)
      .sort();

    expect([...CESIUM_ASYNC_FACTORY_NAMES].sort()).toEqual(manifestFactoryNames);
    expect(Object.keys(DEFAULT_CESIUM_ASYNC_FACTORIES).sort()).toEqual(manifestFactoryNames);
  });

  test("every manifest value type is attached by the generated guest prelude", () => {
    const prelude = buildCesiumValueTypeGuestPrelude();
    for (const valueType of CESIUM_VALUE_TYPE_NAMES) {
      expect(prelude).toContain(`Cesium.${valueType} = __CesiumCoreBundle__.${valueType};`);
    }
  });
});
