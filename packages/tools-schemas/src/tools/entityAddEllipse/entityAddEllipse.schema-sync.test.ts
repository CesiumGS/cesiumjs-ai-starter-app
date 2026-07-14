import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddEllipseInputSchema } from "./entityAddEllipse.js";
import { entityAddEllipseInputShape } from "./entityAddEllipse.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddEllipseInputSchema` instead of deriving them from the shared
 * `entityAddEllipseInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "ellipse-1",
      position: { longitude: 180, latitude: 90, height: 25 },
      ellipse: {
        semiMajorAxis: 0.0001,
        semiMinorAxis: 0.0001,
        rotation: 1.5708,
        height: 5,
        extrudedHeight: 20,
        material: "green",
        outline: true,
        outlineColor: "white",
      },
      name: "Coverage Area",
      description: "Sensor footprint",
    },
    valid: true,
  },
  {
    name: "position lower bounds",
    input: {
      position: { longitude: -180, latitude: -90 },
      ellipse: { semiMajorAxis: 1, semiMinorAxis: 1 },
    },
    valid: true,
  },
  {
    name: "rotation omitted",
    input: {
      position: { longitude: 10, latitude: 20 },
      ellipse: { semiMajorAxis: 3, semiMinorAxis: 2, height: 0, extrudedHeight: 10 },
    },
    valid: true,
  },
  {
    name: "longitude above range",
    input: {
      position: { longitude: 180.0001, latitude: 0 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
    },
    valid: false,
  },
  {
    name: "latitude below range",
    input: {
      position: { longitude: 0, latitude: -90.0001 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
    },
    valid: false,
  },
  {
    name: "semi major axis zero",
    input: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 0, semiMinorAxis: 5 },
    },
    valid: false,
  },
  {
    name: "semi minor axis negative",
    input: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: -1 },
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5 },
    },
    valid: false,
  },
  {
    name: "missing ellipse",
    input: {
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "missing semiMinorAxis",
    input: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 10 },
    },
    valid: false,
  },
  {
    name: "wrong rotation type",
    input: {
      position: { longitude: 0, latitude: 0 },
      ellipse: { semiMajorAxis: 10, semiMinorAxis: 5, rotation: "east" },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddEllipse schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddEllipseInputSchema.safeParse(input).success;
      const frontend = entityAddEllipseInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
