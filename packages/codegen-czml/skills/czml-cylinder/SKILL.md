---
name: czml-cylinder
description: "CZML cylinders and cones for towers, sensor volumes, or tapered 3D shapes. Use when the intent describes a cylinder, cone, tapered column, tower, or truncated-cone shape, with a top radius, bottom radius, and length."
---

# CZML Cylinder

- "cylinder": `{ "length": <number>, "topRadius": <number>, "bottomRadius": <number>,
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "fill": true|false,
"outline": true|false, "outlineColor": { "rgba": [r,g,b,a] }, "show": true|false }` — a
  cylinder, truncated cone, or cone centered on the entity's "position", oriented vertically by
  default.
- A cone is just a cylinder with `"topRadius": 0`.
- "length" is the total height in meters; "topRadius"/"bottomRadius" are in meters.

## Example: a green cylinder and a red cone

```json
[
  { "id": "document", "name": "Cylinders", "version": "1.0" },
  {
    "id": "cylinder-1",
    "position": { "cartographicDegrees": [-75, 40, 100000] },
    "cylinder": {
      "length": 200000,
      "topRadius": 100000,
      "bottomRadius": 100000,
      "material": { "solidColor": { "color": { "rgba": [0, 255, 0, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  },
  {
    "id": "cone-1",
    "position": { "cartographicDegrees": [-73, 40, 100000] },
    "cylinder": {
      "length": 200000,
      "topRadius": 0,
      "bottomRadius": 100000,
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 255] } } }
    }
  }
]
```
