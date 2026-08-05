import { describe, expect, test } from "vitest";
import { defaultEntityAddInputSchema } from "./entityAdd.js";
import { entityAddInputShape } from "./entityAdd.schema.js";

const CASES: ReadonlyArray<{ name: string; input: unknown; valid: boolean }> = [
  {
    name: "point variant valid",
    input: {
      type: "point",
      data: { id: "p1", position: { longitude: 0, latitude: 0 }, color: "red" },
    },
    valid: true,
  },
  {
    name: "polygon variant valid",
    input: {
      type: "polygon",
      data: {
        id: "poly1",
        positions: [
          { longitude: 0, latitude: 0 },
          { longitude: 1, latitude: 0 },
          { longitude: 1, latitude: 1 },
        ],
      },
    },
    valid: true,
  },
  {
    name: "unknown variant",
    input: {
      type: "unknown",
      data: { id: "x" },
    },
    valid: false,
  },
  {
    name: "mismatched payload for point",
    input: {
      type: "point",
      data: { position: { longitude: 0, latitude: 0 } },
    },
    valid: false,
  },
  {
    name: "mismatched payload for box",
    input: {
      type: "box",
      data: { id: "b1", position: { longitude: 0, latitude: 0 } },
    },
    valid: false,
  },
  {
    name: "empty object",
    input: {},
    valid: false,
  },
];

describe("entityAdd schema sync (frontend <-> backend)", () => {
  for (const { name, input, valid } of CASES) {
    test(`agree on \"${name}\"`, () => {
      const backend = defaultEntityAddInputSchema.safeParse(input).success;
      const frontend = entityAddInputShape.safeParse(input).success;

      expect(frontend, `frontend/backend disagree on \"${name}\"`).toBe(backend);
      expect(backend, `expected \"${name}\" to be ${valid ? "valid" : "invalid"}`).toBe(valid);
    });
  }
});
