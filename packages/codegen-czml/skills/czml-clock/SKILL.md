---
name: czml-clock
description: "CZML document-level clock controlling the viewer's timeline: start/stop interval, current time, playback multiplier, and looping behavior. Use when the intent mentions a clock, timeline, playback speed, looping, or specific start/stop times for the whole scene."
---

# CZML Document Clock

- The "document" packet (always the first packet) MAY carry a "clock":
  `{ "interval": "<ISO8601 start>/<ISO8601 end>", "currentTime": "<ISO8601>",
"multiplier": <number>, "range": "LOOP_STOP" | "CLAMPED" | "UNBOUNDED",
"step": "SYSTEM_CLOCK_MULTIPLIER" | "SYSTEM_CLOCK" | "TICK_DEPENDENT" }` to populate the
  viewer's timeline for time-dynamic scenes.
- Whenever the intent specifies playback behavior (a start/stop time, a time multiplier, or
  looping), you MUST add this "clock" object to the document packet with exactly those values —
  do not omit it.
- "range": "LOOP_STOP" loops back to the interval start when it reaches the end; "CLAMPED" holds
  at the end time; "UNBOUNDED" keeps advancing past the end.
- "step": "SYSTEM_CLOCK_MULTIPLIER" (the default) advances "currentTime" by "multiplier" times the
  elapsed real (wall-clock) time between ticks — use this unless the intent asks for a different
  stepping mode.

## Example: named document metadata with a clock and one entity

```json
[
  {
    "id": "document",
    "name": "Vehicle Tracking",
    "version": "1.0",
    "clock": {
      "interval": "2012-03-15T10:00:00Z/2012-03-16T10:00:00Z",
      "currentTime": "2012-03-15T10:00:00Z",
      "multiplier": 60,
      "range": "LOOP_STOP",
      "step": "SYSTEM_CLOCK_MULTIPLIER"
    }
  },
  {
    "id": "pt-1",
    "position": { "cartographicDegrees": [5, 15, 0] },
    "point": { "pixelSize": 10, "color": { "rgba": [255, 255, 255, 255] } }
  }
]
```
