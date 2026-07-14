import { describe, expect, test } from "vitest";
import {
  buildCameraStopOrbitInputSchema,
  defaultCameraStopOrbitInputSchema,
} from "./cameraStopOrbit.js";

describe("buildCameraStopOrbitInputSchema", () => {
  test("accepts the empty object input shape", () => {
    const schema = buildCameraStopOrbitInputSchema();

    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("defaultCameraStopOrbitInputSchema", () => {
  test("is defined and accepts the empty object input shape", () => {
    expect(defaultCameraStopOrbitInputSchema).toBeDefined();
    expect(defaultCameraStopOrbitInputSchema.safeParse({}).success).toBe(true);
  });
});
