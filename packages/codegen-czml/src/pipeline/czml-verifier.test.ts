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

  // The packets below are copied verbatim (or with a minimal id/position added, noted per case)
  // from the official czml-writer example corpus (`Schema/Examples/*.json` on the `main` branch:
  // https://github.com/AnalyticalGraphicsInc/czml-writer/tree/main/Schema/Examples), to check the
  // verifier against real third-party CZML rather than only this repo's own hand-written fixtures.
  describe("against official czml-writer example packets", () => {
    it("verifies the Packet.json example verbatim (billboard + label + position facility)", async () => {
      const result = await verifyCzml([
        { id: "document", version: "1.0" },
        {
          id: "Facility/AGI",
          name: "AGI",
          availability: "2012-03-15T10:00:00Z/2012-03-16T10:00:00Z",
          description:
            "<p>Analytical Graphics, Inc. (AGI) develops commercial modeling and analysis software.</p>",
          billboard: {
            eyeOffset: { cartesian: [0, 0, 0] },
            horizontalOrigin: "CENTER",
            image:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACvSURBVDhPrZDRDcMgDAU9GqN0lIzijw6SUbJJygUeNQgSqepJTyH91LVVpwDdfxM3T9TSl1EXZvDwii471fivK73cBFFQNTT/d2KoGpfGOpSIkhUpgUMxq9DFEsWv4IXhly nhBFnZcFEEuYqbiUlNwWgMTdrZ3JbQFoEVG53rd8ztG9aPJMnBUQf/VFraBJeWnLS0RfjbKyLJA8FkT5seDYS1Qwyv8t0B/5C2ZmH2/eTGNNBgMmAAAAAElFTkSuQmCC",
            pixelOffset: { cartesian2: [0, 0] },
            scale: 1.5,
            show: true,
            verticalOrigin: "CENTER",
          },
          label: {
            fillColor: { rgba: [0, 255, 255, 255] },
            font: "11pt Lucida Console",
            horizontalOrigin: "LEFT",
            outlineColor: { rgba: [0, 0, 0, 255] },
            outlineWidth: 2,
            pixelOffset: { cartesian2: [12, 0] },
            show: true,
            style: "FILL_AND_OUTLINE",
            text: "AGI",
            verticalOrigin: "CENTER",
          },
          position: { cartesian: [1216469.9357990976, -4736121.71856379, 4081386.8856866374] },
        },
      ]);

      expect(result.verified).toBe(true);
      if (result.verified) expect(result.entityCount).toBe(1);
    });

    it("verifies the Billboard.json example's billboard block once given an id and position", async () => {
      const result = await verifyCzml([
        { id: "document", version: "1.0" },
        {
          id: "billboard-example",
          position: { cartesian: [1216469.9357990976, -4736121.71856379, 4081386.8856866374] },
          billboard: {
            image: [
              { interval: "2013-01-01T00:00:00Z/2013-01-01T01:00:00Z", uri: "image.png" },
              { interval: "2013-01-01T01:00:00Z/2013-01-01T02:00:00Z", uri: "image2.png" },
            ],
            scale: 1.0,
            pixelOffset: {
              epoch: "2013-01-01T00:00:00Z",
              cartesian2: [0.0, 1.0, 2.0, 1.0, 3.0, 4.0],
            },
            eyeOffset: { cartesian: [3.0, 4.0, 5.0] },
            rotation: 1.3,
            horizontalOrigin: "CENTER",
            verticalOrigin: "CENTER",
            color: { rgbaf: [1.0, 1.0, 1.0, 1.0] },
            alignedAxis: { cartesian: [1.0, 0.0, 0.0] },
            show: true,
            sizeInMeters: false,
            width: 10,
            height: 11,
            scaleByDistance: { nearFarScalar: [1.0, 2.0, 10000.0, 3.0] },
            translucencyByDistance: { nearFarScalar: [1.0, 1.0, 10000.0, 0.0] },
            pixelOffsetScaleByDistance: { nearFarScalar: [1.0, 20.0, 10000.0, 30.0] },
          },
        },
      ]);

      expect(result.verified).toBe(true);
      if (result.verified) expect(result.entityCount).toBe(1);
    });

    it("verifies a real time-dynamic satellite scene built from the TimeVaryingPosition.json, OrientationSampled.json and DocumentPacket.json examples", async () => {
      // Mirrors e2e/generate-czml-live.spec.ts's "satellite orbiting Earth" intent, but assembled
      // from genuine official examples instead of a model-generated document. Position and
      // orientation are merged into one packet per id, per this tool's own one-shot-generation
      // contract (`prompt-builder.ts`: "Every other packet MUST have a unique ... id") — unlike
      // real streaming CZML, this generator never emits multiple packets updating the same id.
      const result = await verifyCzml([
        {
          id: "document",
          name: "My Document",
          version: "1.0",
          clock: {
            interval: "2012-03-15T10:00:00Z/2012-03-16T10:00:00Z",
            currentTime: "2012-03-15T10:00:00Z",
            multiplier: 60,
            range: "LOOP_STOP",
            step: "SYSTEM_CLOCK_MULTIPLIER",
          },
        },
        {
          id: "InternationalSpaceStation",
          position: {
            interpolationAlgorithm: "LAGRANGE",
            interpolationDegree: 5,
            referenceFrame: "INERTIAL",
            epoch: "2012-05-02T12:00:00Z",
            cartesian: [
              0.0, -6668447.2211117, 1201886.45913705, 146789.427467256, 60.0, -6711432.84684144,
              919677.673492462, -214047.552431458, 90.0, -6721319.92231553, 776899.784034099,
              -394198.837519575, 150.0, -6717826.447064, 488820.628328182, -752924.980158179, 180.0,
              -6704450.41462847, 343851.784836767, -931084.800346031, 240.0, -6654518.44949696,
              52891.726433174, -1283967.69137678,
            ],
          },
          orientation: {
            interpolationAlgorithm: "LINEAR",
            interpolationDegree: 1,
            epoch: "2012-03-15T10:00:00Z",
            unitQuaternion: [
              0, 0.45652188368372576, -0.049580035995243577, -0.8819344359461565,
              0.10640131785324795, 300, 0.309688526062018, -0.0592870464529779, -0.945283886004075,
              0.0837641797515638, 600, 0.15524757622990795, -0.06613430791377527,
              -0.9841132393764626, 0.05518673278488507,
            ],
          },
        },
      ]);

      expect(result.verified).toBe(true);
      if (result.verified) expect(result.entityCount).toBe(1);
    });

    it("rejects the DeletePacket.json example reusing an id already used to create an entity", async () => {
      // The DeletePacket.json example is a legitimate *streaming*-CZML feature, but this tool only
      // ever generates a whole document in one shot (see prompt-builder.ts's "unique ... id" rule)
      // — the structural duplicate-id check intentionally rejects this combination.
      const result = await verifyCzml([
        { id: "document", version: "1.0" },
        {
          id: "My Object",
          position: { cartographicDegrees: [0, 0, 0] },
          point: { pixelSize: 8 },
        },
        { id: "My Object", delete: true },
      ]);

      expect(result.verified).toBe(false);
      if (!result.verified) {
        expect(result.violations.join(" ")).toMatch(/duplicate/i);
      }
    });
  });
});
