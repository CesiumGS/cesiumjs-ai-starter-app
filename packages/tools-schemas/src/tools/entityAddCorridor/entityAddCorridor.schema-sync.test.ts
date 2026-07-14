import { describe, expect, test } from "vitest";
// Import the two schema entry points across the exact boundary the app uses:
//  - the BACKEND/model-facing schema (what the server validates and the LLM sees)
//  - the FRONTEND validation shape (what the browser executor validates against)
// These are different objects on purpose (the model-facing one carries `.describe()`
// hints), but they MUST enforce the same structural contract. If they ever diverge,
// the server could stream a tool call the client then rejects (or vice versa).
import { defaultEntityAddCorridorInputSchema } from "./entityAddCorridor.js";
import { entityAddCorridorInputShape } from "./entityAddCorridor.schema.js";

/**
 * Frontend/backend schema-sync contract.
 *
 * This asserts that the backend model-facing schema and the frontend validation
 * shape agree on a battery of boundary inputs. It fails the moment someone
 * changes the structural rules (required fields, numeric bounds, nested object
 * shapes) on one side without the other — e.g. by hardcoding constraints inside
 * `buildEntityAddCorridorInputSchema` instead of deriving them from the shared
 * `entityAddCorridorInputShape`.
 *
 * Each case asserts BOTH that the two schemas agree AND what the agreed outcome
 * should be, so two identically-broken schemas can't pass by quietly agreeing.
 */
const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "required fields only",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: 10,
      },
    },
    valid: true,
  },
  {
    name: "all optional fields included",
    input: {
      id: "corridor-1",
      corridor: {
        positions: [
          { longitude: -180, latitude: -90, height: 0 },
          { longitude: 180, latitude: 90, height: 50 },
        ],
        width: 0.0001,
        cornerType: "ROUNDED",
        height: 5,
        extrudedHeight: 20,
        material: "gray",
        outline: true,
        outlineColor: "yellow",
      },
      name: "Route",
      description: "Highlighted path",
    },
    valid: true,
  },
  {
    name: "mitered corner type",
    input: {
      corridor: {
        positions: [
          { longitude: 10, latitude: 10 },
          { longitude: 20, latitude: 20 },
        ],
        width: 5,
        cornerType: "MITERED",
      },
    },
    valid: true,
  },
  {
    name: "beveled corner type",
    input: {
      corridor: {
        positions: [
          { longitude: 10, latitude: 10 },
          { longitude: 20, latitude: 20 },
        ],
        width: 5,
        cornerType: "BEVELED",
      },
    },
    valid: true,
  },
  {
    name: "width zero",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: 0,
      },
    },
    valid: false,
  },
  {
    name: "longitude above range",
    input: {
      corridor: {
        positions: [
          { longitude: 180.0001, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: 10,
      },
    },
    valid: false,
  },
  {
    name: "latitude below range",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: -90.0001 },
          { longitude: 1, latitude: 1 },
        ],
        width: 10,
      },
    },
    valid: false,
  },
  {
    name: "positions too short",
    input: {
      corridor: {
        positions: [{ longitude: 0, latitude: 0 }],
        width: 10,
      },
    },
    valid: false,
  },
  {
    name: "missing positions",
    input: {
      corridor: {
        width: 10,
      },
    },
    valid: false,
  },
  {
    name: "missing width",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      },
    },
    valid: false,
  },
  {
    name: "missing corridor",
    input: {
      id: "corridor-2",
    },
    valid: false,
  },
  {
    name: "wrong width type",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: "10",
      },
    },
    valid: false,
  },
  {
    name: "invalid corner type",
    input: {
      corridor: {
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
        width: 10,
        cornerType: "SHARP",
      },
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddCorridor schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddCorridorInputSchema.safeParse(input).success;
      const frontend = entityAddCorridorInputShape.safeParse(input).success;

      // 1. The two boundaries must reach the same verdict.
      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      // 2. ...and it must be the verdict the shared contract intends.
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
