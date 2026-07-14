import { describe, expect, test } from "vitest";
import {
  buildCameraGetPositionInputSchema,
  defaultCameraGetPositionInputSchema,
} from "./cameraGetPosition.js";

describe("buildCameraGetPositionInputSchema", () => {
  test("accepts the empty object input shape", () => {
    const schema = buildCameraGetPositionInputSchema();

    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("defaultCameraGetPositionInputSchema", () => {
  test("is defined and accepts the empty object input shape", () => {
    expect(defaultCameraGetPositionInputSchema).toBeDefined();
    expect(defaultCameraGetPositionInputSchema.safeParse({}).success).toBe(true);
  });
});
