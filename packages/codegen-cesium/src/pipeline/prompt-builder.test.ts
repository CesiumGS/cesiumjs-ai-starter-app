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
});
