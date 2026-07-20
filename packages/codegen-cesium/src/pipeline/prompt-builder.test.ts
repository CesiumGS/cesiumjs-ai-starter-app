import { describe, expect, it } from "vitest";
import { buildCodegenPrompt } from "./prompt-builder.js";
import type { CesiumSkill } from "./skills-loader.js";

const cameraSkill: CesiumSkill = {
  name: "cesiumjs-camera",
  description: "CesiumJS camera control - Camera, flyTo, lookAt, setView.",
  body: "## Camera Fundamentals\n\nAccess via `viewer.camera`. Use `camera.flyTo({ destination })` to animate.",
  filePath: "camera.SKILL.md",
};

const entitiesSkill: CesiumSkill = {
  name: "cesiumjs-entities",
  description: "CesiumJS entities and data sources.",
  body: "## Entities\n\nUse `viewer.entities.add(...)` to add points, labels, and polygons.",
  filePath: "entities.SKILL.md",
};

describe("buildCodegenPrompt", () => {
  it("includes the intent text and the matched skill's body content", () => {
    const intent = "fly the camera to Paris";
    const prompt = buildCodegenPrompt({ intent, skills: [cameraSkill, entitiesSkill] });

    expect(prompt).toContain(intent);
    expect(prompt).toContain("Camera Fundamentals");
    expect(prompt).toContain("camera.flyTo");
  });

  it("defaults maxSkills to 1, only inlining the top-matched skill's body", () => {
    const prompt = buildCodegenPrompt({
      intent: "fly the camera to Paris",
      skills: [cameraSkill, entitiesSkill],
    });

    expect(prompt).toContain("Camera Fundamentals");
    expect(prompt).not.toContain("viewer.entities.add");
  });

  it("inlines multiple skills when maxSkills is raised", () => {
    const prompt = buildCodegenPrompt({
      intent: "fly the camera to Paris and add a marker",
      skills: [cameraSkill, entitiesSkill],
      maxSkills: 2,
    });

    expect(prompt).toContain("Camera Fundamentals");
    expect(prompt).toContain("viewer.entities.add");
  });

  it("instructs the model to output only a bare JavaScript snippet", () => {
    const prompt = buildCodegenPrompt({ intent: "fly to Paris", skills: [cameraSkill] });

    expect(prompt.toLowerCase()).toContain("no markdown code fences");
    expect(prompt.toLowerCase()).toContain("only");
  });

  it("instructs the model to access CesiumJS symbols via `Cesium.` rather than as bare names (regression: generated code runs in a scope with only `viewer`/`Cesium` bound, not the bare class names shown in the reference material's `import` examples)", () => {
    const prompt = buildCodegenPrompt({ intent: "fly to Paris", skills: [cameraSkill] });

    expect(prompt).toContain("Cesium.Cartesian3.fromDegrees");
    expect(prompt).toContain("Do NOT write");
    expect(prompt.toLowerCase()).toContain("import");
  });

  it("warns that CesiumJS collections (PrimitiveCollection, ImageryLayerCollection, etc.) are not plain iterables (regression: a real model wrote `for...of viewer.scene.primitives`, which throws `TypeError: ... is not iterable` at runtime)", () => {
    const prompt = buildCodegenPrompt({ intent: "fly to Paris", skills: [cameraSkill] });

    expect(prompt).toContain("for...of");
    expect(prompt).toContain("PrimitiveCollection");
    expect(prompt).toContain(".get(index)");
  });

  it("instructs the model to await async Cesium results and avoid callbacks that outlive the VM", () => {
    const prompt = buildCodegenPrompt({ intent: "orbit around New York", skills: [cameraSkill] });

    expect(prompt).toContain("await");
    expect(prompt).toContain("createOsmBuildingsAsync");
    expect(prompt).toContain("setTimeout");
    expect(prompt).toContain("callbacks cannot outlive");
  });

  it('steers indexed array access (e.g. "the last entity") toward .at(...) instead of bracket indexing (regression: a real model reliably wrote `entities[entities.length - 1]`, which static verification always rejects as computed member access)', () => {
    const prompt = buildCodegenPrompt({
      intent: "make entity position time-dynamic",
      skills: [cameraSkill],
    });

    expect(prompt).toContain(".at(-1)");
    expect(prompt).toContain("array.length - 1");
  });

  describe("extraInstructions", () => {
    it("appends extraInstructions to the end of the prompt when provided", () => {
      const prompt = buildCodegenPrompt({
        intent: "fly to Paris",
        skills: [cameraSkill],
        extraInstructions: "Always use flat, non-3D-tiles styling for this app.",
      });

      expect(prompt).toContain("Additional instructions from the host application:");
      expect(prompt).toContain("Always use flat, non-3D-tiles styling for this app.");
    });

    it("does not add an extra-instructions section when omitted", () => {
      const prompt = buildCodegenPrompt({ intent: "fly to Paris", skills: [cameraSkill] });

      expect(prompt).not.toContain("Additional instructions from the host application:");
    });

    it("does not add an extra-instructions section when blank/whitespace-only", () => {
      const prompt = buildCodegenPrompt({
        intent: "fly to Paris",
        skills: [cameraSkill],
        extraInstructions: "   ",
      });

      expect(prompt).not.toContain("Additional instructions from the host application:");
    });
  });
});
