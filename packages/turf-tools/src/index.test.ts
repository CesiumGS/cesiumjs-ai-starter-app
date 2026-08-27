import { describe, expect, it } from "vitest";
import { createTurfTools } from "./index.js";
import { createTurfDatasetStore } from "./dataset-store.js";

const polygonA = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 10],
            [10, 10],
            [10, 0],
            [0, 0],
          ],
        ],
      },
    },
  ],
} as const;

const pointsInsideAndOutside = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [5, 5] } },
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [50, 50] } },
  ],
} as const;

async function callTool(tools: ReturnType<typeof createTurfTools>, name: string, args: unknown) {
  const toolDef = tools[name];
  if (!toolDef?.execute) throw new Error(`tool ${name} has no execute`);
  return toolDef.execute(
    args as never,
    {
      toolCallId: "test-call",
      messages: [],
      context: undefined,
    } as never,
  );
}

describe("createTurfTools", () => {
  it("registers a dataset and returns a dataset_id", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_register_dataset", { geojson: polygonA })) as {
      dataset_id: string;
    };

    expect(result.dataset_id).toMatch(/^ds_/);
  });

  it("turf_buffer chains off a registered dataset_id", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const registered = (await callTool(tools, "turf_register_dataset", {
      geojson: polygonA,
    })) as { dataset_id: string };

    const buffered = (await callTool(tools, "turf_buffer", {
      geojson: { dataset_id: registered.dataset_id },
      radius: 10,
      units: "kilometers",
    })) as { dataset_id: string; feature_count: number };

    expect(buffered.dataset_id).toMatch(/^ds_/);
    expect(buffered.feature_count).toBeGreaterThan(0);
  });

  it("turf_buffer reports an unknown dataset_id as a tool error, not a throw", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_buffer", {
      geojson: { dataset_id: "does-not-exist" },
      radius: 10,
      units: "kilometers",
    })) as { error: string };

    expect(result.error).toMatch(/Unknown dataset_id/);
  });

  it("turf_buffer reports an inline Feature with no geometry as a tool error, not a throw", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_buffer", {
      geojson: { type: "Feature" },
      radius: 3,
      units: "kilometers",
    })) as { error: string };

    expect(result.error).toMatch(/Invalid Feature.*geometry/);
  });

  it("turf_get_dataset resolves a dataset_id back to its full GeoJSON", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const registered = (await callTool(tools, "turf_register_dataset", {
      geojson: polygonA,
    })) as { dataset_id: string };

    const result = (await callTool(tools, "turf_get_dataset", {
      dataset_id: registered.dataset_id,
    })) as { geojson: unknown };

    expect(result.geojson).toEqual(polygonA);
  });

  it("turf_get_dataset reports an unknown dataset_id as a tool error", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_get_dataset", {
      dataset_id: "does-not-exist",
    })) as { error: string };

    expect(result.error).toMatch(/Unknown dataset_id/);
  });

  it("turf_points_within_polygon finds only the interior point", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_points_within_polygon", {
      points: pointsInsideAndOutside,
      polygons: polygonA,
    })) as { dataset_id: string; point_count: number };

    expect(result.point_count).toBe(1);
  });

  it("turf_points_within_polygon rejects non-Point features passed as points", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_points_within_polygon", {
      points: polygonA,
      polygons: polygonA,
    })) as { error: string };

    expect(result.error).toMatch(/must be a FeatureCollection of Point features/);
  });

  it("turf_points_within_polygon rejects non-polygon features passed as polygons", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_points_within_polygon", {
      points: pointsInsideAndOutside,
      polygons: pointsInsideAndOutside,
    })) as { error: string };

    expect(result.error).toMatch(/must be a FeatureCollection of Polygon\/MultiPolygon features/);
  });

  it("turf_area rejects a Point-only input instead of silently returning 0", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_area", {
      geojson: pointsInsideAndOutside,
      units: "square_meters",
    })) as { error: string };

    expect(result.error).toMatch(/no Polygon/);
  });

  it("turf_area computes a positive area for a real polygon", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_area", {
      geojson: polygonA,
      units: "square_kilometers",
    })) as { area: number; units: string };

    expect(result.area).toBeGreaterThan(0);
  });

  it("turf_intersect finds the overlap between two overlapping polygons", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const polygonB = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [5, 5],
                [5, 15],
                [15, 15],
                [15, 5],
                [5, 5],
              ],
            ],
          },
        },
      ],
    } as const;

    const result = (await callTool(tools, "turf_intersect", {
      features1: polygonA,
      features2: polygonB,
    })) as { dataset_id: string; overlap_count: number };

    expect(result.overlap_count).toBe(1);
  });

  it("turf_intersect rejects an input whose pair count exceeds the guardrail", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const manyPolygons = {
      type: "FeatureCollection",
      features: Array.from({ length: 101 }, (_, i) => ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [i, i],
              [i, i + 1],
              [i + 1, i + 1],
              [i + 1, i],
              [i, i],
            ],
          ],
        },
      })),
    };

    const result = (await callTool(tools, "turf_intersect", {
      features1: manyPolygons,
      features2: manyPolygons,
    })) as { error: string };

    expect(result.error).toMatch(/exceeds/);
  });

  it("turf_intersect rejects non-polygon features", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_intersect", {
      features1: pointsInsideAndOutside,
      features2: polygonA,
    })) as { error: string };

    expect(result.error).toMatch(/features1 must contain only Polygon\/MultiPolygon features/);
  });

  it("turf_hex_grid generates cells covering the bbox", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_hex_grid", {
      bbox: { west: 0, south: 0, east: 1, north: 1 },
      cell_side: 10,
    })) as { dataset_id: string; cell_count: number };

    expect(result.cell_count).toBeGreaterThan(0);
  });

  it("turf_hex_grid rejects an oversized grid before generating it", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const result = (await callTool(tools, "turf_hex_grid", {
      bbox: { west: -180, south: -90, east: 180, north: 90 },
      cell_side: 0.01,
    })) as { error: string };

    expect(result.error).toMatch(/exceeding the \d+-cell limit/);
  });

  it("turf_hex_grid aggregates point counts per cell", async () => {
    const store = createTurfDatasetStore();
    const tools = createTurfTools(store, "session-1");

    const points = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { value: 3 },
          geometry: { type: "Point", coordinates: [0.5, 0.5] },
        },
        {
          type: "Feature",
          properties: { value: 4 },
          geometry: { type: "Point", coordinates: [0.6, 0.6] },
        },
      ],
    } as const;

    const result = (await callTool(tools, "turf_hex_grid", {
      bbox: { west: 0, south: 0, east: 1, north: 1 },
      cell_side: 20,
      points_to_aggregate: points,
      aggregate_property: "value",
    })) as { dataset_id: string; cell_count: number };

    expect(result.cell_count).toBeGreaterThan(0);
  });

  it("session isolation: session-2 cannot resolve session-1's dataset_id", async () => {
    const store = createTurfDatasetStore();
    const toolsSession1 = createTurfTools(store, "session-1");
    const toolsSession2 = createTurfTools(store, "session-2");

    const registered = (await callTool(toolsSession1, "turf_register_dataset", {
      geojson: polygonA,
    })) as { dataset_id: string };

    const result = (await callTool(toolsSession2, "turf_buffer", {
      geojson: { dataset_id: registered.dataset_id },
      radius: 10,
      units: "kilometers",
    })) as { error: string };

    expect(result.error).toMatch(/Unknown dataset_id/);
  });
});
