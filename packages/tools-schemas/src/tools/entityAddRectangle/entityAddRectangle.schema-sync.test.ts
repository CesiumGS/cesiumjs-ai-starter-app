import { describe, expect, test } from "vitest";
import { defaultEntityAddRectangleInputSchema } from "./entityAddRectangle.js";
import { entityAddRectangleInputShape } from "./entityAddRectangle.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules on one side without the other.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only at coordinate bounds",
    input: {
      rectangle: { coordinates: { north: 90, south: -90, east: 180, west: -180 } },
    },
    valid: true,
  },
  {
    name: "with every optional field",
    input: {
      id: "rect1",
      rectangle: {
        coordinates: { north: 1, south: 0, east: 1, west: 0 },
        material: "blue",
        outline: true,
        outlineColor: "white",
        height: 100,
        extrudedHeight: 250,
      },
      name: "Bounds rectangle",
      description: "Rectangle area",
    },
    valid: true,
  },
  {
    name: "north above range",
    input: {
      rectangle: { coordinates: { north: 90.0001, south: -90, east: 180, west: -180 } },
    },
    valid: false,
  },
  {
    name: "south below range",
    input: {
      rectangle: { coordinates: { north: 90, south: -90.0001, east: 180, west: -180 } },
    },
    valid: false,
  },
  {
    name: "east above range",
    input: {
      rectangle: { coordinates: { north: 90, south: -90, east: 180.0001, west: -180 } },
    },
    valid: false,
  },
  {
    name: "west below range",
    input: {
      rectangle: { coordinates: { north: 90, south: -90, east: 180, west: -180.0001 } },
    },
    valid: false,
  },
  {
    name: "missing rectangle",
    input: {},
    valid: false,
  },
  {
    name: "missing coordinates",
    input: { rectangle: {} },
    valid: false,
  },
  {
    name: "missing north",
    input: { rectangle: { coordinates: { south: 0, east: 1, west: 0 } } },
    valid: false,
  },
  {
    name: "missing south",
    input: { rectangle: { coordinates: { north: 1, east: 1, west: 0 } } },
    valid: false,
  },
  {
    name: "missing east",
    input: { rectangle: { coordinates: { north: 1, south: 0, west: 0 } } },
    valid: false,
  },
  {
    name: "missing west",
    input: { rectangle: { coordinates: { north: 1, south: 0, east: 1 } } },
    valid: false,
  },
  {
    name: "wrong type",
    input: {
      rectangle: {
        coordinates: { north: 1, south: 0, east: 1, west: 0 },
        outline: "yes",
      },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddRectangle schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddRectangleInputSchema.safeParse(input).success;
      const frontend = entityAddRectangleInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
