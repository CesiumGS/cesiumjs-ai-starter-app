---
name: czml-rectangle
description: "CZML ground rectangles defined by west/south/east/north bounds, plus RGBA (0-255) vs RGBAF (0-1) color formats and striped materials. Use when the intent describes a rectangle, bounding box on the ground, striped fill, or specifies colors using integer RGBA or floating-point RGBAF components."
---

# CZML Rectangle

- "rectangle": `{ "coordinates": { "wsenDegrees": [west, south, east, north] },
"material": { ... }, "height": <number>, "extrudedHeight": <number>, "rotation": <radians>,
"fill": true|false, "outline": true|false, "outlineColor": { "rgba": [r,g,b,a] },
"show": true|false }` — a cartographic rectangle conforming to the globe's curvature.
  "wsenDegrees" is `[WestLongitude, SouthLatitude, EastLongitude, NorthLatitude]` in degrees.
- "rotation" is clockwise from north, in radians.
- Color formats (used anywhere a "color" appears, not just rectangles):
  - "rgba": `[R, G, B, A]` — each component an **integer 0-255**.
  - "rgbaf": `[R, G, B, A]` — each component a **float 0.0-1.0**. Use whichever the intent
    explicitly specifies; they represent the same color space, just different scales.
- Striped fill material: `{ "stripe": { "evenColor": { "rgba": [...] },
"oddColor": { "rgba": [...] }, "orientation": "HORIZONTAL"|"VERTICAL", "repeat": <number> } }`.

## Example: an extruded rectangle (RGBA) and a striped rectangle (RGBAF)

```json
[
  { "id": "document", "name": "Rectangles", "version": "1.0" },
  {
    "id": "rect-extruded",
    "rectangle": {
      "coordinates": { "wsenDegrees": [-90, 30, -89, 31] },
      "extrudedHeight": 50000,
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 255] } } },
      "outline": true,
      "outlineColor": { "rgba": [0, 0, 0, 255] }
    }
  },
  {
    "id": "rect-striped",
    "rectangle": {
      "coordinates": { "wsenDegrees": [-88, 30, -87, 31] },
      "rotation": 0.5,
      "material": {
        "stripe": {
          "evenColor": { "rgbaf": [0.0, 0.0, 1.0, 1.0] },
          "oddColor": { "rgbaf": [0.0, 1.0, 0.0, 1.0] },
          "orientation": "VERTICAL",
          "repeat": 6
        }
      }
    }
  }
]
```
