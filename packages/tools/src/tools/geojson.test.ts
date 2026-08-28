import { describe, expect, test, vi } from "vitest";
import type { Viewer } from "cesium";

/**
 * Point-feature loading in real `GeoJsonDataSource.load` renders a default
 * marker billboard via `PinBuilder`, which needs a real DOM `document`/canvas
 * — unavailable under this repo's plain `environment: "node"` vitest config.
 * Mocking just `GeoJsonDataSource` (keeping every other real `cesium` export)
 * keeps this test focused on this file's own executor logic (naming,
 * registry-free lookup-by-name, removeAll filtering) rather than re-testing
 * Cesium's own GeoJSON parser.
 */
class FakeGeoJsonDataSource {
  name = "";
  entities = { values: [{ id: "f1" }] };
  static load = vi.fn(async () => new FakeGeoJsonDataSource());
}

vi.mock("cesium", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cesium")>()),
  GeoJsonDataSource: FakeGeoJsonDataSource,
}));

const { geoJsonAdd, geoJsonRemove } = await import("./geojson.js");

const pointGeoJson = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } }],
};

function fakeDataSources() {
  const sources: FakeGeoJsonDataSource[] = [];
  return {
    add: async (ds: FakeGeoJsonDataSource) => {
      sources.push(ds);
      return ds;
    },
    remove: (ds: FakeGeoJsonDataSource) => {
      const index = sources.indexOf(ds);
      if (index !== -1) sources.splice(index, 1);
      return index !== -1;
    },
    get: (index: number) => sources[index],
    get length() {
      return sources.length;
    },
  };
}

function fakeViewer(): Viewer {
  return { dataSources: fakeDataSources() } as unknown as Viewer;
}

describe("geoJsonAdd", () => {
  test("loads GeoJSON and adds it as a named data source", async () => {
    const viewer = fakeViewer();

    const result = await geoJsonAdd(viewer, { geojson: pointGeoJson, name: "risk-zone" });

    expect(result).toEqual({ success: true, name: "risk-zone", entityCount: 1 });
    expect(viewer.dataSources.length).toBe(1);
  });

  test("defaults to a unique name when none is given", async () => {
    const viewer = fakeViewer();

    const result = await geoJsonAdd(viewer, { geojson: pointGeoJson });

    expect(result.success).toBe(true);
    expect(typeof result.name).toBe("string");
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await geoJsonAdd(viewer, { geojson: { type: "NotGeoJson" } });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid geoJsonAdd arguments");
  });
});

describe("geoJsonRemove", () => {
  test("removes a data source by name", async () => {
    const viewer = fakeViewer();
    await geoJsonAdd(viewer, { geojson: pointGeoJson, name: "risk-zone" });

    const result = await geoJsonRemove(viewer, { name: "risk-zone" });

    expect(result).toEqual({ success: true });
    expect(viewer.dataSources.length).toBe(0);
  });

  test("resolves { success: false, error } for an unknown name", async () => {
    const viewer = fakeViewer();

    const result = await geoJsonRemove(viewer, { name: "does-not-exist" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No GeoJSON data source named");
  });

  test("removeAll clears every GeoJsonDataSource", async () => {
    const viewer = fakeViewer();
    await geoJsonAdd(viewer, { geojson: pointGeoJson, name: "a" });
    await geoJsonAdd(viewer, { geojson: pointGeoJson, name: "b" });

    const result = await geoJsonRemove(viewer, { removeAll: true });

    expect(result).toEqual({ success: true });
    expect(viewer.dataSources.length).toBe(0);
  });

  test("requires either name or removeAll", async () => {
    const viewer = fakeViewer();

    const result = await geoJsonRemove(viewer, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("requires either name or removeAll");
  });

  test("only removes GeoJsonDataSource instances, never an unrelated data source", async () => {
    const viewer = fakeViewer();
    const unrelated = { name: "kml-layer" };
    await viewer.dataSources.add(unrelated as never);
    await geoJsonAdd(viewer, { geojson: pointGeoJson, name: "risk-zone" });

    await geoJsonRemove(viewer, { removeAll: true });

    expect(viewer.dataSources.length).toBe(1);
    expect(viewer.dataSources.get(0)).toBe(unrelated);
  });
});
