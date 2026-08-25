import { describe, expect, it } from "vitest";
import { buildCzmlPrompt } from "./prompt-builder.js";
import { CZML_REFERENCE } from "./czml-reference.js";
import type { CzmlSkill } from "./skills-loader.js";

describe("buildCzmlPrompt", () => {
  it("includes the intent and the core CZML reference material", () => {
    const prompt = buildCzmlPrompt({ intent: "animate a satellite orbit over Europe" });

    expect(prompt).toContain("animate a satellite orbit over Europe");
    expect(prompt).toContain(CZML_REFERENCE);
  });

  it("appends extra instructions when supplied", () => {
    const prompt = buildCzmlPrompt({
      intent: "show a flight path",
      extraInstructions: "Always use metric units.",
    });

    expect(prompt).toContain("Always use metric units.");
  });

  it("omits the extra-instructions section when not supplied", () => {
    const prompt = buildCzmlPrompt({ intent: "show a flight path" });

    expect(prompt).not.toContain("Additional instructions from the host application");
  });

  it("inlines matched skill bodies when supplied", () => {
    const skill: CzmlSkill = {
      name: "czml-orientation",
      description: "orientation skill",
      body: "## CZML Orientation\n\nUse unitQuaternion for a fixed orientation.",
      filePath: "czml-orientation/SKILL.md",
    };

    const prompt = buildCzmlPrompt({ intent: "orient the entity", skills: [skill] });

    expect(prompt).toContain("Use unitQuaternion for a fixed orientation.");
  });

  it("omits the matched-skills section when no skills are supplied", () => {
    const prompt = buildCzmlPrompt({ intent: "show a flight path" });

    expect(prompt).not.toContain("Additional reference material for this intent");
  });

  it("requires an explicitly requested 3D model instead of a fallback graphic", () => {
    const prompt = buildCzmlPrompt({ intent: "Place a 3D humanoid model" });

    expect(prompt).toContain(
      'when the intent explicitly asks for a 3D model, include a "model" with "gltf"',
    );
    expect(prompt).toContain("do not replace it with a point, label, path, or geometric primitive");
  });

  it("forbids inventing scene choices omitted from the intent", () => {
    const prompt = buildCzmlPrompt({ intent: "animate a satellite" });

    expect(prompt).toContain(
      "Do not invent, estimate, or silently choose unspecified locations, times, durations",
    );
    expect(prompt).toContain("Do not add optional styling or behavior the intent did not request");
  });
});
