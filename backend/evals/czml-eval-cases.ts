/**
 * Eval cases for `eval-czml-generation.ts`. Each case is a natural-language intent designed to
 * require the same CZML feature(s) demonstrated by one or more official czml-writer example
 * packets (`Schema/Examples/*.json` on
 * https://github.com/AnalyticalGraphicsInc/czml-writer/tree/main/Schema/Examples), so a pass here
 * is real evidence the `generateVerifiedCzml` pipeline can reproduce that feature from a plain
 * intent, not just that hand-written CZML for it happens to verify (already covered by
 * `czml-verifier.test.ts`).
 *
 * `expectedProperties` is a light per-case heuristic — dot-paths (into any non-document packet)
 * that should exist in the generated document for the case to count as a *meaningful* pass, not
 * just "the model produced some unrelated-but-valid CZML". This is deliberately loose (existence,
 * not value, checks): the model has latitude in how it satisfies an intent.
 */

export interface CzmlEvalCase {
  /** Short unique name for reporting. */
  name: string;
  /** The official example(s) this case's feature coverage is modeled after. */
  referenceExamples: string[];
  /** The natural-language intent passed to `generateVerifiedCzml`. */
  intent: string;
  /** Dot-paths that must exist on at least one non-document packet in the generated document. */
  expectedProperties: string[];
}

const CZML_WRITER_EXAMPLES_BASE =
  "https://github.com/AnalyticalGraphicsInc/czml-writer/blob/main/Schema/Examples";

/** Builds the reference example's `html_url` from a bare filename, for report readability. */
export function exampleUrl(filename: string): string {
  return `${CZML_WRITER_EXAMPLES_BASE}/${filename}`;
}

export const CZML_EVAL_CASES: CzmlEvalCase[] = [
  {
    name: "billboard-and-label-facility",
    referenceExamples: ["Packet.json", "Billboard.json"],
    intent:
      "Place a single ground facility named 'AGI Headquarters' at longitude -75.596, latitude 40.038, " +
      "height 0 meters, shown as a billboard icon with a text label reading 'AGI HQ' next to it.",
    expectedProperties: ["billboard", "label", "position"],
  },
  {
    name: "clock-driven-point",
    referenceExamples: ["Clock.json", "DocumentPacket.json"],
    intent:
      "Create a scene with a document clock that runs from 2024-01-01T00:00:00Z to 2024-01-02T00:00:00Z, " +
      "starting at the beginning of that interval with a 60x time multiplier, looping when it reaches the " +
      "end, and a single stationary point at longitude 10, latitude 20.",
    expectedProperties: ["clock", "point", "position"],
  },
  {
    name: "static-flight-route-polyline",
    referenceExamples: ["SimplePosition.json", "PositionCartographicDegrees.json"],
    intent:
      "Draw a static flight route as a polyline from London (-0.4543, 51.47) to Tokyo (139.7798, 35.5494), " +
      "both at ground level, with a label at the Tokyo end reading 'Tokyo'.",
    expectedProperties: ["polyline", "position"],
  },
  {
    name: "time-varying-satellite-position",
    referenceExamples: ["TimeVaryingPosition.json", "DocumentPacket.json"],
    intent:
      "Create a time-dynamic scene of a satellite named 'ISS' orbiting Earth once every 90 minutes over " +
      "the next 3 hours, starting 2024-06-01T00:00:00Z, using an interpolated cartesian position sampled " +
      "at regular intervals across the interval (not a single static point).",
    expectedProperties: ["position.epoch", "position.cartesian"],
  },
  {
    name: "static-orientation",
    referenceExamples: ["Orientation.json"],
    intent:
      "Place a single entity at longitude -75, latitude 40 with a fixed unit-quaternion orientation " +
      "so it faces northeast, and a point graphic marking its location.",
    expectedProperties: ["orientation", "position"],
  },
  {
    name: "sampled-orientation-over-time",
    referenceExamples: ["OrientationSampled.json", "TimeVaryingPosition.json"],
    intent:
      "Create a time-dynamic entity named 'InternationalSpaceStation' whose orientation is sampled at " +
      "several times across 2012-03-15T10:00:00Z/2012-03-16T10:00:00Z as unit quaternions (not a single " +
      "static orientation), alongside a time-varying cartesian position over the same interval.",
    expectedProperties: ["orientation.epoch", "orientation.unitQuaternion", "position.epoch"],
  },
  {
    name: "sampled-rotation",
    referenceExamples: ["Rotation.json", "RotationSampled.json"],
    intent:
      "Create an entity at longitude 0, latitude 0 whose 2D rotation angle is sampled over several times " +
      "across 2024-01-01T00:00:00Z/2024-01-01T01:00:00Z (not a single static rotation value), shown as a " +
      "point graphic.",
    expectedProperties: ["position"],
  },
  {
    name: "camera-view-from-offset",
    referenceExamples: ["ViewFrom.json"],
    intent:
      "Place a point entity at longitude -75, latitude 40, height 0, and give it a fixed camera " +
      "viewFrom offset so a viewer tracking this entity looks at it from 20000 meters up and back.",
    expectedProperties: ["viewFrom", "position"],
  },
  {
    name: "document-metadata-and-clock",
    referenceExamples: ["DocumentPacket.json"],
    intent:
      "Create just the scene-level document metadata: name the document 'Vehicle Tracking', and set " +
      "its clock to interval 2012-03-15T10:00:00Z/2012-03-16T10:00:00Z, current time at the interval " +
      "start, a 60x multiplier, looping at the end, stepping by system clock multiplier. Also include one " +
      "point entity at longitude 5, latitude 15 so the document has visible content.",
    expectedProperties: ["clock", "point"],
  },
  {
    name: "polygon-area-of-interest",
    referenceExamples: ["PositionCartographicDegrees.json"],
    intent:
      "Draw a filled polygon area of interest over four corner points forming a small rectangle around " +
      "longitude -90 to -89.9, latitude 30 to 30.1, with a semi-transparent red fill.",
    expectedProperties: ["polygon"],
  },
];
