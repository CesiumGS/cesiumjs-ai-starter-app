---
name: czml-time-dynamic-motion
description: "CZML time-dynamic motion: interpolated/sampled positions over an epoch and trails for orbiting, flying, or otherwise moving entities. Use when the intent describes an entity moving, orbiting, flying, or changing position over time (not a single static point)."
---

# CZML Time-Dynamic Motion

- A moving entity's "position" is sampled, not static:
  `{ "epoch": "<ISO8601>", "cartographicDegrees": [t0, lon0, lat0, h0, t1, lon1, lat1, h1, ...] }`
  (or "cartesian" samples — `[t0, x0, y0, z0, t1, x1, y1, z1, ...]`, ECEF meters — if the intent
  specifically asks for a Cartesian/ECEF position rather than longitude/latitude/height). `t0 < t1 < ...`
  are seconds since "epoch". Compute the actual sample values yourself from the intent — never
  leave placeholder values.
- "availability": "<ISO8601 start>/<ISO8601 end>" — bounds when the entity is active; add this
  whenever the document packet also carries a "clock" that should bound this entity's lifetime.
- "path": `{ "material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "width": <number>,
"resolution": <seconds>, "leadTime": <seconds>, "trailTime": <seconds> }` — draws a trail behind
  a time-dynamic "position".
- This same "epoch" + interleaved-timestamp-and-value-samples pattern also applies to any other
  time-varying numeric property (e.g. a sampled rotation angle) — not just "position".

## Example: a satellite orbit (time-dynamic position + path)

```json
[
  {
    "id": "document",
    "name": "Satellite orbit",
    "version": "1.0",
    "clock": {
      "interval": "2026-01-01T00:00:00Z/2026-01-02T00:00:00Z",
      "currentTime": "2026-01-01T00:00:00Z",
      "multiplier": 60,
      "range": "LOOP_STOP"
    }
  },
  {
    "id": "sat-1",
    "name": "Satellite 1",
    "availability": "2026-01-01T00:00:00Z/2026-01-02T00:00:00Z",
    "position": {
      "epoch": "2026-01-01T00:00:00Z",
      "cartographicDegrees": [0, 0, 0, 500000, 2700, 90, 0, 500000, 5400, 180, 0, 500000]
    },
    "point": { "pixelSize": 8, "color": { "rgba": [255, 255, 0, 255] } },
    "path": {
      "resolution": 120,
      "leadTime": 0,
      "trailTime": 5400,
      "material": { "solidColor": { "color": { "rgba": [255, 255, 0, 128] } } },
      "width": 2
    }
  }
]
```
