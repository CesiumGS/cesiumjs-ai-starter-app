---
name: czml-distance-scaling
description: "CZML distance-based scaling and visibility for billboards, points, labels, or models that should shrink/grow or show/hide based on camera distance. Use when the intent describes scaling by distance, near/far scale, or only showing an entity within a certain camera distance."
---

# CZML Distance-Based Scaling & Visibility

- "scaleByDistance": `{ "nearFarScalar": [nearDistance, nearScale, farDistance, farScale] }` — on
  "billboard", "point", "label", or "model", linearly interpolates a scale multiplier between
  `nearScale` (at `nearDistance` meters from the camera) and `farScale` (at `farDistance` meters),
  clamped outside that range. It multiplies the graphic's own size (e.g. "pixelSize"/"scale").
- "distanceDisplayCondition": `{ "distanceDisplayCondition": [nearDistance, farDistance] }` — on
  the same graphics properties (or the shape itself), only renders the entity while the camera is
  between `nearDistance` and `farDistance` meters away.

## Example: a billboard that scales down and disappears with distance

```json
[
  { "id": "document", "name": "Distance scaling", "version": "1.0" },
  {
    "id": "marker-1",
    "position": { "cartographicDegrees": [-75, 40, 0] },
    "billboard": {
      "image": "data:image/svg+xml;base64,PHN2Zy8+",
      "scaleByDistance": { "nearFarScalar": [150, 2.0, 15000000, 0.5] },
      "distanceDisplayCondition": { "distanceDisplayCondition": [0, 15000000] }
    }
  }
]
```
