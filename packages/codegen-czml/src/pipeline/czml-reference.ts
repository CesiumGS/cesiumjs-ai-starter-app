/**
 * Condensed CZML (Cesium Language) reference inlined as grounding context in the generation
 * prompt (see `prompt-builder.ts`). CZML has one fixed, stable packet schema — unlike
 * `@cesium-ai/codegen-cesium`'s sprawling CesiumJS API surface, there's no need for a
 * skill-matching/domain-selection step; the whole reference is small enough to inline every time.
 */
export const CZML_REFERENCE = `# CZML quick reference

CZML is a JSON array of "packets". The first packet MUST be the document packet:
  { "id": "document", "name": "<short name>", "version": "1.0" }

Every other packet describes one entity and MUST have a unique "id". Common properties:

- "position": either
  - { "cartographicDegrees": [lon, lat, height] } for a single static position, or
  - { "epoch": "<ISO8601>", "cartographicDegrees": [t0, lon0, lat0, h0, t1, lon1, lat1, h1, ...] }
    for a time-dynamic position sampled at seconds-since-epoch offsets t0 < t1 < ...
- "point": { "pixelSize": <number>, "color": { "rgba": [r,g,b,a] } }
- "billboard": { "image": "<data URI or URL>", "scale": <number> }
- "label": { "text": "<string>", "font": "<CSS font>", "fillColor": { "rgba": [r,g,b,a] } }
- "path": { "material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "width": <number>,
  "resolution": <seconds>, "leadTime": <seconds>, "trailTime": <seconds> } — draws a trail behind
  a time-dynamic "position".
- "polyline": { "positions": { "cartographicDegrees": [lon0, lat0, h0, lon1, lat1, h1, ...] },
  "material": { "solidColor": { "color": { "rgba": [r,g,b,a] } } }, "width": <number> } — a static
  multi-point line (e.g. a flight path drawn as a fixed line, as opposed to a moving "position").
- "availability": "<ISO8601 start>/<ISO8601 end>" — restricts when the entity/its properties are
  active; required on an entity whenever its "document" packet also carries a "clock" that should
  bound this entity's visible lifetime.
- "label"/"billboard" both support "show": true/false and "scale"; omit "show" to always display.

The document packet MAY also carry:
  "clock": { "interval": "<ISO8601 start>/<ISO8601 end>", "currentTime": "<ISO8601>",
    "multiplier": <number>, "range": "LOOP_STOP" | "CLAMPED" | "UNBOUNDED" }
to populate the viewer's timeline for time-dynamic scenes.

## Example: a satellite orbit (time-dynamic position + path)

[
  { "id": "document", "name": "Satellite orbit", "version": "1.0",
    "clock": { "interval": "2026-01-01T00:00:00Z/2026-01-02T00:00:00Z",
      "currentTime": "2026-01-01T00:00:00Z", "multiplier": 60, "range": "LOOP_STOP" } },
  { "id": "sat-1", "name": "Satellite 1",
    "availability": "2026-01-01T00:00:00Z/2026-01-02T00:00:00Z",
    "position": { "epoch": "2026-01-01T00:00:00Z",
      "cartographicDegrees": [0, 0, 0, 500000, 2700, 90, 0, 500000, 5400, 180, 0, 500000] },
    "point": { "pixelSize": 8, "color": { "rgba": [255, 255, 0, 255] } },
    "path": { "resolution": 120, "leadTime": 0, "trailTime": 5400,
      "material": { "solidColor": { "color": { "rgba": [255, 255, 0, 128] } } }, "width": 2 } }
]

## Example: a static flight path (polyline) with an endpoint marker

[
  { "id": "document", "name": "Flight path", "version": "1.0" },
  { "id": "route", "name": "London to Tokyo",
    "polyline": { "positions": { "cartographicDegrees": [-0.4543, 51.4700, 0, 139.7798, 35.5494, 0] },
      "material": { "solidColor": { "color": { "rgba": [0, 191, 255, 200] } } }, "width": 3 } },
  { "id": "destination", "name": "Tokyo",
    "position": { "cartographicDegrees": [139.7798, 35.5494, 0] },
    "label": { "text": "Tokyo", "font": "14px sans-serif", "fillColor": { "rgba": [255, 255, 255, 255] } } }
]`;
