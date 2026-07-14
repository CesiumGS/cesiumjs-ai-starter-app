import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddCylinderInputSchema } from "./entityAddCylinder.js";
import { entityAddCylinderInputShape } from "./entityAddCylinder.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddCylinderInputSchema` instead of deriving them from the shared
 * `entityAddCylinderInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: 1, bottomRadius: 2 },
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "cylinder-1",
      position: { longitude: 180, latitude: 90, height: 100 },
      cylinder: {
        length: 0.0001,
        topRadius: 0,
        bottomRadius: 0.0001,
        material: "silver",
        outline: true,
        outlineColor: "black",
      },
      orientation: { heading: 90, pitch: 0, roll: 15 },
      name: "Tower",
      description: "Observation tower marker",
    },
    valid: true,
  },
  {
    name: "position lower bounds",
    input: {
      position: { longitude: -180, latitude: -90 },
      cylinder: { length: 5, topRadius: 2, bottomRadius: 2 },
    },
    valid: true,
  },
  {
    name: "top radius zero",
    input: {
      position: { longitude: 10, latitude: 20 },
      cylinder: { length: 4, topRadius: 0, bottomRadius: 2 },
    },
    valid: true,
  },
  {
    name: "bottom radius zero",
    input: {
      position: { longitude: 10, latitude: 20 },
      cylinder: { length: 4, topRadius: 2, bottomRadius: 0 },
    },
    valid: true,
  },
  {
    name: "longitude above range",
    input: {
      position: { longitude: 180.0001, latitude: 0 },
      cylinder: { length: 10, topRadius: 1, bottomRadius: 2 },
    },
    valid: false,
  },
  {
    name: "latitude below range",
    input: {
      position: { longitude: 0, latitude: -90.0001 },
      cylinder: { length: 10, topRadius: 1, bottomRadius: 2 },
    },
    valid: false,
  },
  {
    name: "length zero",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 0, topRadius: 1, bottomRadius: 2 },
    },
    valid: false,
  },
  {
    name: "top radius negative",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: -1, bottomRadius: 2 },
    },
    valid: false,
  },
  {
    name: "bottom radius negative",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: 1, bottomRadius: -2 },
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      cylinder: { length: 10, topRadius: 1, bottomRadius: 2 },
    },
    valid: false,
  },
  {
    name: "missing cylinder",
    input: {
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "missing bottom radius",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: 1 },
    },
    valid: false,
  },
  {
    name: "wrong orientation type",
    input: {
      position: { longitude: 0, latitude: 0 },
      cylinder: { length: 10, topRadius: 1, bottomRadius: 2 },
      orientation: { roll: "up" },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddCylinder schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddCylinderInputSchema.safeParse(input).success;
      const frontend = entityAddCylinderInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
