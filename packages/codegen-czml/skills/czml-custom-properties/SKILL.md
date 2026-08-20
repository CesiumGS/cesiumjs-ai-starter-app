---
name: czml-custom-properties
description: "CZML custom/arbitrary entity properties for domain-specific data like population, fuel level, or sensor readings that aren't a standard graphics property, optionally time-varying or split across multiple sequential packets. Use when the intent describes a custom property, custom data field, or a named value attached to an entity that isn't a standard CZML graphics property."
---

# CZML Custom Properties

- "properties": `{ "<propertyName>": { "number": <value> } }` — a top-level packet property (a
  sibling of "position"/"polygon"/etc., not nested inside a graphics property) holding arbitrary
  named data on an entity. Wrap the value by its type: `{ "number": <value> }` for numeric data,
  `{ "string": "<value>" }` for text, `{ "boolean": true|false }` for flags.
- For a value that changes over time, use either:
  - The same "epoch" + interleaved-timestamp-and-value pattern as any other sampled property:
    `{ "epoch": "<ISO8601>", "population": [t0, v0, t1, v1, ...] }`, or
  - An array of interval-scoped values, each with its own "interval":
    `"population": [{ "interval": "<ISO8601 start>/<ISO8601 end>", "number": 1000 }, { "interval": "<next start>/<next end>", "number": 2000 }]`.
    This same interval-array pattern also works for any other property (e.g. "position") when an
    entity's full timeline needs to be built incrementally from several non-overlapping segments,
    as if streamed across separate CZML packets.

## Example: a time-varying custom property alongside a polygon entity

```json
[
  { "id": "document", "name": "Custom properties", "version": "1.0" },
  {
    "id": "region-1",
    "properties": {
      "epoch": "2026-01-01T00:00:00Z",
      "population": [0, 10000, 3600, 12000, 7200, 15000]
    },
    "polygon": {
      "positions": {
        "cartographicDegrees": [-90, 30, 0, -89.9, 30, 0, -89.9, 30.1, 0, -90, 30.1, 0]
      },
      "extrudedHeight": 15000,
      "material": { "solidColor": { "color": { "rgba": [0, 128, 255, 150] } } }
    }
  }
]
```
