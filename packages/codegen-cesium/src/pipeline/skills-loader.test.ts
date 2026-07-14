import { describe, expect, it } from "vitest";
import { loadCesiumSkills } from "./skills-loader.js";

describe("loadCesiumSkills", () => {
  it("parses frontmatter (name, description) and body for every SKILL.md file in the package", () => {
    const skills = loadCesiumSkills();

    expect(skills.length).toBeGreaterThanOrEqual(14);

    for (const skill of skills) {
      expect(skill.name).toMatch(/^cesiumjs-[a-z0-9-]+$/);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.body.length).toBeGreaterThan(0);
      expect(skill.filePath).toMatch(/SKILL\.md$/);
      // Frontmatter delimiters should not leak into the parsed fields.
      expect(skill.description).not.toContain("---");
      expect(skill.body).not.toMatch(/^---/);
    }
  });

  it("includes the expected camera and entities skills with their trigger descriptions", () => {
    const skills = loadCesiumSkills();

    const camera = skills.find((s) => s.name === "cesiumjs-camera");
    expect(camera).toBeDefined();
    expect(camera?.description).toContain("flyTo");
    expect(camera?.body).toContain("Camera");

    const entities = skills.find((s) => s.name === "cesiumjs-entities");
    expect(entities).toBeDefined();
    expect(entities?.description).toContain("GeoJSON");
  });

  it("caches the result across calls (returns the same array instance)", () => {
    const first = loadCesiumSkills();
    const second = loadCesiumSkills();
    expect(first).toBe(second);
  });
});
