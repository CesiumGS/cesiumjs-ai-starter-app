---
name: czml-box
description: "CZML box shapes — closed rectangular cuboids for buildings, containers, or simple 3D blocks. Use when the intent describes a box, cube, rectangular volume, block, or cuboid shape, including solid, translucent, outlined, or wireframe-only variants."
---

# CZML Box

- "box": `{ "dimensions": { "cartesian": [width, depth, height] },
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "fill": true|false,
"outline": true|false, "outlineColor": { "rgba": [r,g,b,a] }, "outlineWidth": <number>,
"show": true|false }` — a closed rectangular cuboid centered on the entity's "position".
  "dimensions" is `[X, Y, Z]` in meters (width, depth, height).
- For a wireframe-only box (outline, no fill), set `"fill": false` and `"outline": true`.
- For a translucent fill, use a low "rgba" alpha (e.g. `128`).

## Example: three boxes — solid, translucent-outlined, and wireframe-only

```json
[
  { "id": "document", "name": "Boxes", "version": "1.0" },
  {
    "id": "box-solid",
    "position": { "cartographicDegrees": [-75, 40, 200000] },
    "box": {
      "dimensions": { "cartesian": [400000, 300000, 500000] },
      "material": { "solidColor": { "color": { "rgba": [0, 0, 255, 255] } } }
    }
  },
  {
    "id": "box-translucent-outlined",
    "position": { "cartographicDegrees": [-73, 40, 200000] },
    "box": {
      "dimensions": { "cartesian": [400000, 300000, 500000] },
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 128] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  },
  {
    "id": "box-wireframe",
    "position": { "cartographicDegrees": [-71, 40, 200000] },
    "box": {
      "dimensions": { "cartesian": [400000, 300000, 500000] },
      "fill": false,
      "outline": true,
      "outlineColor": { "rgba": [255, 255, 0, 255] }
    }
  }
]
```
