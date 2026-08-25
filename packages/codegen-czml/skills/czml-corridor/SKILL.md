---
name: czml-corridor
description: "CZML corridors — fixed-width strips or roads that follow a centerline path along the ground or at altitude, with configurable corner styles. Use when the intent describes a corridor, road, fixed-width strip along a route, or a path with rounded, mitered, or beveled corners."
---

# CZML Corridor

- "corridor": `{ "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
"width": <number>, "cornerType": "ROUNDED"|"MITERED"|"BEVELED", "height": <number>,
"extrudedHeight": <number>, "material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } },
"outline": true|false, "outlineColor": { "rgba": [r,g,b,a] }, "show": true|false }` — a shape
  defined by a centerline ("positions") and "width" (the distance between its edges), conforming
  to the globe's curvature.
- "cornerType" defaults to `"ROUNDED"` if omitted; set it explicitly when the intent specifies a
  corner style.
- Omit "height"/"extrudedHeight" for a corridor clamped to the ground; set "extrudedHeight" to
  give it volume above "height".

## Example: three corridors, one per corner type

```json
[
  { "id": "document", "name": "Corridors", "version": "1.0" },
  {
    "id": "corridor-rounded",
    "corridor": {
      "positions": { "cartographicDegrees": [-90, 30, 0, -89.5, 30.5, 0, -89, 30, 0] },
      "width": 20000,
      "cornerType": "ROUNDED",
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 255] } } }
    }
  },
  {
    "id": "corridor-mitered",
    "corridor": {
      "positions": { "cartographicDegrees": [-88, 30, 5000, -87.5, 30.5, 5000, -87, 30, 5000] },
      "width": 20000,
      "height": 5000,
      "cornerType": "MITERED",
      "material": { "solidColor": { "color": { "rgba": [0, 255, 0, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  },
  {
    "id": "corridor-beveled",
    "corridor": {
      "positions": { "cartographicDegrees": [-86, 30, 0, -85.5, 30.5, 0, -85, 30, 0] },
      "width": 20000,
      "extrudedHeight": 10000,
      "cornerType": "BEVELED",
      "material": { "solidColor": { "color": { "rgba": [0, 0, 255, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  }
]
```
