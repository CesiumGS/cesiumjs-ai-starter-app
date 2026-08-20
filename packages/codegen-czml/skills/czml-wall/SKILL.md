---
name: czml-wall
description: "CZML walls — vertical surfaces that follow a ground path, with optional per-point minimum/maximum heights. Use when the intent describes a wall, vertical barrier, fence-like surface, or a shape whose top/bottom edge follows a path of varying heights."
---

# CZML Wall

- "wall": `{ "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
"material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "outline": true|false,
"outlineColor": { "rgba": [r,g,b,a] }, "minimumHeights": [h0, h1, ...],
"maximumHeights": [h0, h1, ...], "show": true|false }` — a 2D vertical surface following the
  "positions" line strip.
- By default, each point's own height (the third value in "positions") is the **top** edge and the
  surface (height 0) is the **bottom** edge. To make the top edge itself vary per-point (e.g. an
  edge that rises and falls along the wall's length), set each position's height to the desired top
  height directly, or supply "maximumHeights"/"minimumHeights" (one value per position, same order)
  to control the top/bottom edges independently of "positions"' own heights.

## Example: a translucent red zig-zag wall with a rising-and-falling top edge

```json
[
  { "id": "document", "name": "Wall", "version": "1.0" },
  {
    "id": "wall-1",
    "wall": {
      "positions": {
        "cartographicDegrees": [
          -80, 30, 50000, -79.7, 30.3, 10000, -79.4, 30, 50000, -79.1, 30.3, 10000, -78.8, 30, 50000
        ]
      },
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 128] } } }
    }
  }
]
```
