import { describe, expect, it } from "vitest";
import { matchBestSkills, matchSkillsForIntent } from "./domain-matcher.js";
import type { CesiumSkill } from "./skills-loader.js";

function makeSkill(name: string, description: string, body = "body"): CesiumSkill {
  return { name, description, body, filePath: `${name}.SKILL.md` };
}

const cameraSkill = makeSkill(
  "cesiumjs-camera",
  "CesiumJS camera control - Camera, flyTo, lookAt, setView, ScreenSpaceCameraController, CameraEventAggregator, flight animation. Use when positioning the camera, creating flyTo animations, constraining user navigation, tracking entities, or converting between screen and world coordinates.",
);

const entitiesSkill = makeSkill(
  "cesiumjs-entities",
  "CesiumJS entities and data sources - Entity, EntityCollection, DataSource, GeoJsonDataSource, KmlDataSource, CzmlDataSource, Graphics types, Visualizers. Use when adding points, labels, models, polygons, or polylines to the map, loading GeoJSON/KML/CZML/GPX data, or working with the high-level Entity API.",
);

const imagerySkill = makeSkill(
  "cesiumjs-imagery",
  "CesiumJS imagery layers - ImageryProvider, ImageryLayer, ImageryLayerCollection, WMS, WMTS, Bing, OpenStreetMap, ArcGIS, Mapbox, tile discard policies. Use when adding or swapping base map layers, configuring imagery providers, layering multiple map sources, or creating split-screen imagery comparisons.",
);

const testSkills = [cameraSkill, entitiesSkill, imagerySkill];

describe("matchSkillsForIntent", () => {
  it("matches a camera-related intent to the camera skill", () => {
    const matches = matchSkillsForIntent(
      "fly the camera to Paris with a smooth flyTo animation",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("cesiumjs-camera");
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it("matches an entities-related intent to the entities skill", () => {
    const matches = matchSkillsForIntent("add a GeoJSON polygon entity to the map", testSkills);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("cesiumjs-entities");
  });

  it("returns matches sorted by descending score", () => {
    const matches = matchSkillsForIntent(
      "load GeoJSON points and fly the camera to view them",
      testSkills,
    );

    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it("scores zero everywhere for an intent that matches nothing", () => {
    const matches = matchSkillsForIntent("compute the fibonacci sequence in python", testSkills);
    expect(matches).toEqual([]);
  });

  it("doesn't crash on intent words that collide with Object.prototype property names (regression: 'constructor' resolved COMPOUND_TERM_ALIASES['constructor'] to the inherited Object constructor function instead of undefined, and calling .includes on it threw)", () => {
    expect(() =>
      matchSkillsForIntent(
        "use the Viewer constructor's toString and hasOwnProperty options",
        testSkills,
      ),
    ).not.toThrow();
  });
});

describe("matchBestSkills", () => {
  it("returns the top-matching skills in relevance order", () => {
    const best = matchBestSkills("position the camera with setView", 3, 1.0, testSkills);
    expect(best).toHaveLength(1);
    expect(best[0].name).toBe("cesiumjs-camera");
  });

  it("returns multiple skills when several match the intent", () => {
    const best = matchBestSkills(
      "load GeoJSON data and fly the camera to view it",
      3,
      1.0,
      testSkills,
    );
    expect(best.length).toBeGreaterThan(0);
    expect(best.length).toBeLessThanOrEqual(3);
    // Camera should be top match or high-ranked since intent mentions flyTo
    expect(best[0].name).toBe("cesiumjs-camera");
  });

  it("returns empty array when nothing scores above the threshold", () => {
    const best = matchBestSkills("write a sorting algorithm in rust", 3, 1.0, testSkills);
    expect(best).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const best = matchBestSkills(
      "load GeoJSON data and fly the camera to view it",
      2,
      1.0,
      testSkills,
    );
    expect(best.length).toBeLessThanOrEqual(2);
  });

  it("respects the threshold parameter, filtering out low-scoring matches", () => {
    // High threshold: only the strongest match
    const highThreshold = matchBestSkills(
      "load GeoJSON data and fly the camera to view it",
      3,
      5.0,
      testSkills,
    );

    // Low threshold: more permissive
    const lowThreshold = matchBestSkills(
      "load GeoJSON data and fly the camera to view it",
      3,
      0.1,
      testSkills,
    );

    // High threshold should return fewer or equal results
    expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
  });

  it("allows disabling threshold filtering with threshold=0", () => {
    const noFilter = matchBestSkills("position the camera", 3, 0, testSkills);
    const withFilter = matchBestSkills("position the camera", 3, 1.0, testSkills);

    // No filter should return at least as many results
    expect(noFilter.length).toBeGreaterThanOrEqual(withFilter.length);
  });
});
