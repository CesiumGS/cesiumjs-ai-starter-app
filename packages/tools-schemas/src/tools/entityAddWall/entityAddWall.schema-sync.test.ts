import { describe, expect, test } from "vitest";
import { defaultEntityAddWallInputSchema } from "./entityAddWall.js";
import { entityAddWallInputShape } from "./entityAddWall.schema.js";

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
    name: "required fields only",
    input: {
      wall: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: true,
  },
  {
    name: "with every optional field",
    input: {
      id: "wall1",
      wall: {
        positions: [
          { longitude: 10, latitude: 10, height: 100 },
          { longitude: 11, latitude: 11 },
        ],
        minimumHeights: [0, 10],
        maximumHeights: [100, 200],
        material: "gray",
        outline: true,
        outlineColor: "white",
      },
      name: "Barrier wall",
      description: "Wall entity",
    },
    valid: true,
  },
  {
    name: "position bounds",
    input: {
      wall: {
        positions: [
          { longitude: 180, latitude: 90 },
          { longitude: -180, latitude: -90 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: true,
  },
  {
    name: "position longitude above range",
    input: {
      wall: {
        positions: [
          { longitude: 180.0001, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "position longitude below range",
    input: {
      wall: {
        positions: [
          { longitude: -180.0001, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "position latitude above range",
    input: {
      wall: {
        positions: [
          { longitude: 0, latitude: 90.0001 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "position latitude below range",
    input: {
      wall: {
        positions: [
          { longitude: 0, latitude: -90.0001 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "too few positions",
    input: {
      wall: {
        positions: [{ longitude: 0, latitude: 0 }],
        maximumHeights: [10],
      },
    },
    valid: false,
  },
  {
    name: "missing wall",
    input: { id: "wall1" },
    valid: false,
  },
  {
    name: "missing positions",
    input: {
      wall: {
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "missing maximumHeights",
    input: {
      wall: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      },
    },
    valid: false,
  },
  {
    name: "missing position longitude",
    input: {
      wall: {
        positions: [{ latitude: 0 }, { longitude: 1, latitude: 1 }],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "missing position latitude",
    input: {
      wall: {
        positions: [{ longitude: 0 }, { longitude: 1, latitude: 1 }],
        maximumHeights: [10, 20],
      },
    },
    valid: false,
  },
  {
    name: "wrong type",
    input: {
      wall: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        maximumHeights: [10, 20],
        outline: "yes",
      },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddWall schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddWallInputSchema.safeParse(input).success;
      const frontend = entityAddWallInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
