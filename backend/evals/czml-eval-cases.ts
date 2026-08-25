/**
 * Eval cases for `eval-czml-generation.ts`. Each case is a natural-language intent designed to
 * require the same CZML feature(s) demonstrated by one or more official czml-writer example
 * packets (`Schema/Examples/*.json` on
 * https://github.com/AnalyticalGraphicsInc/czml-writer/tree/main/Schema/Examples) or one of the
 * CZML-labeled demos in the Cesium Sandcastle gallery (https://sandcastle.cesium.com, "CZML"
 * filter), so a pass here is real evidence the `generateVerifiedCzml` pipeline can reproduce that
 * feature from a plain intent, not just that hand-written CZML for it happens to verify (already
 * covered by `czml-verifier.test.ts`).
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
  /** If set, the generated document must parse into at least this many distinct (non-document) entities — for cases whose intent explicitly asks for multiple separate objects, not just multiple properties on one object. */
  minEntityCount?: number;
}

const CZML_WRITER_EXAMPLES_BASE =
  "https://github.com/AnalyticalGraphicsInc/czml-writer/blob/main/Schema/Examples";

const SANDCASTLE_GALLERY_BASE = "https://sandcastle.cesium.com/gallery";

/**
 * Builds the reference example's URL for report readability. Accepts either a bare czml-writer
 * example filename (e.g. "Box.json") or an already-complete URL (e.g. one built by
 * {@link sandcastleUrl}), which is passed through unchanged.
 */
export function exampleUrl(filenameOrUrl: string): string {
  if (/^https?:\/\//.test(filenameOrUrl)) return filenameOrUrl;
  return `${CZML_WRITER_EXAMPLES_BASE}/${filenameOrUrl}`;
}

/** Builds a Cesium Sandcastle gallery demo's URL from its bare id (e.g. "czml-box"). */
export function sandcastleUrl(id: string): string {
  return `${SANDCASTLE_GALLERY_BASE}/${id}`;
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
  {
    name: "model-with-articulation",
    referenceExamples: ["Model.json", "Articulations.json", "ModelArticulations.json"],
    intent:
      "Place a 3D vehicle model at longitude -75, latitude 40, height 0, loaded from a glTF asset, " +
      "with one articulation stage named 'turret' and stage 'spin' that animates smoothly from 0 to " +
      "60 degrees over the first minute of the scene (not a single static articulation value).",
    expectedProperties: ["model.gltf", "model.articulations"],
  },
  {
    name: "model-with-node-transformation",
    referenceExamples: ["Model.json", "NodeTransformations.json", "ModelNodeTransformations.json"],
    intent:
      "Place a 3D crane model at longitude -75, latitude 40, height 0, loaded from a glTF asset, with " +
      "a per-node transformation on a node named 'boom' that scales it by (1, 2, 3) and translates it " +
      "by (4, 5, 6) meters.",
    expectedProperties: ["model.gltf", "model.nodeTransformations"],
  },
  {
    name: "distance-based-visibility-and-scale",
    referenceExamples: [
      "NearFarScalarValueSamples.json",
      "DistanceDisplayConditionValueSamples.json",
    ],
    intent:
      "Place a billboard icon marker at longitude -75, latitude 40 that scales down the farther the " +
      "camera gets from it (near scale 2.0 at 150 meters, far scale 0.5 at 15,000,000 meters) and is " +
      "only shown while the camera is within 15,000,000 meters of it.",
    expectedProperties: ["billboard.scaleByDistance", "billboard.distanceDisplayCondition"],
  },
  {
    name: "cross-entity-position-reference",
    referenceExamples: ["ReferenceValue.json", "Packet.json"],
    intent:
      "Create two entities: 'LeadVehicle' with an explicit stationary position at longitude -75, " +
      "latitude 40, height 0, shown as a point; and 'ChaseCamera', a second point entity whose position " +
      "is not given directly but instead references LeadVehicle's position property via a CZML " +
      "reference string (so ChaseCamera always tracks LeadVehicle's position).",
    expectedProperties: ["position.reference"],
  },
  // The three cases below require the model to emit several distinct entities in one document
  // (checked via `minEntityCount`, not just `expectedProperties`) rather than one entity with
  // several properties \u2014 a different failure mode than the single-entity cases above (e.g. the
  // model merging everything into one packet, or dropping all but one requested object).
  {
    name: "multi-vehicle-fleet",
    referenceExamples: ["Billboard.json", "Label.json"],
    intent:
      "Create three separate ground vehicles named 'Alpha', 'Bravo', and 'Charlie' at three different " +
      "nearby positions (longitude -75.60/-75.61/-75.62, latitude 40.03/40.04/40.05, height 0), each " +
      "shown as its own billboard icon with a label showing its own name.",
    expectedProperties: ["billboard", "label", "position"],
    minEntityCount: 3,
  },
  {
    name: "mixed-scene-facility-route-satellite",
    referenceExamples: ["Billboard.json", "SimplePosition.json", "TimeVaryingPosition.json"],
    intent:
      "Build a scene containing three separate objects: a ground facility named 'Control Center' at " +
      "longitude -75, latitude 40 shown as a billboard icon with a label; a static flight route polyline " +
      "from longitude -74, latitude 41 to longitude -73, latitude 42; and a satellite named 'Sentinel-1' " +
      "whose cartesian position is time-varying (sampled at several times, not static) across " +
      "2024-01-01T00:00:00Z/2024-01-01T02:00:00Z.",
    expectedProperties: ["billboard", "polyline", "position.epoch"],
    minEntityCount: 3,
  },
  {
    name: "several-polygons-multiple-zones",
    referenceExamples: ["PositionCartographicDegrees.json"],
    intent:
      "Draw three separate filled polygon zones side by side: 'ZoneA' around longitude -90 to -89.9, " +
      "latitude 30 to 30.1 in semi-transparent red; 'ZoneB' around longitude -89.8 to -89.7, latitude " +
      "30 to 30.1 in semi-transparent green; and 'ZoneC' around longitude -89.6 to -89.5, latitude 30 " +
      "to 30.1 in semi-transparent blue.",
    expectedProperties: ["polygon"],
    minEntityCount: 3,
  },
  {
    name: "czml-3d-tiles-reference",
    referenceExamples: [sandcastleUrl("czml-3d-tiles")],
    intent:
      "Reference an existing 3D Tiles tileset named 'BatchedBuildings' by its tileset.json URI so it " +
      "loads as part of the CZML document, rather than embedding raw tile data directly.",
    expectedProperties: ["tileset.uri"],
  },
  {
    name: "czml-billboard-label-with-description",
    referenceExamples: [sandcastleUrl("czml-billboard-and-label")],
    intent:
      "Place a single entity named 'Data Center' at longitude -75.596, latitude 40.038 with a billboard " +
      "icon, a text label reading 'DC1' next to it, and an HTML description (e.g. a short paragraph with " +
      "a link) that appears when the entity's info-box is opened.",
    expectedProperties: ["billboard", "label", "description", "position"],
  },
  {
    name: "czml-box-shapes",
    referenceExamples: [sandcastleUrl("czml-box")],
    intent:
      "Create three separate box entities at different longitudes along latitude 40, all with dimensions " +
      "400000 by 300000 by 500000 meters: a solid blue box; a translucent red box with a black outline; " +
      "and a yellow wireframe-only box (no fill, outline only).",
    expectedProperties: ["box.dimensions", "box.material"],
    minEntityCount: 3,
  },
  {
    name: "czml-circles-and-ellipses-variants",
    referenceExamples: [sandcastleUrl("czml-circles-and-ellipses")],
    intent:
      "Create three separate ellipse entities: a green circle (equal semi-major and semi-minor axes) at " +
      "a fixed height; a red ellipse with a white outline sitting on the ground; and a blue translucent " +
      "ellipse that is both rotated and extruded up to a height.",
    expectedProperties: ["ellipse.semiMajorAxis", "ellipse.semiMinorAxis"],
    minEntityCount: 3,
  },
  {
    name: "czml-colors-rgba-rgbaf",
    referenceExamples: [sandcastleUrl("czml-colors")],
    intent:
      "Draw two filled, outlined rectangles side by side: one whose fill color is defined using 0-255 " +
      "integer RGBA components, and another whose fill color is defined using the 0-1 floating point " +
      "RGBAF representation instead.",
    expectedProperties: ["rectangle.material", "rectangle.outline"],
    minEntityCount: 2,
  },
  {
    name: "czml-cones-and-cylinders",
    referenceExamples: [sandcastleUrl("czml-cones-and-cylinders")],
    intent:
      "Create two separate entities above the ground: a green cylinder with a black outline, and a red " +
      "cone (a cylinder whose top radius is zero).",
    expectedProperties: ["cylinder.length", "cylinder.topRadius", "cylinder.bottomRadius"],
    minEntityCount: 2,
  },
  {
    name: "czml-corridor-corner-types",
    referenceExamples: [sandcastleUrl("czml-corridor")],
    intent:
      "Draw three separate corridor entities along different paths, one per corner type: a red corridor " +
      "on the surface with rounded corners; a green corridor at a fixed height with mitered corners and " +
      "an outline; and a blue extruded corridor with beveled corners and an outline.",
    expectedProperties: ["corridor.positions", "corridor.width", "corridor.cornerType"],
    minEntityCount: 3,
  },
  {
    name: "czml-custom-properties",
    referenceExamples: [sandcastleUrl("czml-custom-properties")],
    intent:
      "Create an entity with a custom 'population' property that is time-varying (either as discrete " +
      "time intervals or as values sampled across an epoch, not a single constant number), plus a " +
      "separate polygon entity representing a region whose extrudedHeight is meant to be driven by that " +
      "custom population property.",
    expectedProperties: ["properties", "polygon"],
    minEntityCount: 2,
  },
  {
    name: "czml-model-basic",
    referenceExamples: [sandcastleUrl("czml-model")],
    intent:
      "Place a 3D aircraft model at longitude -77, latitude 37, height 10000 meters, loaded from a glTF " +
      "asset, with a minimum pixel size so it stays visible when the camera zooms far out.",
    expectedProperties: ["model.gltf", "model.minimumPixelSize", "position"],
  },
  {
    name: "czml-model-node-rotation",
    referenceExamples: [sandcastleUrl("czml-model-node-transformations")],
    intent:
      "Place a 3D humanoid model with a per-node transformation on a named node (e.g. an arm joint) whose " +
      "rotation is a sampled unit-quaternion over time (not a single static rotation), and give the " +
      "entity a fixed camera viewFrom offset.",
    expectedProperties: ["model.gltf", "model.nodeTransformations", "viewFrom"],
  },
  {
    name: "czml-model-articulations-multi-stage",
    referenceExamples: [sandcastleUrl("czml-model-articulations")],
    intent:
      "Place a 3D rocket model with three separate named articulation stages (e.g. representing a " +
      "payload fairing opening, separating, and dropping away) that each animate over the first few " +
      "minutes of the scene, with at least one stage sampled at several irregular keyframes rather than " +
      "a single linear change.",
    expectedProperties: ["model.gltf", "model.articulations"],
  },
  {
    name: "czml-model-data-url",
    referenceExamples: [sandcastleUrl("czml-model-data-url")],
    intent:
      "Place a simple 3D cube model at longitude -77, latitude 37, height 10000 meters, where the glTF " +
      "model itself is embedded directly in the CZML as a base64 data URI rather than referencing an " +
      "external .glb file.",
    expectedProperties: ["model.gltf"],
  },
  {
    name: "czml-path-gps-track",
    referenceExamples: [sandcastleUrl("czml-path")],
    intent:
      "Create a scene of a hang-glider's flight track as a time-dynamic position sampled at several times " +
      "(not static) with a billboard icon marking the glider, and a path trail behind it using a " +
      "polylineOutline material with a short lead time and a long trail time so most of the flight " +
      "history stays visible.",
    expectedProperties: [
      "path.material",
      "path.leadTime",
      "path.trailTime",
      "position.epoch",
      "billboard",
    ],
  },
  {
    name: "czml-point-basic",
    referenceExamples: [sandcastleUrl("czml-point")],
    intent:
      "Place a single static point entity at longitude -111, latitude 40 with a white fill, a red outline " +
      "4 pixels wide, and a pixel size of 20.",
    expectedProperties: ["point.color", "point.outlineColor", "point.pixelSize", "position"],
  },
  {
    name: "czml-point-time-dynamic",
    referenceExamples: [sandcastleUrl("czml-point-time-dynamic")],
    intent:
      "Create a single point entity whose position is time-dynamic (sampled cartographicDegrees at " +
      "several times, not static) and bounded by an availability interval matching those samples.",
    expectedProperties: ["position.epoch", "point", "availability"],
  },
  {
    name: "czml-polygon-materials-and-holes",
    referenceExamples: [sandcastleUrl("czml-polygon")],
    intent:
      "Create four separate polygon entities: one filled solid red on the surface; one using a " +
      "checkerboard material; one green extruded polygon with open top and bottom faces (no caps); and " +
      "one polygon with per-position heights, an outline, and two holes cut out of it.",
    expectedProperties: ["polygon.material", "polygon.positions"],
    minEntityCount: 4,
  },
  {
    name: "czml-polygon-vertex-references",
    referenceExamples: [sandcastleUrl("czml-polygon-interpolating-references")],
    intent:
      "Create a polygon whose corner positions are not given directly but are instead CZML reference " +
      "strings pointing at three other entities' interpolated (LINEAR), time-varying positions, so the " +
      "polygon's shape changes over time as those referenced entities move.",
    expectedProperties: ["polygon.positions.references"],
  },
  {
    name: "czml-polygon-time-intervals",
    referenceExamples: [sandcastleUrl("czml-polygon-intervals-availability")],
    intent:
      "Create a polygon whose vertex positions change at distinct, non-overlapping time intervals (a " +
      "different fixed shape for each interval, not interpolated) and whose fill color also changes at a " +
      "different set of time intervals, all bounded by an overall availability window.",
    expectedProperties: ["polygon.positions", "availability"],
  },
  {
    name: "czml-polyline-materials",
    referenceExamples: [sandcastleUrl("czml-polyline")],
    intent:
      "Draw four separate polylines at different latitudes: one clamped to the ground in solid red; one " +
      "with a glowing blue polylineGlow material; one with a polylineOutline material (orange fill, black " +
      "outline); and one styled as a dashed line.",
    expectedProperties: ["polyline.material", "polyline.positions"],
    minEntityCount: 4,
  },
  {
    name: "czml-polyline-volume",
    referenceExamples: [sandcastleUrl("czml-polyline-volume")],
    intent:
      "Create a polyline volume entity that extrudes a 2D box cross-section shape along a 3D path with " +
      "beveled corners and an outline, giving the line actual thickness and volume rather than being an " +
      "infinitely thin line.",
    expectedProperties: ["polylineVolume.positions", "polylineVolume.shape"],
  },
  {
    name: "czml-position-definitions",
    referenceExamples: [sandcastleUrl("czml-position-definitions")],
    intent:
      "Create three separate point entities at the same real-world location represented three different " +
      "ways: one using cartographicDegrees, one using cartesian (ECEF meters), and one using " +
      "cartographicRadians.",
    expectedProperties: ["position"],
    minEntityCount: 3,
  },
  {
    name: "czml-rectangle-styles",
    referenceExamples: [sandcastleUrl("czml-rectangle")],
    intent:
      "Create three separate rectangle entities: an extruded red rectangle with a black outline; a " +
      "rectangle filled with alternating blue and green vertical stripes; and a rectangle with only a " +
      "yellow outline (no fill), rotated by 0.5 radians.",
    expectedProperties: ["rectangle.coordinates", "rectangle.material"],
    minEntityCount: 3,
  },
  {
    name: "czml-reference-properties-color",
    referenceExamples: [sandcastleUrl("czml-reference-properties")],
    intent:
      "Create three entities: one with an explicit stationary position; a second whose position " +
      "references the first entity's position via a CZML reference string instead of defining its own " +
      "coordinates; and a third polygon whose fill color references a property on one of the other " +
      "entities (e.g. a label's outline color) rather than defining its own color directly.",
    expectedProperties: ["position.reference", "polygon.material"],
    minEntityCount: 3,
  },
  {
    name: "czml-spheres-and-ellipsoids",
    referenceExamples: [sandcastleUrl("czml-spheres-and-ellipsoids")],
    intent:
      "Create three separate ellipsoid entities: a filled blue ellipsoid with unequal radii; a filled red " +
      "sphere (equal radii) with a black outline; and a yellow wireframe-only ellipsoid (no fill) with " +
      "custom slice and stack partition counts for a smoother outline.",
    expectedProperties: ["ellipsoid.radii"],
    minEntityCount: 3,
  },
  {
    name: "czml-wall",
    referenceExamples: [sandcastleUrl("czml-wall")],
    intent:
      "Draw a single translucent red wall entity that follows a zig-zag path of several longitude/latitude " +
      "points, where each point alternates between a high and low height so the wall's top edge rises and " +
      "falls along its length.",
    expectedProperties: ["wall.positions", "wall.material"],
  },
  {
    name: "czml-zindex-draw-order",
    referenceExamples: [sandcastleUrl("czml-zindex")],
    intent:
      "Create four overlapping ground-clamped shapes covering the same area — a circle, a corridor, a " +
      "polygon, and a striped rectangle — each given an explicit zIndex so their stacking/draw order is " +
      "controlled rather than left to default.",
    expectedProperties: ["zIndex"],
    minEntityCount: 4,
  },
  {
    name: "czml-multi-part-stream",
    referenceExamples: [sandcastleUrl("multi-part-czml")],
    intent:
      "Model a single vehicle entity named 'Vehicle' whose time-dynamic path is split into three " +
      "sequential, non-overlapping time-interval segments (as if delivered as separate CZML " +
      "packets/streams) covering the full mission duration, plus a custom time-varying " +
      "'fuel_remaining' property on that same entity.",
    expectedProperties: ["position", "properties"],
  },
  {
    name: "czml-path-relative-to",
    referenceExamples: [sandcastleUrl("relative-paths")],
    intent:
      "Create two satellite entities with time-dynamic orbital positions and paths, where one satellite's " +
      "path is drawn relative to the other satellite's reference frame (using the path's relativeTo " +
      "property) instead of relative to the fixed Earth frame.",
    expectedProperties: ["path.relativeTo", "position.epoch"],
    minEntityCount: 2,
  },
  {
    name: "czml-path-time-varying-material",
    referenceExamples: [sandcastleUrl("time-dependent-path-graphics")],
    intent:
      "Create a moving entity with a time-dynamic position and a path trail whose material changes at " +
      "distinct time intervals along the path (materialMode 'PORTIONS'): solid red for the first segment, " +
      "a glowing purple polylineGlow whose glow power increases over that segment, and a dashed green-" +
      "then-pink line for the last segment.",
    expectedProperties: ["path.materialMode", "path.material", "position.epoch"],
  },
];
