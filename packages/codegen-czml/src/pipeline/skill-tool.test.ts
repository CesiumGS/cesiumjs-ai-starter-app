import { describe, expect, it, vi } from "vitest";
import { createLoadSkillTool } from "./skill-tool.js";
import type { CzmlSkill } from "./skills-loader.js";

const SKILLS: CzmlSkill[] = [
  {
    name: "czml-orientation",
    description: "orientation skill",
    body: "## CZML Orientation\n\nUse unitQuaternion for a fixed orientation.",
    filePath: "czml-orientation/SKILL.md",
  },
  {
    name: "czml-polyline",
    description: "polyline skill",
    body: "## CZML Polyline\n\nUse polyline.positions.cartographicDegrees.",
    filePath: "czml-polyline/SKILL.md",
  },
];

describe("createLoadSkillTool", () => {
  it("returns the matching skill's body and invokes onSkillLoaded", async () => {
    const onSkillLoaded = vi.fn();
    const loadSkill = createLoadSkillTool(SKILLS, onSkillLoaded);

    const output = await loadSkill.execute?.({ name: "czml-polyline" }, {} as never);

    expect(output).toContain("polyline.positions.cartographicDegrees");
    expect(onSkillLoaded).toHaveBeenCalledWith("czml-polyline");
  });

  it("returns an error string (not a throw) and skips onSkillLoaded for an unknown name", async () => {
    const onSkillLoaded = vi.fn();
    const loadSkill = createLoadSkillTool(SKILLS, onSkillLoaded);

    const output = await loadSkill.execute?.({ name: "czml-nonexistent" }, {} as never);

    expect(output).toContain('No skill named "czml-nonexistent" found');
    expect(output).toContain("czml-orientation, czml-polyline");
    expect(onSkillLoaded).not.toHaveBeenCalled();
  });

  it("works without an onSkillLoaded callback", async () => {
    const loadSkill = createLoadSkillTool(SKILLS);

    const output = await loadSkill.execute?.({ name: "czml-orientation" }, {} as never);

    expect(output).toContain("unitQuaternion");
  });
});
