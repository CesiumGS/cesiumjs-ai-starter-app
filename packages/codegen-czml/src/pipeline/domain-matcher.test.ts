import { describe, expect, it } from "vitest";
import { matchBestSkills, matchSkillsForIntent } from "./domain-matcher.js";
import type { CzmlSkill } from "./skills-loader.js";

function makeSkill(name: string, description: string, body = "body"): CzmlSkill {
  return { name, description, body, filePath: `${name}.SKILL.md` };
}

const clockSkill = makeSkill(
  "czml-clock",
  "CZML document-level clock controlling the viewer's timeline: start/stop interval, current time, playback multiplier, and looping behavior. Use when the intent mentions a clock, timeline, playback speed, looping, or specific start/stop times for the whole scene.",
);

const orientationSkill = makeSkill(
  "czml-orientation",
  "CZML entity orientation as unit quaternions, both a single fixed orientation and orientation sampled over time. Use when the intent describes an entity's heading, facing direction, attitude, 3D rotation, or orientation that changes over time.",
);

const polygonSkill = makeSkill(
  "czml-polygon",
  "CZML filled polygons for regions, areas of interest, footprints, and closed shapes on the ground. Use when the intent describes an area, region, zone, footprint, or filled shape bounded by several corner points.",
);

const billboardLabelSkill = makeSkill(
  "czml-billboard-label",
  "CZML billboard icons and text labels for named ground facilities, markers, and pins. Use when the intent describes a named place, marker, icon, pin, waypoint, or a text label shown next to an entity.",
);

const cameraViewSkill = makeSkill(
  "czml-camera-view",
  "CZML viewFrom camera offset suggesting an initial tracking view relative to an entity. Use when the intent describes how the camera should look at, track, or view an entity from an offset distance or angle.",
);

const polylineSkill = makeSkill(
  "czml-polyline",
  "CZML static polylines for flight routes, boundaries, and fixed lines connecting two or more locations. Use when the intent describes a straight or multi-segment line, route, boundary, or connection between fixed points (not a moving entity).",
);

const motionSkill = makeSkill(
  "czml-time-dynamic-motion",
  "CZML time-dynamic motion: interpolated/sampled positions over an epoch and trails for orbiting, flying, or otherwise moving entities. Use when the intent describes an entity moving, orbiting, flying, or changing position over time (not a single static point).",
);

const testSkills = [
  clockSkill,
  orientationSkill,
  polygonSkill,
  billboardLabelSkill,
  cameraViewSkill,
  polylineSkill,
  motionSkill,
];

describe("matchSkillsForIntent", () => {
  it("matches a clock/timeline intent to the clock skill", () => {
    const matches = matchSkillsForIntent(
      "set up a document clock that loops with a 60x time multiplier",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-clock");
  });

  it("matches an orientation intent to the orientation skill", () => {
    const matches = matchSkillsForIntent(
      "give the entity a fixed unit quaternion orientation facing northeast",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-orientation");
  });

  it("returns matches sorted by descending score", () => {
    const matches = matchSkillsForIntent(
      "add a looping clock and orient the entity with a quaternion",
      testSkills,
    );

    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it("scores zero everywhere for an intent that matches nothing", () => {
    const matches = matchSkillsForIntent("compute the fibonacci sequence in python", testSkills);
    expect(matches).toHaveLength(testSkills.length);
    expect(matches.every((m) => m.score === 0)).toBe(true);
  });

  it("matches a named marker/icon intent to the billboard/label skill", () => {
    const matches = matchSkillsForIntent(
      "add a pin with an icon and a text label for the airport",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-billboard-label");
  });

  it("matches a camera tracking intent to the camera-view skill", () => {
    const matches = matchSkillsForIntent(
      "have the camera track the entity from an offset distance",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-camera-view");
  });

  it("matches a flight route intent to the polyline skill", () => {
    const matches = matchSkillsForIntent(
      "draw a straight flight route connecting two fixed points",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-polyline");
  });

  it("matches an orbiting/moving entity intent to the time-dynamic-motion skill", () => {
    const matches = matchSkillsForIntent(
      "make the satellite orbit and change position over time",
      testSkills,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skill.name).toBe("czml-time-dynamic-motion");
  });

  it("is case-insensitive", () => {
    const lower = matchSkillsForIntent("add a filled polygon area of interest", testSkills);
    const upper = matchSkillsForIntent("ADD A FILLED POLYGON AREA OF INTEREST", testSkills);

    expect(upper[0].skill.name).toBe(lower[0].skill.name);
    expect(upper[0].score).toBeCloseTo(lower[0].score);
  });

  it("returns all skills scoring zero for an empty intent", () => {
    const matches = matchSkillsForIntent("", testSkills);
    expect(matches).toHaveLength(testSkills.length);
    expect(matches.every((m) => m.score === 0)).toBe(true);
  });

  it("returns an empty array when given an empty skill list", () => {
    const matches = matchSkillsForIntent("add a filled polygon", []);
    expect(matches).toEqual([]);
  });

  it("scores multiple relevant skills above zero for an intent spanning several domains", () => {
    const matches = matchSkillsForIntent(
      "add a moving entity with a text label that the camera tracks from an offset",
      testSkills,
    );

    const nonZero = matches.filter((m) => m.score > 0).map((m) => m.skill.name);
    expect(nonZero).toEqual(
      expect.arrayContaining([
        "czml-time-dynamic-motion",
        "czml-billboard-label",
        "czml-camera-view",
      ]),
    );
  });
});

describe("matchBestSkills", () => {
  it("returns the top-matching skill in relevance order", () => {
    const best = matchBestSkills("draw a filled polygon area of interest", 3, 0.5, testSkills);
    expect(best.length).toBeGreaterThan(0);
    expect(best[0].name).toBe("czml-polygon");
  });

  it("returns empty array when nothing scores above the threshold", () => {
    const best = matchBestSkills("write a sorting algorithm in rust", 3, 0.5, testSkills);
    expect(best).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const best = matchBestSkills(
      "add a looping document clock and orient the entity with a quaternion",
      1,
      0.5,
      testSkills,
    );
    expect(best.length).toBeLessThanOrEqual(1);
  });

  it("returns an empty array when limit is 0", () => {
    const best = matchBestSkills("add a filled polygon area of interest", 0, 0.5, testSkills);
    expect(best).toEqual([]);
  });

  it("disables filtering when threshold is 0, including weak/unrelated matches", () => {
    const best = matchBestSkills(
      "compute the fibonacci sequence in python",
      testSkills.length,
      0,
      testSkills,
    );
    expect(best).toHaveLength(testSkills.length);
  });

  it("returns fewer than limit when fewer skills score above the threshold", () => {
    const best = matchBestSkills(
      "draw a filled polygon area of interest",
      testSkills.length,
      0.5,
      testSkills,
    );
    expect(best.length).toBeGreaterThan(0);
    expect(best.length).toBeLessThan(testSkills.length);
  });

  it("returns an empty array when given an empty skill list", () => {
    const best = matchBestSkills("add a filled polygon", 3, 0.5, []);
    expect(best).toEqual([]);
  });
});
