---
name: czml-reference-properties
description: "CZML reference properties that link one entity's property to another entity's value, including a single reference, an array of references (e.g. building a polygon's corners from other entities' positions), and referencing non-position properties like colors or materials. Use when the intent describes an entity that references, follows, tracks, or is driven by another entity's property instead of defining its own value."
---

# CZML Reference Properties

- A reference string has the form `"<entityId>#<propertyPath>"`, e.g. `"leadVehicle#position"` or
  `"labelEntity#label.outlineColor"` (dotted path into a nested graphics property).
- Single-value reference: any property that normally takes a literal value can instead take
  `{ "reference": "<entityId>#<propertyPath>" }`, e.g.
  `"position": { "reference": "leadVehicle#position" }` so this entity always tracks another
  entity's (possibly time-varying) position, or
  `"material": { "solidColor": { "color": { "reference": "labelEntity#label.outlineColor" } } }` so
  a shape's fill color follows another entity's color property.
- **Array of references** (e.g. building a polygon's corner positions entirely from other
  entities' positions, so the shape updates as those entities move):
  `"positions": { "references": ["vertexA#position", "vertexB#position", "vertexC#position"] }` —
  each referenced property must itself resolve to a single position.

## Example: a polygon whose corners track three other moving entities

```json
[
  { "id": "document", "name": "Reference positions", "version": "1.0" },
  {
    "id": "vertexA",
    "position": {
      "epoch": "2026-01-01T00:00:00Z",
      "cartographicDegrees": [0, -90, 30, 0, 3600, -89.9, 30, 0]
    }
  },
  {
    "id": "vertexB",
    "position": {
      "epoch": "2026-01-01T00:00:00Z",
      "cartographicDegrees": [0, -89.9, 30.1, 0, 3600, -89.8, 30.1, 0]
    }
  },
  {
    "id": "vertexC",
    "position": {
      "epoch": "2026-01-01T00:00:00Z",
      "cartographicDegrees": [0, -90, 30.1, 0, 3600, -89.9, 30.1, 0]
    }
  },
  {
    "id": "tracking-polygon",
    "polygon": {
      "positions": { "references": ["vertexA#position", "vertexB#position", "vertexC#position"] },
      "material": { "solidColor": { "color": { "rgba": [255, 0, 0, 128] } } }
    }
  }
]
```
