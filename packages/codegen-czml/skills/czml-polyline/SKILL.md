---
name: czml-polyline
description: "CZML static polyline and polylines for flight routes, boundaries, and fixed lines connecting two or more locations. Use when the intent describes a polyline, straight or multi-segment line, route, boundary, or connection between fixed points (not a moving entity)."
---

# CZML Polyline

- "polyline": `{ "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "width": <number> }` — a static
  multi-point line, e.g. a flight path drawn as a fixed line, as opposed to a moving "position".
- The "positions" list needs at least two `[lon, lat, height]` triples.

## Example: a static flight route with an endpoint label

```json
[
  { "id": "document", "name": "Flight path", "version": "1.0" },
  {
    "id": "route",
    "name": "London to Tokyo",
    "polyline": {
      "positions": { "cartographicDegrees": [-0.4543, 51.47, 0, 139.7798, 35.5494, 0] },
      "material": { "solidColor": { "color": { "rgba": [0, 191, 255, 200] } } },
      "width": 3
    }
  },
  {
    "id": "destination",
    "name": "Tokyo",
    "position": { "cartographicDegrees": [139.7798, 35.5494, 0] },
    "label": {
      "text": "Tokyo",
      "font": "14px sans-serif",
      "fillColor": { "rgba": [255, 255, 255, 255] }
    }
  }
]
```
