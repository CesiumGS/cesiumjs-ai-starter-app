import { describe, expect, test } from "vitest";
import { defaultEntityAddPolygonInputSchema } from "./entityAddPolygon.js";
import { entityAddPolygonInputShape } from "./entityAddPolygon.schema.js";

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
    name: "required fields only at minimum positions",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "with every optional field",
    input: {
      id: "poly1",
      positions: [
        { longitude: 10, latitude: 10, height: 100 },
        { longitude: 11, latitude: 10 },
        { longitude: 11, latitude: 11 },
      ],
      material: "rgba(255,255,0,0.5)",
      outlineColor: "black",
      outlineWidth: 0,
      height: 25,
      extrudedHeight: 150,
      description: "Polygon area",
    },
    valid: true,
  },
  {
    name: "position longitude upper bound",
    input: {
      id: "poly1",
      positions: [
        { longitude: 180, latitude: 0 },
        { longitude: 0, latitude: 0 },
        { longitude: 0, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "position longitude lower bound",
    input: {
      id: "poly1",
      positions: [
        { longitude: -180, latitude: 0 },
        { longitude: 0, latitude: 0 },
        { longitude: 0, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "position latitude upper bound",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 90 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "position latitude lower bound",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: -90 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "position longitude above range",
    input: {
      id: "poly1",
      positions: [
        { longitude: 180.0001, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "position longitude below range",
    input: {
      id: "poly1",
      positions: [
        { longitude: -180.0001, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "position latitude above range",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 90.0001 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "position latitude below range",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: -90.0001 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "outlineWidth negative",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
      outlineWidth: -0.1,
    },
    valid: false,
  },
  {
    name: "too few positions",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
      ],
    },
    valid: false,
  },
  {
    name: "missing id",
    input: {
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "missing positions",
    input: { id: "poly1" },
    valid: false,
  },
  {
    name: "missing position longitude",
    input: {
      id: "poly1",
      positions: [{ latitude: 0 }, { longitude: 1, latitude: 0 }, { longitude: 1, latitude: 1 }],
    },
    valid: false,
  },
  {
    name: "missing position latitude",
    input: {
      id: "poly1",
      positions: [{ longitude: 0 }, { longitude: 1, latitude: 0 }, { longitude: 1, latitude: 1 }],
    },
    valid: false,
  },
  {
    name: "wrong type",
    input: {
      id: "poly1",
      positions: [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
      material: 123,
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddPolygon schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddPolygonInputSchema.safeParse(input).success;
      const frontend = entityAddPolygonInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
