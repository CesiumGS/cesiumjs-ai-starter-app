import { describe, expect, test } from "vitest";
import { defaultEntityAddModelInputSchema } from "./entityAddModel.js";
import { entityAddModelInputShape } from "./entityAddModel.schema.js";

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
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: true,
  },
  {
    name: "with every optional field",
    input: {
      id: "m1",
      position: { longitude: 12.34, latitude: 56.78, height: 1000 },
      uri: "https://example.com/model.glb",
      scale: 1.5,
      heading: 90,
      pitch: -15,
      roll: 5,
      minimumPixelSize: 64,
      description: "Test model",
    },
    valid: true,
  },
  {
    name: "position longitude upper bound",
    input: {
      id: "m1",
      position: { longitude: 180, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: true,
  },
  {
    name: "position longitude lower bound",
    input: {
      id: "m1",
      position: { longitude: -180, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: true,
  },
  {
    name: "position latitude upper bound",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 90 },
      uri: "https://example.com/a.glb",
    },
    valid: true,
  },
  {
    name: "position latitude lower bound",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: -90 },
      uri: "https://example.com/a.glb",
    },
    valid: true,
  },
  {
    name: "scale just above zero",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      scale: 0.0001,
    },
    valid: true,
  },
  {
    name: "minimumPixelSize just above zero",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      minimumPixelSize: 0.0001,
    },
    valid: true,
  },
  {
    name: "position longitude above range",
    input: {
      id: "m1",
      position: { longitude: 180.0001, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "position longitude below range",
    input: {
      id: "m1",
      position: { longitude: -180.0001, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "position latitude above range",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 90.0001 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "position latitude below range",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: -90.0001 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "scale zero",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      scale: 0,
    },
    valid: false,
  },
  {
    name: "scale negative",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      scale: -1,
    },
    valid: false,
  },
  {
    name: "minimumPixelSize zero",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      minimumPixelSize: 0,
    },
    valid: false,
  },
  {
    name: "minimumPixelSize negative",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      minimumPixelSize: -1,
    },
    valid: false,
  },
  {
    name: "missing id",
    input: {
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "missing position",
    input: {
      id: "m1",
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "missing uri",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
    },
    valid: false,
  },
  {
    name: "missing position longitude",
    input: {
      id: "m1",
      position: { latitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "missing position latitude",
    input: {
      id: "m1",
      position: { longitude: 0 },
      uri: "https://example.com/a.glb",
    },
    valid: false,
  },
  {
    name: "invalid uri",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "not-a-url",
    },
    valid: false,
  },
  {
    name: "wrong type",
    input: {
      id: "m1",
      position: { longitude: 0, latitude: 0 },
      uri: "https://example.com/a.glb",
      description: 123,
    },
    valid: false,
  },
  { name: "empty object", input: {}, valid: false },
];

describe("entityAddModel schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultEntityAddModelInputSchema.safeParse(input).success;
      const frontend = entityAddModelInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
