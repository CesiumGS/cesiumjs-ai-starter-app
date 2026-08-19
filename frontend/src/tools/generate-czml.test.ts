import { describe, expect, it } from "vitest";
import type { Viewer } from "cesium";
import { handleGenerateCzmlResult, loadGeneratedCzml } from "./generate-czml";

function fakeViewer(): Viewer {
  return {
    dataSources: {
      add: async (dataSource: unknown) => dataSource,
    },
  } as unknown as Viewer;
}

const VALID_CZML = [
  { id: "document", version: "1.0" },
  { id: "pt-1", position: { cartographicDegrees: [0, 0, 0] }, point: { pixelSize: 8 } },
];

describe("loadGeneratedCzml", () => {
  it("loads a valid CZML document and returns the entity count", async () => {
    const outcome = await loadGeneratedCzml(fakeViewer(), VALID_CZML);

    expect(outcome).toEqual({ success: true, entityCount: 1 });
  });

  it("returns a structured error instead of throwing for CZML CzmlDataSource rejects", async () => {
    const outcome = await loadGeneratedCzml(fakeViewer(), [
      { id: "document", version: "1.0" },
      { id: "pt-1", position: { cartographicDegrees: "not-an-array" } },
    ]);

    expect(outcome.success).toBe(false);
  });
});

describe("handleGenerateCzmlResult", () => {
  it("returns { success: false } for output matching neither result shape", async () => {
    const outcome = await handleGenerateCzmlResult(fakeViewer(), {});
    expect(outcome).toEqual({ success: false, error: "Malformed generateCzml result." });
  });

  it("returns the tool's own error without touching the viewer", async () => {
    const outcome = await handleGenerateCzmlResult(fakeViewer(), {
      error: "Generated CZML failed verification after all attempts.",
    });
    expect(outcome).toEqual({
      success: false,
      error: "Generated CZML failed verification after all attempts.",
    });
  });

  it("returns an error when the viewer is not initialised", async () => {
    const outcome = await handleGenerateCzmlResult(null, {
      czml: VALID_CZML,
      description: "one marker",
    });
    expect(outcome).toEqual({ success: false, error: "CesiumJS Viewer is not initialised" });
  });

  it("loads a valid result into the viewer", async () => {
    const outcome = await handleGenerateCzmlResult(fakeViewer(), {
      czml: VALID_CZML,
      description: "one marker",
    });
    expect(outcome).toEqual({ success: true, entityCount: 1 });
  });
});
