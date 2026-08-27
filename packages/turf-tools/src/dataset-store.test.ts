import { describe, expect, it, vi } from "vitest";
import { createTurfDatasetStore, type StoredGeoJson } from "./dataset-store.js";

const samplePoint: StoredGeoJson = {
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [0, 0] },
};

describe("createTurfDatasetStore", () => {
  it("returns a fresh dataset_id per set() call and resolves it back for the same session", () => {
    const store = createTurfDatasetStore();
    const id = store.set("session-a", samplePoint);

    expect(store.get("session-a", id)).toEqual(samplePoint);
  });

  it("isolates datasets between sessions", () => {
    const store = createTurfDatasetStore();
    const idInA = store.set("session-a", samplePoint);

    // A second, concurrent session must not be able to read session-a's dataset,
    // even by guessing/reusing the same id.
    expect(store.get("session-b", idInA)).toBeUndefined();
  });

  it("allows two sessions to each hold a dataset with an equal-looking id independently", () => {
    const store = createTurfDatasetStore();
    const idInA = store.set("session-a", samplePoint);
    const otherPoint: StoredGeoJson = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [1, 1] },
    };
    const idInB = store.set("session-b", otherPoint);

    expect(store.get("session-a", idInA)).toEqual(samplePoint);
    expect(store.get("session-b", idInB)).toEqual(otherPoint);
  });

  it("returns undefined for an unknown dataset_id", () => {
    const store = createTurfDatasetStore();
    expect(store.get("session-a", "nonexistent")).toBeUndefined();
  });

  it("evicts datasets past their TTL", () => {
    const store = createTurfDatasetStore({ ttlMs: -1 });
    const id = store.set("session-a", samplePoint);

    expect(store.get("session-a", id)).toBeUndefined();
  });

  it("clear() drops every dataset for a session", () => {
    const store = createTurfDatasetStore();
    const id = store.set("session-a", samplePoint);
    store.clear("session-a");

    expect(store.get("session-a", id)).toBeUndefined();
  });

  it("refreshes the idle timer on get(), instead of expiring at a fixed age from creation", () => {
    vi.useFakeTimers();
    try {
      const store = createTurfDatasetStore({ ttlMs: 100 });
      const id = store.set("session-a", samplePoint);

      vi.advanceTimersByTime(60);
      expect(store.get("session-a", id)).toEqual(samplePoint); // refreshes idle timer

      // 120ms since creation (> ttlMs) would already be expired under fixed-age
      // semantics, but only 60ms have passed since the last get() above.
      vi.advanceTimersByTime(60);
      expect(store.get("session-a", id)).toEqual(samplePoint);

      // Now genuinely idle for longer than ttlMs since the last access.
      vi.advanceTimersByTime(150);
      expect(store.get("session-a", id)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("prunes a session's empty entry once its expired dataset is swept", () => {
    vi.useFakeTimers();
    try {
      const store = createTurfDatasetStore({ ttlMs: 10 });
      store.set("session-a", samplePoint);
      expect(store.sessionCount()).toBe(1);

      vi.advanceTimersByTime(20);
      store.get("session-a", "any-id"); // triggers the sweep even for an unrelated id

      expect(store.sessionCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
