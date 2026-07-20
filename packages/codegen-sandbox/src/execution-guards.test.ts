import { describe, expect, test } from "vitest";
import type { Viewer } from "cesium";
import {
  assertEntityCapNotExceeded,
  DEFAULT_MAX_ITEMS_PER_COLLECTION,
  EntityCapExceededError,
} from "./execution-guards.js";

describe("assertEntityCapNotExceeded", () => {
  function mockViewer(entityCount: number): Viewer {
    return {
      entities: { values: new Array(entityCount).fill({}) },
    } as unknown as Viewer;
  }

  test("does not throw when below the cap", () => {
    const viewer = mockViewer(5);
    expect(() => assertEntityCapNotExceeded(viewer, { maxItemsPerCollection: 10 })).not.toThrow();
  });

  test("throws EntityCapExceededError once the count reaches the cap", () => {
    const viewer = mockViewer(10);
    expect(() => assertEntityCapNotExceeded(viewer, { maxItemsPerCollection: 10 })).toThrow(
      EntityCapExceededError,
    );
  });

  test("throws once the count exceeds the cap", () => {
    const viewer = mockViewer(15);
    expect(() => assertEntityCapNotExceeded(viewer, { maxItemsPerCollection: 10 })).toThrow(
      EntityCapExceededError,
    );
  });

  test("uses DEFAULT_MAX_ITEMS_PER_COLLECTION as a sensible default", () => {
    expect(DEFAULT_MAX_ITEMS_PER_COLLECTION).toBeGreaterThan(0);
    const viewer = mockViewer(DEFAULT_MAX_ITEMS_PER_COLLECTION);
    expect(() =>
      assertEntityCapNotExceeded(viewer, {
        maxItemsPerCollection: DEFAULT_MAX_ITEMS_PER_COLLECTION,
      }),
    ).toThrow(EntityCapExceededError);
  });

  test("falls back to DEFAULT_MAX_ITEMS_PER_COLLECTION when the option is omitted", () => {
    const belowDefault = mockViewer(DEFAULT_MAX_ITEMS_PER_COLLECTION - 1);
    expect(() => assertEntityCapNotExceeded(belowDefault)).not.toThrow();

    const atDefault = mockViewer(DEFAULT_MAX_ITEMS_PER_COLLECTION);
    expect(() => assertEntityCapNotExceeded(atDefault, {})).toThrow(EntityCapExceededError);
  });
});
