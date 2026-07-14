import { describe, expect, test } from "vitest";
import { defaultEntityAddPointInputSchema } from "./entityAddPoint.js";
import { entityAddPointInputShape } from "./entityAddPoint.schema.js";

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
    input: { id: "p1", position: { longitude: 0, latitude: 0 } },
    valid: true,
  },
  {
    name: "with every optional field",
    input: {
      id: "p1",
      position: { longitude: 12.34, latitude: 56.78, height: 100 },
      color: "red",
      pixelSize: 10,
      description: "Point marker",
    },
    valid: true,
  },
  {
    name: "position longitude upper bound",
    input: { id: "p1", position: { longitude: 180, latitude: 0 } },
    valid: true,
  },
  {
    name: "position longitude lower bound",
    input: { id: "p1", position: { longitude: -180, latitude: 0 } },
    valid: true,
  },
  {
    name: "position latitude upper bound",
    input: { id: "p1", position: { longitude: 0, latitude: 90 } },
    valid: true,
  },
  {
    name: "position latitude lower bound",
    input: { id: "p1", position: { longitude: 0, latitude: -90 } },
    valid: true,
  },
  {
    name: "pixelSize just above zero",
    input: { id: "p1", position: { longitude: 0, latitude: 0 }, pixelSize: 0.0001 },
    valid: true,
  },
  {
    name: "position longitude above range",
    input: { id: "p1", position: { longitude: 180.0001, latitude: 0 } },
    valid: false,
  },
  {
    name: "position longitude below range",
    input: { id: "p1", position: { longitude: -180.0001, latitude: 0 } },
    valid: false,
  },
  {
    name: "position latitude above range",
    input: { id: "p1", position: { longitude: 0, latitude: 90.0001 } },
    valid: false,
  },
  {
    name: "position latitude below range",
    input: { id: "p1", position: { longitude: 0, latitude: -90.0001 } },
    valid: false,
  },
  {
    name: "pixelSize zero",
    input: { id: "p1", position: { longitude: 0, latitude: 0 }, pixelSize: 0 },
    valid: false,
  },
  {
    name: "pixelSize negative",
    input: { id: "p1", position: { longitude: 0, latitude: 0 }, pixelSize: -1 },
    valid: false,
  },
  {
    name: "missing id",
    input: { position: { longitude: 0, latitude: 0 } },
    valid: false,
  },
  {
    name: "missing position",
    input: { id: "p1" },
    valid: false,
  },
  {
    name: "missing position longitude",
    input: { id: "p1", position: { latitude: 0 } },
    valid: false,
  },
  {
    name: "missing position latitude",
    input: { id: "p1", position: { longitude: 0 } },
    valid: false,
  },
  {
    name: "wrong type",
    input: { id: "p1", position: { longitude: 0, latitude: 0 }, color: 123 },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddPoint schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddPointInputSchema.safeParse(input).success;
      const frontend = entityAddPointInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
