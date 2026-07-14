import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddBillboardInputSchema } from "./entityAddBillboard.js";
import { entityAddBillboardInputShape } from "./entityAddBillboard.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddBillboardInputSchema` instead of deriving them from the shared
 * `entityAddBillboardInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      id: "b1",
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/a.png",
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "b2",
      position: { longitude: 180, latitude: 90, height: 250 },
      image: "data:image/png;base64,abc",
      pixelOffset: { x: 10, y: -5 },
      width: 64,
      height: 32,
      description: "Marker icon",
    },
    valid: true,
  },
  {
    name: "position lower bounds",
    input: {
      id: "b3",
      position: { longitude: -180, latitude: -90 },
      image: "https://example.com/b.png",
    },
    valid: true,
  },
  {
    name: "width lower valid bound",
    input: {
      id: "b4",
      position: { longitude: 10, latitude: 20 },
      image: "https://example.com/c.png",
      width: 0.0001,
    },
    valid: true,
  },
  {
    name: "height lower valid bound",
    input: {
      id: "b5",
      position: { longitude: 10, latitude: 20 },
      image: "https://example.com/d.png",
      height: 0.0001,
    },
    valid: true,
  },
  {
    name: "longitude above range",
    input: {
      id: "b6",
      position: { longitude: 180.0001, latitude: 0 },
      image: "https://example.com/e.png",
    },
    valid: false,
  },
  {
    name: "latitude below range",
    input: {
      id: "b7",
      position: { longitude: 0, latitude: -90.0001 },
      image: "https://example.com/f.png",
    },
    valid: false,
  },
  {
    name: "width zero",
    input: {
      id: "b8",
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/g.png",
      width: 0,
    },
    valid: false,
  },
  {
    name: "height negative",
    input: {
      id: "b9",
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/h.png",
      height: -1,
    },
    valid: false,
  },
  {
    name: "missing id",
    input: {
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/a.png",
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      id: "b10",
      image: "https://example.com/a.png",
    },
    valid: false,
  },
  {
    name: "missing image",
    input: {
      id: "b11",
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "wrong pixelOffset type",
    input: {
      id: "b12",
      position: { longitude: 0, latitude: 0 },
      image: "https://example.com/a.png",
      pixelOffset: { x: "10", y: 5 },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddBillboard schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddBillboardInputSchema.safeParse(input).success;
      const frontend = entityAddBillboardInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
