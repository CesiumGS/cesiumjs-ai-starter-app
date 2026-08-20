---
name: czml-ellipsoid
description: "CZML ellipsoids and spheres for domes, planetary bodies, or radius-based 3D round volumes. Use when the intent describes a sphere, ellipsoid, dome, or 3D round volume defined by radii, including wireframe-only variants."
---

# CZML Ellipsoid

- "ellipsoid": `{ "radii": { "cartesian": [x, y, z] },
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "fill": true|false,
"outline": true|false, "outlineColor": { "rgba": [r,g,b,a] }, "slicePartitions": <integer>,
"stackPartitions": <integer>, "show": true|false }` — a three-dimensional analogue of an ellipse,
  centered on the entity's "position". "radii" is `[X, Y, Z]` in meters.
- A sphere is an ellipsoid with equal X, Y, and Z radii.
- "slicePartitions"/"stackPartitions" control the smoothness of the outline/tessellation for a
  wireframe-only (fill: false, outline: true) ellipsoid — raise both for a smoother outline.

## Example: a blue ellipsoid, a red sphere, and a wireframe ellipsoid

```json
[
  { "id": "document", "name": "Ellipsoids", "version": "1.0" },
  {
    "id": "ellipsoid-blue",
    "position": { "cartographicDegrees": [-75, 40, 300000] },
    "ellipsoid": {
      "radii": { "cartesian": [200000, 100000, 150000] },
      "material": { "solidColor": { "color": { "rgba": [0, 0, 255, 255] } } }
    }
  },
  {
    "id": "sphere-red",
    "position": { "cartographicDegrees": [-73, 40, 300000] },
    "ellipsoid": {
      "radii": { "cartesian": [150000, 150000, 150000] },
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  },
  {
    "id": "ellipsoid-wireframe",
    "position": { "cartographicDegrees": [-71, 40, 300000] },
    "ellipsoid": {
      "radii": { "cartesian": [180000, 120000, 150000] },
      "fill": false,
      "outline": true,
      "outlineColor": { "rgba": [255, 255, 0, 255] },
      "slicePartitions": 32,
      "stackPartitions": 32
    }
  }
]
```
