---
name: czml-polyline-volume
description: "CZML polyline volumes — a 2D cross-section shape extruded along a 3D path, giving a line real thickness and volume instead of being infinitely thin. Use when the intent describes a polyline volume, thick line, extruded tube, or a cross-section swept along a path."
---

# CZML Polyline Volume

- "polylineVolume": `{ "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
"shape": { "cartesian2": [x0, y0, x1, y1, x2, y2, ...] }, "cornerType": "ROUNDED"|"MITERED"|"BEVELED",
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "outline": true|false,
"outlineColor": { "rgba": [r,g,b,a] }, "show": true|false }` — extrudes the 2D "shape" polygon
  (defined in local X/Y meters, e.g. a box cross-section) along the 3D "positions" path.
- "shape" is a flat list of 2D points describing one closed cross-section (e.g. a small square:
  `[-500, -500, 500, -500, 500, 500, -500, 500]`), not repeated for each path position.
- "cornerType" defaults to `"ROUNDED"` if omitted.

## Example: a beveled, outlined box-cross-section tube along a path

```json
[
  { "id": "document", "name": "Polyline volume", "version": "1.0" },
  {
    "id": "volume-1",
    "polylineVolume": {
      "positions": { "cartographicDegrees": [-90, 30, 10000, -89.5, 30.5, 20000, -89, 30, 10000] },
      "shape": { "cartesian2": [-5000, -5000, 5000, -5000, 5000, 5000, -5000, 5000] },
      "cornerType": "BEVELED",
      "material": { "solidColor": { "color": { "rgba": [0, 255, 255, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  }
]
```
