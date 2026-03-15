# Office Scene Config Spec
## Date
2026-03-15

## Approved master scene
- `/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/office-master-scene-v2-refined-d-v4.png`

## Purpose
Define the scene anchors Dev should implement so the office can become a live interactive world.

## Coordinate model
Use normalized coordinates relative to the rendered office image/container.
- x: 0.0 = far left, 1.0 = far right
- y: 0.0 = top, 1.0 = bottom

These values are first-pass implementation anchors and may be tuned in-browser.

## Scene anchors
### Door
- `door`: { x: 0.12, y: 0.72 }

### Reports tray
- `reportsTray`: { x: 0.86, y: 0.78 }

## Desk zones
### Mildred desk
- `mildredDesk`: { x: 0.30, y: 0.30 }
- `mildredAvatar`: { x: 0.30, y: 0.26 }
- `mildredBlocked`: { x: 0.36, y: 0.22 }
- `mildredClickRegion`: { x: 0.20, y: 0.18, width: 0.20, height: 0.18 }

### Dev desk
- `devDesk`: { x: 0.70, y: 0.30 }
- `devAvatar`: { x: 0.70, y: 0.26 }
- `devBlocked`: { x: 0.76, y: 0.22 }
- `devClickRegion`: { x: 0.60, y: 0.18, width: 0.20, height: 0.18 }

### Claire desk
- `claireDesk`: { x: 0.30, y: 0.60 }
- `claireAvatar`: { x: 0.30, y: 0.56 }
- `claireBlocked`: { x: 0.36, y: 0.52 }
- `claireClickRegion`: { x: 0.20, y: 0.48, width: 0.20, height: 0.18 }

### Future desk
- `futureDesk`: { x: 0.70, y: 0.60 }
- `futureAvatar`: { x: 0.70, y: 0.56 }
- `futureBlocked`: { x: 0.76, y: 0.52 }
- `futureClickRegion`: { x: 0.60, y: 0.48, width: 0.20, height: 0.18 }

## Movement path nodes (first pass)
- `pathDoorMid`: { x: 0.24, y: 0.64 }
- `pathCenterTop`: { x: 0.50, y: 0.36 }
- `pathCenterBottom`: { x: 0.50, y: 0.62 }

Use these only as first-pass path helpers for future movement.

## State behavior rules
### Mildred / Dev / Claire
- if active: avatar visible at desk anchor
- if blocked: avatar visible + blocked badge at blocked anchor
- if inactive: no avatar at desk

### Future desk
- keep desk visually present but empty
- no avatar unless/until a future agent is added
- should read as intentionally reserved, not broken

## UI rules
- no large dashboard cards inside the room
- labels and detail affordances should be lightweight
- room reads first, UI second

## Adjustment rule
These anchors are implementation starting points.
Dev should tune them minimally against the live scene, but not redesign the room or desk map.
