import { describe, expect, test } from "vitest";
import * as Cesium from "cesium";
import { CESIUM_VALUE_TYPE_NAMES, SAFE_STATIC_CESIUM_EXPORTS } from "./capabilities-registry.js";
import { buildCesiumValueTypeGuestPrelude } from "./guest-prelude-value-types.js";

describe("Cesium capability registry", () => {
  test("all allowed static exports exist in the installed Cesium namespace", () => {
    for (const exportName of SAFE_STATIC_CESIUM_EXPORTS) {
      expect(Cesium, `Cesium.${exportName}`).toHaveProperty(exportName);
    }
  });

  test("every manifest value type is attached by the generated guest prelude", () => {
    const prelude = buildCesiumValueTypeGuestPrelude();
    for (const valueType of CESIUM_VALUE_TYPE_NAMES) {
      expect(prelude).toContain(`Cesium.${valueType} = __CesiumCoreBundle__.${valueType};`);
    }
  });
});
