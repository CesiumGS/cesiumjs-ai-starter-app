---
name: czml-billboard-label
description: "CZML billboard icons and text labels for named ground facilities, markers, and pins. Use when the intent describes a named place, marker, icon, pin, waypoint, or a text label shown next to an entity."
---

# CZML Billboard & Label

- "billboard": `{ "image": "<data URI or URL>", "scale": <number>, "show": true|false }` — draws an
  icon at the entity's "position". Do not reference an external image/model URL unless the intent
  explicitly supplies one.
- "label": `{ "text": "<string>", "font": "<CSS font, e.g. \"14px sans-serif\">", "fillColor": { "rgba": [r,g,b,a] }, "show": true|false }` —
  draws text next to the entity's "position".
- Both support "scale" and "show"; omit "show" to always display.
- "description": `"<HTML string>"` — a top-level packet property (a sibling of "billboard"/"label",
  not nested inside either) holding an HTML description shown in the entity's info-box when
  clicked, e.g. `"<p>Learn more at <a href=\"https://example.com\">example.com</a>.</p>"`.

## Example: a named facility with an icon and a label

```json
[
  { "id": "document", "name": "AGI Headquarters", "version": "1.0" },
  {
    "id": "agi-hq",
    "name": "AGI Headquarters",
    "position": { "cartographicDegrees": [-75.596, 40.038, 0] },
    "billboard": { "image": "data:image/svg+xml;base64,PHN2Zy8+", "scale": 1.0 },
    "label": {
      "text": "AGI HQ",
      "font": "14px sans-serif",
      "fillColor": { "rgba": [255, 255, 255, 255] }
    },
    "description": "<p>Headquarters of AGI.</p>"
  }
]
```
