import { describe, expect, test } from "vitest";
import { mergeDescriptions } from "./merge-descriptions.js";

describe("mergeDescriptions", () => {
  const defaults = { latitude: "default lat", longitude: "default lon" };

  test("returns the defaults unchanged when no overrides are passed", () => {
    expect(mergeDescriptions(defaults)).toEqual(defaults);
  });

  test("an override replaces the matching default", () => {
    expect(mergeDescriptions(defaults, { latitude: "custom lat" })).toEqual({
      latitude: "custom lat",
      longitude: "default lon",
    });
  });

  test("an override explicitly set to `undefined` falls back to the default", () => {
    expect(mergeDescriptions(defaults, { latitude: undefined })).toEqual(defaults);
  });

  test("does not mutate the defaults object", () => {
    const snapshot = { ...defaults };

    mergeDescriptions(defaults, { latitude: "custom lat" });

    expect(defaults).toEqual(snapshot);
  });
});
