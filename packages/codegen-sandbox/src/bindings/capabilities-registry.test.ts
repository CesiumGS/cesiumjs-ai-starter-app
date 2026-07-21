import { describe, expect, test } from "vitest";
import * as Cesium from "cesium";
import { BLOCKED_STATIC_CESIUM_EXPORTS, CESIUM_VALUE_TYPE_NAMES } from "./capabilities-registry.js";
import capabilities from "../../cesium-capabilities.json" with { type: "json" };
import {
  CESIUM_GUEST_CONSTANTS,
  CESIUM_VALUE_TYPE_DEFINITIONS,
} from "./generated/value-type-registry.js";
import { buildCesiumValueTypeGuestPrelude } from "./guest-prelude-value-types.js";
import { SandboxHandles, VALUE_TYPE_MARK } from "./sandbox-handles.js";

describe("Cesium capability registry", () => {
  test("all blocked static exports exist in the installed Cesium namespace", () => {
    for (const exportName of BLOCKED_STATIC_CESIUM_EXPORTS) {
      expect(Cesium, `Cesium.${exportName}`).toHaveProperty(exportName);
    }
  });

  test("every manifest value type is attached by the generated guest prelude", () => {
    const prelude = buildCesiumValueTypeGuestPrelude();
    for (const valueType of CESIUM_VALUE_TYPE_NAMES) {
      expect(prelude).toContain(`const ${valueType} = Cesium.${valueType};`);
    }
  });

  test("generated value type definitions match the manifest", () => {
    expect(CESIUM_VALUE_TYPE_DEFINITIONS.map(({ name, fields }) => [name, [...fields]])).toEqual(
      Object.entries(capabilities.valueTypes),
    );
  });

  test("guest constants are generated from safe immutable Cesium records", () => {
    const expectedGuestConstants = Object.fromEntries(
      Object.entries(Cesium).filter(([, value]) => {
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          !Object.isFrozen(value)
        ) {
          return false;
        }

        const entries = Object.entries(value);
        return (
          entries.length > 0 &&
          entries.every(
            ([key, item]) =>
              /^[A-Z][A-Z0-9_]*$/.test(key) &&
              (item === null || ["string", "number", "boolean"].includes(typeof item)),
          )
        );
      }),
    );

    expect(CESIUM_GUEST_CONSTANTS).toEqual(expectedGuestConstants);
    expect(CESIUM_GUEST_CONSTANTS).toHaveProperty("ArcType.GEODESIC", Cesium.ArcType.GEODESIC);
    expect(CESIUM_GUEST_CONSTANTS).toHaveProperty(
      "ScreenSpaceEventType.LEFT_CLICK",
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    for (const [name, generatedValue] of Object.entries(CESIUM_GUEST_CONSTANTS)) {
      const installedValue = Cesium[name as keyof typeof Cesium];
      expect(Object.isFrozen(installedValue), `Cesium.${name}`).toBe(true);
      expect(generatedValue).toEqual(installedValue);
      expect(
        Object.entries(generatedValue).every(
          ([key, value]) =>
            /^[A-Z][A-Z0-9_]*$/.test(key) &&
            (value === null || ["string", "number", "boolean"].includes(typeof value)),
        ),
        `Cesium.${name}`,
      ).toBe(true);
    }
  });

  test("every generated value type round-trips through host marshaling", () => {
    const handles = new SandboxHandles();
    for (const definition of CESIUM_VALUE_TYPE_DEFINITIONS) {
      const values = definition.fields.map((_, index) => index + 1);
      const original = new definition.constructor(...values);
      const wrapped = handles.wrap(original) as Record<string, unknown>;
      const revived = handles.unwrap(wrapped) as Record<string, unknown>;

      expect(wrapped[VALUE_TYPE_MARK]).toBe(definition.name);
      expect(revived).toBeInstanceOf(definition.constructor);
      expect(definition.fields.map((field) => revived[field])).toEqual(values);
    }
  });
});
