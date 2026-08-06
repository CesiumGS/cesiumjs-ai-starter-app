import { describe, expect, test } from "vitest";
import { defaultEntityAddInputSchema } from "./entityAdd.js";
import { entityAddInputShape, entityAddTypeValues } from "./entityAdd.schema.js";
import { MINIMAL_VALID_ENTITY_ADD_DATA } from "./entityAdd.fixtures.js";

const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "point variant valid",
    input: {
      type: "point",
      data: { id: "p1", position: { longitude: 0, latitude: 0 }, color: "red" },
    },
    valid: true,
  },
  {
    name: "polygon variant valid",
    input: {
      type: "polygon",
      data: {
        id: "poly1",
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      },
    },
    valid: true,
  },
  {
    name: "unknown variant",
    input: {
      type: "unknown",
      data: { id: "x" },
    },
    valid: false,
  },
  {
    name: "mismatched payload for point",
    input: {
      type: "point",
      data: { position: { longitude: 0, latitude: 0 } },
    },
    valid: false,
  },
  {
    name: "mismatched payload for box",
    input: {
      type: "box",
      data: { id: "b1", position: { longitude: 0, latitude: 0 } },
    },
    valid: false,
  },
  {
    name: "empty object",
    input: {},
    valid: false,
  },
  // Every entity type's minimal valid payload, so frontend/backend sync is checked for all variants.
  ...entityAddTypeValues.map((type) => ({
    name: `${type} variant valid (minimal payload)`,
    input: { type, data: MINIMAL_VALID_ENTITY_ADD_DATA[type] },
    valid: true,
  })),
];

describe("entityAdd schema sync (frontend <-> backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on \"${name}\"`, () => {
      const backend = defaultEntityAddInputSchema.safeParse(input).success;
      const frontend = entityAddInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on \"${name}\"`).toBe(backend);
      expect(backend, `expected \"${name}\" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
