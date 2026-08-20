---
name: czml-ellipse
description: "CZML filled ellipses and circles on or above the ground. Use when the intent describes a circle, ellipse, oval, or round shape defined by a radius or semi-major/semi-minor axes, optionally rotated or extruded."
---

# CZML Ellipse

- "ellipse": `{ "semiMajorAxis": <number>, "semiMinorAxis": <number>,
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "height": <number>,
"extrudedHeight": <number>, "rotation": <radians>, "fill": true|false, "outline": true|false,
"outlineColor": { "rgba": [r,g,b,a] }, "show": true|false }` — a closed curve centered on the
  entity's "position". "semiMajorAxis"/"semiMinorAxis" are in meters, measured from center to edge.
- A circle is an ellipse with equal "semiMajorAxis" and "semiMinorAxis".
- "rotation" is the angle from north, counter-clockwise, in radians.
- Set "extrudedHeight" (with "height" as the base) to give the ellipse volume above the ground.

## Example: a circle, an outlined ellipse, and a rotated extruded ellipse

```json
[
  { "id": "document", "name": "Ellipses", "version": "1.0" },
  {
    "id": "circle-1",
    "position": { "cartographicDegrees": [-75, 40, 50000] },
    "ellipse": {
      "semiMajorAxis": 100000,
      "semiMinorAxis": 100000,
      "material": { "solidColor": { "color": { "rgba": [0, 255, 0, 255] } } }
    }
  },
  {
    "id": "ellipse-outlined",
    "position": { "cartographicDegrees": [-73, 40, 0] },
    "ellipse": {
      "semiMajorAxis": 150000,
      "semiMinorAxis": 80000,
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [255, 255, 255, 255] }
    }
  },
  {
    "id": "ellipse-rotated-extruded",
    "position": { "cartographicDegrees": [-71, 40, 0] },
    "ellipse": {
      "semiMajorAxis": 150000,
      "semiMinorAxis": 80000,
      "rotation": 0.5,
      "extrudedHeight": 80000,
      "material": { "solidColor": { "color": { "rgba": [0, 0, 255, 128] } } }
    }
  }
]
```
