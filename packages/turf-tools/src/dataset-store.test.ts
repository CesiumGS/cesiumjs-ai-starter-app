import { describe, expect, it } from "vitest";
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

  it("isolates datasets between sessions — the reference app's known bug", () => {
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
});
