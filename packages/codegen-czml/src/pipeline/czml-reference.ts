/**
 * Condensed CZML (Cesium Language) *core* reference — the document packet envelope, "position",
 * "point", and "availability" — always inlined as grounding context in the generation prompt
 * (see `prompt-builder.ts`), since almost every generated document needs them regardless of
 * intent. Everything else (billboard/label, polyline, polygon, orientation, document clock,
 * viewFrom, time-dynamic motion) is intent-specific and lives in `../../skills/*\/SKILL.md`
 * instead, matched per-intent via `domain-matcher.ts` (mirrors
 * `@cesium-ai/codegen-cesium`'s skill-matching approach) rather than always inlined in full.
 */
export const CZML_REFERENCE = `# CZML quick reference

CZML is a JSON array of "packets". The first packet MUST be the document packet:
  { "id": "document", "name": "<short name>", "version": "1.0" }

Every other packet describes one entity and MUST have a unique "id". Common properties:

- "position": either
  - { "cartographicDegrees": [lon, lat, height] } for a single static position, or
  - { "cartesian": [x, y, z] } for a single static position in ECEF meters, or
  - { "epoch": "<ISO8601>", "cartographicDegrees": [t0, lon0, lat0, h0, t1, lon1, lat1, h1, ...] }
    for a time-dynamic position sampled at seconds-since-epoch offsets t0 < t1 < ...
  - Prefer "cartographicDegrees" unless the intent specifically asks for a Cartesian/ECEF position.
- "point": { "pixelSize": <number>, "color": { "rgba": [r,g,b,a] },
  "outlineColor": { "rgba": [r,g,b,a] }, "outlineWidth": <number> }
- "availability": "<ISO8601 start>/<ISO8601 end>" — restricts when the entity/its properties are
  active; required on an entity whenever its "document" packet also carries a "clock" that should
  bound this entity's visible lifetime.
- "description": "<HTML string>" — a top-level packet property (a sibling of "position"/"point"/
  etc.) holding an HTML description shown in the entity's info-box when clicked. Only add this when
  the intent explicitly asks for a description/info-box.
- "zIndex": <integer> — a top-level property on ground-clamped shapes ("polygon", "rectangle",
  "corridor", "ellipse") controlling their stacking/draw order when they overlap; higher values
  draw on top. Only add this when the intent explicitly asks for stacking/draw order control.

## Example: a single stationary point

[
  { "id": "document", "name": "Point", "version": "1.0" },
  { "id": "pt-1", "position": { "cartographicDegrees": [10, 20, 0] },
    "point": { "pixelSize": 10, "color": { "rgba": [255, 255, 255, 255] } } }
]`;
