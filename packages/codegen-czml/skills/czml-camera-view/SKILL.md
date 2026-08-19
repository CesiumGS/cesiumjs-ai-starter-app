---
name: czml-camera-view
description: "CZML viewFrom camera offset suggesting an initial tracking view relative to an entity. Use when the intent describes how the camera should look at, track, or view an entity from an offset distance or angle."
---

# CZML Camera ViewFrom

- "viewFrom": `{ "cartesian": [x, y, z] }` — a suggested initial camera position offset (in
  meters) when tracking this entity, typically in the entity's own East (x), North (y), Up (z)
  frame. E.g. `[0, -20000, 20000]` looks at the entity from 20km back and 20km up.
- Add "viewFrom" whenever the intent describes tracking, following, or viewing an entity from a
  specific offset/distance/angle.

## Example: a point entity with a fixed tracking offset

```json
[
  { "id": "document", "name": "Tracked entity", "version": "1.0" },
  {
    "id": "facility-1",
    "position": { "cartographicDegrees": [-75, 40, 0] },
    "viewFrom": { "cartesian": [0, -20000, 20000] },
    "point": { "pixelSize": 10, "color": { "rgba": [255, 255, 255, 255] } }
  }
]
```
