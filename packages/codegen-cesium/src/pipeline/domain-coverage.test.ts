/**
 * Integration tests that exercise the codegen pipeline against the REAL vendored
 * `@cesium/cesiumjs-skills` package data (all 14 domain skills), rather than the small
 * hand-written fixture skills used by the other unit test files in this directory.
 *
 * These tests guard against regressions where the pipeline's individual units pass in isolation
 * (against fixtures) but drift apart from the real vendored data — e.g. a domain being renamed in
 * `SKILL.md` frontmatter, or a domain's description losing the keywords needed for
 * `matchSkillsForIntent` to route to it correctly.
 */
import { describe, expect, it } from "vitest";
import { loadCesiumSkills } from "./skills-loader.js";
import { matchSkillsForIntent } from "./domain-matcher.js";
import { buildCodegenPrompt } from "./prompt-builder.js";

/** All 14 domain skill names currently shipped by `@cesium/cesiumjs-skills` (excludes the
 * non-domain `using-cesiumjs-skills` bootstrap skill, which `loadCesiumSkills` already filters out). */
const ALL_DOMAINS = [
  "cesiumjs-3d-tiles",
  "cesiumjs-camera",
  "cesiumjs-core-utilities",
  "cesiumjs-custom-shader",
  "cesiumjs-entities",
  "cesiumjs-imagery",
  "cesiumjs-interaction",
  "cesiumjs-materials-shaders",
  "cesiumjs-models-particles",
  "cesiumjs-primitives",
  "cesiumjs-spatial-math",
  "cesiumjs-terrain-environment",
  "cesiumjs-time-properties",
  "cesiumjs-viewer-setup",
] as const;

/**
 * One representative natural-language intent per domain, deliberately phrased using the same
 * vocabulary as that domain's `SKILL.md` description so a correctly-tuned BM25 match routes it to
 * the right skill.
 */
const REPRESENTATIVE_INTENTS: Record<(typeof ALL_DOMAINS)[number], string> = {
  "cesiumjs-3d-tiles":
    "load a Cesium3DTileset and style building features by querying metadata properties",
  "cesiumjs-camera": "fly the camera to Paris with a flyTo animation using setView",
  "cesiumjs-core-utilities":
    "fetch remote data with a Resource and handle request errors using RequestScheduler",
  "cesiumjs-custom-shader":
    "write a CustomShader vertexShaderText for a VertexInput reading EXT_mesh_features metadata",
  "cesiumjs-entities": "add a GeoJSON polygon entity with labels using the high-level Entity API",
  "cesiumjs-imagery": "add a WMS imagery layer as a base map using an ImageryProvider",
  "cesiumjs-interaction":
    "handle mouse clicks on the globe using ScreenSpaceEventHandler to pick entities",
  "cesiumjs-materials-shaders":
    "define a Fabric material and add a PostProcessStage bloom post-processing effect",
  "cesiumjs-models-particles":
    "load a glTF Model and play a ModelAnimation together with a ParticleSystem for fire",
  "cesiumjs-primitives":
    "render GeoJSON as ground primitives using Primitive and GeometryInstance for performance",
  "cesiumjs-spatial-math":
    "convert between Cartesian3 and Cartographic coordinates using Transforms and Ellipsoid",
  "cesiumjs-terrain-environment":
    "configure a TerrainProvider and sample terrain heights, adjusting atmosphere and lighting",
  "cesiumjs-time-properties":
    "make entity position time-dynamic using a SampledProperty and Clock interpolation",
  "cesiumjs-viewer-setup":
    "initialize a CesiumJS Viewer widget with an Ion access token and SceneMode",
};

describe("domain coverage — real vendored skills package", () => {
  it("ships exactly the 14 expected domain skills (catches silent add/remove/rename)", () => {
    const skills = loadCesiumSkills();
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual([...ALL_DOMAINS].sort());
  });

  it.each(ALL_DOMAINS)("routes a %s-flavored intent to its matching skill", (domain) => {
    const intent = REPRESENTATIVE_INTENTS[domain];
    const matches = matchSkillsForIntent(intent, loadCesiumSkills());

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe(domain);
  });

  it("builds a grounded prompt for a non-camera domain (terrain) using real skill content", () => {
    const skills = loadCesiumSkills();
    const matches = matchSkillsForIntent(REPRESENTATIVE_INTENTS["cesiumjs-terrain-environment"], skills);
    expect(matches[0].skill.name).toBe("cesiumjs-terrain-environment");

    const prompt = buildCodegenPrompt({
      intent: REPRESENTATIVE_INTENTS["cesiumjs-terrain-environment"],
      skills: matches.map((m) => m.skill),
    });

    expect(prompt).toContain("TerrainProvider");
    expect(prompt.toLowerCase()).not.toContain("customshader");
  });
});
