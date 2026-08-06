import { describe, expect, test } from "vitest";
import type { Viewer } from "cesium";
import { imageryAdd, imageryList, imageryRemove } from "./imagery.js";

/** Fake imagery layer — a plain object is enough since the registry keys on identity, not class. */
interface FakeImageryLayer {
  alpha: number;
  show: boolean;
}

function fakeImageryLayers() {
  const layers: FakeImageryLayer[] = [];
  return {
    addImageryProvider: (): FakeImageryLayer => {
      const layer: FakeImageryLayer = { alpha: 1, show: true };
      layers.push(layer);
      return layer;
    },
    indexOf: (layer: FakeImageryLayer) => layers.indexOf(layer),
    get: (index: number) => layers[index],
    get length() {
      return layers.length;
    },
    remove: (layer: FakeImageryLayer) => {
      const index = layers.indexOf(layer);
      if (index !== -1) layers.splice(index, 1);
    },
    removeAll: () => {
      layers.length = 0;
    },
  };
}

function fakeViewer(): Viewer {
  return { imageryLayers: fakeImageryLayers() } as unknown as Viewer;
}

/** Adds a real (lazy, no network access at construction time) `UrlTemplateImageryProvider` layer. */
function addLayer(viewer: Viewer, name: string, extra: Record<string, unknown> = {}) {
  return imageryAdd(viewer, {
    type: "UrlTemplateImageryProvider",
    url: `https://${name.toLowerCase()}.example/{z}/{x}/{y}.png`,
    name,
    ...extra,
  });
}

describe("imageryAdd", () => {
  test("adds a layer and defaults name to the provider type when omitted", async () => {
    const viewer = fakeViewer();

    const result = await imageryAdd(viewer, {
      type: "UrlTemplateImageryProvider",
      url: "https://example.com/{z}/{x}/{y}.png",
    });

    expect(result).toEqual({ success: true, name: "UrlTemplateImageryProvider", index: 0 });
  });

  test("uses a caller-supplied name and applies alpha/show onto the new layer", async () => {
    const viewer = fakeViewer();

    const result = await addLayer(viewer, "Basemap", { alpha: 0.5, show: false });

    expect(result).toEqual({ success: true, name: "Basemap", index: 0 });
    const layer = viewer.imageryLayers.get(0) as unknown as FakeImageryLayer;
    expect(layer.alpha).toBe(0.5);
    expect(layer.show).toBe(false);
  });

  test("resolves { success: false, error } for a provider type with no default factory", async () => {
    const viewer = fakeViewer();

    const result = await imageryAdd(viewer, {
      type: "GoogleEarthEnterpriseImageryProvider",
      url: "https://example.com",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("isn't implemented by default");
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await imageryAdd(viewer, { type: "UrlTemplateImageryProvider" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid imageryAdd arguments");
  });
});

describe("imageryRemove", () => {
  async function seedTwoLayers(viewer: Viewer) {
    await addLayer(viewer, "A");
    await addLayer(viewer, "B");
  }

  test("removes by index", async () => {
    const viewer = fakeViewer();
    await seedTwoLayers(viewer);

    const result = await imageryRemove(viewer, { index: 0 });

    expect(result).toEqual({ success: true });
    expect(viewer.imageryLayers.length).toBe(1);
  });

  test("removes by name", async () => {
    const viewer = fakeViewer();
    await seedTwoLayers(viewer);

    const result = await imageryRemove(viewer, { name: "B" });

    expect(result).toEqual({ success: true });
    const remaining = await imageryList(viewer, {});
    expect(remaining).toEqual({
      success: true,
      layers: [{ index: 0, name: "A", show: true }],
    });
  });

  test("removeAll clears every layer", async () => {
    const viewer = fakeViewer();
    await seedTwoLayers(viewer);

    const result = await imageryRemove(viewer, { removeAll: true });

    expect(result).toEqual({ success: true });
    expect(viewer.imageryLayers.length).toBe(0);
  });

  test("resolves { success: false, error } when nothing matches", async () => {
    const viewer = fakeViewer();

    const result = await imageryRemove(viewer, { name: "missing" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No matching imagery layer");
  });
});

describe("imageryList", () => {
  test("lists index/name/show, and includes alpha only when includeDetails is set", async () => {
    const viewer = fakeViewer();
    await addLayer(viewer, "A", { alpha: 0.3 });

    const plain = await imageryList(viewer, {});
    expect(plain).toEqual({ success: true, layers: [{ index: 0, name: "A", show: true }] });

    const detailed = await imageryList(viewer, { includeDetails: true });
    expect(detailed).toEqual({
      success: true,
      layers: [{ index: 0, name: "A", show: true, alpha: 0.3 }],
    });
  });

  test("resolves { success: false, error } for malformed args", async () => {
    const viewer = fakeViewer();

    const result = await imageryList(viewer, { includeDetails: "yes" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid imageryList arguments");
  });
});
