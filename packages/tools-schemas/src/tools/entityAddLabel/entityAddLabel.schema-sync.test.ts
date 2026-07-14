import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddLabelInputSchema } from "./entityAddLabel.js";
import { entityAddLabelInputShape } from "./entityAddLabel.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddLabelInputSchema` instead of deriving them from the shared
 * `entityAddLabelInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      id: "l1",
      position: { longitude: 0, latitude: 0 },
      text: "hi",
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "l2",
      position: { longitude: 180, latitude: 90, height: 10 },
      text: "Status",
      font: "24px sans-serif",
      fillColor: "white",
      outlineColor: "black",
      outlineWidth: 0,
      pixelOffset: { x: 8, y: -4 },
      description: "Label marker",
    },
    valid: true,
  },
  {
    name: "position lower bounds",
    input: {
      id: "l3",
      position: { longitude: -180, latitude: -90 },
      text: "Southwest",
    },
    valid: true,
  },
  {
    name: "outline width positive",
    input: {
      id: "l4",
      position: { longitude: 10, latitude: 20 },
      text: "Styled",
      outlineWidth: 2,
    },
    valid: true,
  },
  {
    name: "longitude above range",
    input: {
      id: "l5",
      position: { longitude: 180.0001, latitude: 0 },
      text: "Invalid",
    },
    valid: false,
  },
  {
    name: "latitude below range",
    input: {
      id: "l6",
      position: { longitude: 0, latitude: -90.0001 },
      text: "Invalid",
    },
    valid: false,
  },
  {
    name: "outline width negative",
    input: {
      id: "l7",
      position: { longitude: 0, latitude: 0 },
      text: "Invalid",
      outlineWidth: -0.0001,
    },
    valid: false,
  },
  {
    name: "missing id",
    input: {
      position: { longitude: 0, latitude: 0 },
      text: "hi",
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      id: "l8",
      text: "hi",
    },
    valid: false,
  },
  {
    name: "missing text",
    input: {
      id: "l9",
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "wrong pixelOffset type",
    input: {
      id: "l10",
      position: { longitude: 0, latitude: 0 },
      text: "hi",
      pixelOffset: { x: 1, y: "2" },
    },
    valid: false,
  },
  {
    name: "wrong text type",
    input: {
      id: "l11",
      position: { longitude: 0, latitude: 0 },
      text: 42,
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddLabel schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddLabelInputSchema.safeParse(input).success;
      const frontend = entityAddLabelInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
