---
name: czml-polygon
description: "CZML filled polygons for regions, areas of interest, footprints, and closed shapes on the ground. Use when the intent describes an area, region, zone, footprint, or filled shape bounded by several corner points."
---

# CZML Polygon

- "polygon": `{ "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "height": <number>,
"extrudedHeight": <number>, "show": true|false }` — a filled, closed shape over the ground.
  "positions" defines the corners in order; the polygon is implicitly closed (do not repeat the
  first point at the end). Use a translucent "rgba" alpha (e.g. `128`) for a semi-transparent fill.

## Example: a filled rectangular area of interest

```json
[
  { "id": "document", "name": "Area of interest", "version": "1.0" },
  {
    "id": "aoi-1",
    "name": "Area of interest",
    "polygon": {
      "positions": {
        "cartographicDegrees": [-90, 30, 0, -89.9, 30, 0, -89.9, 30.1, 0, -90, 30.1, 0]
      },
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 128] } } }
    }
  }
]
```
