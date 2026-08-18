import { describe, expect, it } from "vitest";
import { verifyCzml } from "./czml-verifier.js";

const MINIMAL_VALID_CZML = [
  { id: "document", version: "1.0" },
  {
    id: "pt-1",
    position: { cartographicDegrees: [0, 0, 0] },
    point: { pixelSize: 8, color: { rgba: [255, 255, 0, 255] } },
  },
];

describe("verifyCzml", () => {
  it("verifies a minimal valid CZML document and counts entities (excluding the document packet)", async () => {
    const result = await verifyCzml(MINIMAL_VALID_CZML);

    expect(result).toEqual({ verified: true, entityCount: 1 });
  });

  it("verifies a static flight-path document (polyline + label) with two entities", async () => {
    const result = await verifyCzml([
      { id: "document", version: "1.0" },
      {
        id: "route",
        polyline: {
          positions: { cartographicDegrees: [-0.4543, 51.47, 0, 139.7798, 35.5494, 0] },
          material: { solidColor: { color: { rgba: [0, 191, 255, 200] } } },
          width: 3,
        },
      },
      {
        id: "destination",
        position: { cartographicDegrees: [139.7798, 35.5494, 0] },
        label: { text: "Tokyo", font: "14px sans-serif" },
      },
    ]);

    expect(result).toEqual({ verified: true, entityCount: 2 });
  });

  it("rejects a document missing the leading document packet", async () => {
    const result = await verifyCzml([{ id: "pt-1", point: { pixelSize: 8 } }]);

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.violations.join(" ")).toMatch(/document packet/i);
    }
  });

  it("rejects an empty packet array", async () => {
    const result = await verifyCzml([]);

    expect(result.verified).toBe(false);
  });

  it("rejects duplicate non-document packet ids", async () => {
    const result = await verifyCzml([
      { id: "document", version: "1.0" },
      { id: "dup", point: { pixelSize: 1 }, position: { cartographicDegrees: [0, 0, 0] } },
      { id: "dup", point: { pixelSize: 2 }, position: { cartographicDegrees: [1, 1, 0] } },
    ]);

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.violations.join(" ")).toMatch(/duplicate/i);
    }
  });

  it("rejects a packet array exceeding maxPackets", async () => {
    const result = await verifyCzml(MINIMAL_VALID_CZML, { maxPackets: 1 });

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.violations.join(" ")).toMatch(/packet limit/i);
    }
  });

  it("rejects a document exceeding maxLength", async () => {
    const result = await verifyCzml(MINIMAL_VALID_CZML, { maxLength: 10 });

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.violations.join(" ")).toMatch(/size limit/i);
    }
  });

  it("rejects a non-array input", async () => {
    const result = await verifyCzml({ id: "document" });

    expect(result.verified).toBe(false);
  });
});
