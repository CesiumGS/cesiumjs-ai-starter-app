---
name: czml-orientation
description: "CZML entity orientation as unit quaternions, both a single fixed orientation and orientation sampled over time. Use when the intent describes an entity's heading, facing direction, attitude, 3D rotation, or orientation that changes over time."
---

# CZML Orientation

- "orientation" (fixed): `{ "unitQuaternion": [x, y, z, w] }` — a single 4-dimensional unit
  quaternion rotating the entity's body axes into the Earth-fixed (East-North-Up) axes.
- "orientation" (sampled, time-dynamic): `{ "epoch": "<ISO8601>",
"unitQuaternion": [t0, x0, y0, z0, w0, t1, x1, y1, z1, w1, ...] }` — same interleaved
  timestamp-then-value sample pattern as a time-dynamic "position". Compute the actual quaternion
  values yourself from the intent's described heading/attitude — never leave placeholder values.
- Always add "orientation" whenever the intent describes a heading, facing direction, or attitude —
  a "point"/"billboard" alone has no orientation.

## Example: a fixed orientation

```json
[
  { "id": "document", "name": "Oriented entity", "version": "1.0" },
  {
    "id": "facility-1",
    "position": { "cartographicDegrees": [-75, 40, 0] },
    "orientation": { "unitQuaternion": [0, 0, 0.3826834, 0.9238795] },
    "point": { "pixelSize": 10, "color": { "rgba": [255, 255, 255, 255] } }
  }
]
```

## Example: orientation sampled over time, alongside a time-dynamic position

```json
[
  {
    "id": "document",
    "name": "International Space Station",
    "version": "1.0",
    "clock": {
      "interval": "2012-03-15T10:00:00Z/2012-03-16T10:00:00Z",
      "currentTime": "2012-03-15T10:00:00Z",
      "multiplier": 60,
      "range": "LOOP_STOP"
    }
  },
  {
    "id": "iss",
    "name": "InternationalSpaceStation",
    "availability": "2012-03-15T10:00:00Z/2012-03-16T10:00:00Z",
    "position": {
      "epoch": "2012-03-15T10:00:00Z",
      "cartographicDegrees": [0, 0, 0, 400000, 1800, 45, 10, 400000, 3600, 90, 20, 400000]
    },
    "orientation": {
      "epoch": "2012-03-15T10:00:00Z",
      "unitQuaternion": [0, 0, 0, 0, 1, 1800, 0, 0, 0.7071068, 0.7071068, 3600, 0, 0, 1, 0]
    },
    "point": { "pixelSize": 8, "color": { "rgba": [255, 255, 0, 255] } }
  }
]
```
