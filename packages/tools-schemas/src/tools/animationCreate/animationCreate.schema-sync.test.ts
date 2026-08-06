import { describe, expect, test } from "vitest";
import { defaultAnimationCreateInputSchema } from "./animationCreate.js";
import { animationCreateInputShape } from "./animationCreate.schema.js";

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
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "with all optional fields",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0, height: 100 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1, height: 200 },
      ],
      name: "City commute",
      startTime: "2026-01-01T00:00:00Z",
      stopTime: "2026-01-01T00:05:00Z",
      interpolationAlgorithm: "LAGRANGE",
      showPath: true,
      pathLeadTime: 15,
      pathTrailTime: 15,
      pathWidth: 3,
      pathColor: { red: 0, green: 1, blue: 0 },
      modelPreset: "car",
      modelUri: "https://example.com/car.glb",
      modelScale: 1.5,
      loopMode: "loop",
      clampToGround: false,
      speedMultiplier: 10,
      autoPlay: true,
      trackCamera: true,
    },
    valid: true,
  },
  {
    name: "position sample latitude and longitude lower bounds",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: -180, latitude: -90 },
        { time: "2026-01-01T00:01:00Z", longitude: 0, latitude: 0 },
      ],
    },
    valid: true,
  },
  {
    name: "position sample latitude and longitude upper bounds",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 180, latitude: 90 },
        { time: "2026-01-01T00:01:00Z", longitude: 0, latitude: 0 },
      ],
    },
    valid: true,
  },
  {
    name: "position sample latitude above range",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 90.0001 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "position sample longitude below range",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: -180.0001, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
  {
    name: "position sample array minimum",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
    },
    valid: true,
  },
  {
    name: "position sample array too short",
    input: {
      positionSamples: [{ time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 }],
    },
    valid: false,
  },
  {
    name: "interpolation linear",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      interpolationAlgorithm: "LINEAR",
    },
    valid: true,
  },
  {
    name: "interpolation lagrange",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      interpolationAlgorithm: "LAGRANGE",
    },
    valid: true,
  },
  {
    name: "interpolation hermite",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      interpolationAlgorithm: "HERMITE",
    },
    valid: true,
  },
  {
    name: "invalid interpolation",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      interpolationAlgorithm: "CATMULL_ROM",
    },
    valid: false,
  },
  {
    name: "path styling fields",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      pathLeadTime: 5,
      pathTrailTime: 20,
      pathWidth: 4,
      pathColor: { red: 1, green: 0, blue: 0, alpha: 0.5 },
    },
    valid: true,
  },
  {
    name: "negative pathWidth",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      pathWidth: -1,
    },
    valid: false,
  },
  {
    name: "pathColor channel out of range",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      pathColor: { red: 2, green: 0, blue: 0 },
    },
    valid: false,
  },
  {
    name: "model preset cesium man",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelPreset: "cesium_man",
    },
    valid: true,
  },
  {
    name: "model preset car",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelPreset: "car",
    },
    valid: true,
  },
  {
    name: "model preset bike",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelPreset: "bike",
    },
    valid: true,
  },
  {
    name: "model preset airplane",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelPreset: "airplane",
    },
    valid: true,
  },
  {
    name: "invalid model preset",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelPreset: "train",
    },
    valid: false,
  },
  {
    name: "loop mode none",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      loopMode: "none",
    },
    valid: true,
  },
  {
    name: "loop mode loop",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      loopMode: "loop",
    },
    valid: true,
  },
  {
    name: "loop mode pingpong",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      loopMode: "pingpong",
    },
    valid: true,
  },
  {
    name: "invalid loop mode",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      loopMode: "bounce",
    },
    valid: false,
  },
  {
    name: "model scale positive",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelScale: 0.1,
    },
    valid: true,
  },
  {
    name: "model scale zero",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      modelScale: 0,
    },
    valid: false,
  },
  {
    name: "speed multiplier lower bound",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      speedMultiplier: 0.1,
    },
    valid: true,
  },
  {
    name: "speed multiplier upper bound",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      speedMultiplier: 100,
    },
    valid: true,
  },
  {
    name: "speed multiplier below range",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      speedMultiplier: 0.0999,
    },
    valid: false,
  },
  {
    name: "speed multiplier above range",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      speedMultiplier: 100.0001,
    },
    valid: false,
  },
  {
    name: "optional scalar and boolean fields individually included",
    input: {
      positionSamples: [
        { time: "2026-01-01T00:00:00Z", longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
      name: "Morning route",
      startTime: "2026-01-01T00:00:00Z",
      stopTime: "2026-01-01T00:02:00Z",
      showPath: false,
      modelUri: "https://example.com/bike.glb",
      clampToGround: true,
      autoPlay: false,
      trackCamera: false,
    },
    valid: true,
  },
  { name: "missing positionSamples", input: { name: "Missing samples" }, valid: false },
  { name: "empty object", input: {}, valid: false },
  {
    name: "wrong type",
    input: {
      positionSamples: [
        { time: 123, longitude: 0, latitude: 0 },
        { time: "2026-01-01T00:01:00Z", longitude: 1, latitude: 1 },
      ],
    },
    valid: false,
  },
];

describe("animationCreate schema sync (frontend ⇄ backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on "${name}"`, () => {
      const backend = defaultAnimationCreateInputSchema.safeParse(input).success;
      const frontend = animationCreateInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on "${name}"`).toBe(backend);
      expect(backend, `expected "${name}" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
