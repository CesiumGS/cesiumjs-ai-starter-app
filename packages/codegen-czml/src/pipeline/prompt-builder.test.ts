import { describe, expect, it } from "vitest";
import { buildCzmlPrompt } from "./prompt-builder.js";
import { CZML_REFERENCE } from "./czml-reference.js";

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

  it("lists available skill names/descriptions (but not bodies) when supplied", () => {
    const prompt = buildCzmlPrompt({
      intent: "orient the entity",
      availableSkills: [{ name: "czml-orientation", description: "orientation skill" }],
    });

    expect(prompt).toContain("czml-orientation: orientation skill");
    expect(prompt).toContain("loadSkill");
  });

  it("omits the skill catalog section when no skills are supplied", () => {
    const prompt = buildCzmlPrompt({ intent: "show a flight path" });

    expect(prompt).not.toContain("Additional feature-domain reference material");
  });
});
