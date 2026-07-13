import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddBoxInputSchema } from "./entityAddBox.js";
import { entityAddBoxInputShape } from "./entityAddBox.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddBoxInputSchema` instead of deriving them from the shared
 * `entityAddBoxInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 1, y: 1, z: 1 } },
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "box-1",
      position: { longitude: 180, latitude: 90, height: 100 },
      box: {
        dimensions: { x: 10, y: 20, z: 30 },
        material: "blue",
        outline: true,
        outlineColor: "white",
      },
      orientation: { heading: 45, pitch: -10, roll: 5 },
      name: "Warehouse",
      description: "Volumetric building marker",
    },
    valid: true,
  },
  {
    name: "position lower bounds",
    input: {
      position: { longitude: -180, latitude: -90 },
      box: { dimensions: { x: 0.0001, y: 2, z: 3 } },
    },
    valid: true,
  },
  {
    name: "dimension y lower valid bound",
    input: {
      position: { longitude: 10, latitude: 20 },
      box: { dimensions: { x: 2, y: 0.0001, z: 3 } },
    },
    valid: true,
  },
  {
    name: "dimension z lower valid bound",
    input: {
      position: { longitude: 10, latitude: 20 },
      box: { dimensions: { x: 2, y: 3, z: 0.0001 } },
    },
    valid: true,
  },
  {
    name: "longitude below range",
    input: {
      position: { longitude: -180.0001, latitude: 0 },
      box: { dimensions: { x: 1, y: 1, z: 1 } },
    },
    valid: false,
  },
  {
    name: "latitude above range",
    input: {
      position: { longitude: 0, latitude: 90.0001 },
      box: { dimensions: { x: 1, y: 1, z: 1 } },
    },
    valid: false,
  },
  {
    name: "dimension x zero",
    input: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 0, y: 1, z: 1 } },
    },
    valid: false,
  },
  {
    name: "dimension y negative",
    input: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 1, y: -1, z: 1 } },
    },
    valid: false,
  },
  {
    name: "dimension z missing",
    input: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 1, y: 1 } },
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      box: { dimensions: { x: 1, y: 1, z: 1 } },
    },
    valid: false,
  },
  {
    name: "missing box",
    input: {
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "wrong orientation type",
    input: {
      position: { longitude: 0, latitude: 0 },
      box: { dimensions: { x: 1, y: 1, z: 1 } },
      orientation: { heading: "east" },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddBox schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddBoxInputSchema.safeParse(input).success;
      const frontend = entityAddBoxInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
