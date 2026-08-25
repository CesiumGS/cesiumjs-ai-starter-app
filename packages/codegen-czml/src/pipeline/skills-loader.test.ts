import { describe, expect, it } from "vitest";
import { loadCzmlSkills } from "./skills-loader.js";

describe("loadCzmlSkills", () => {
  it("parses frontmatter (name, description) and body for every SKILL.md file in the package", () => {
    const skills = loadCzmlSkills();

    expect(skills.length).toBeGreaterThanOrEqual(7);

    for (const skill of skills) {
      expect(skill.name).toMatch(/^czml-[a-z0-9-]+$/);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.body.length).toBeGreaterThan(0);
      expect(skill.filePath).toMatch(/SKILL\.md$/);
      expect(skill.description).not.toContain("---");
      expect(skill.body).not.toMatch(/^---/);
    }
  });

  it("includes the expected orientation and clock skills with their trigger descriptions", () => {
    const skills = loadCzmlSkills();

    const orientation = skills.find((s) => s.name === "czml-orientation");
    expect(orientation).toBeDefined();
    expect(orientation?.description).toContain("unit quaternion");
    expect(orientation?.body).toContain("unitQuaternion");

    const clock = skills.find((s) => s.name === "czml-clock");
    expect(clock).toBeDefined();
    expect(clock?.description).toContain("clock");
    expect(clock?.body).toContain("LOOP_STOP");
  });

  it("caches the result across calls (returns the same array instance)", () => {
    const first = loadCzmlSkills();
    const second = loadCzmlSkills();
    expect(first).toBe(second);
  });
});
