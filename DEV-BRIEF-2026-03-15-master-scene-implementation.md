# Dev Brief — Mission Control Master Scene Implementation
## Date
2026-03-15

## Objective
Implement the next working build of Mission Control using the approved master-scene office world as the visual foundation.

## Approved visual base
Use:
- `/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/office-master-scene-v2-refined-d-v4.png`

Do not redesign the room. Build the interactive system on top of it.

## Supporting implementation docs
Read and follow:
- `/Users/mildred/.openclaw/workspace/projects/command-center/MISSION-CONTROL-IMPLEMENTATION-ROADMAP-2026-03-15.md`
- `/Users/mildred/.openclaw/workspace/projects/command-center/OFFICE-SCENE-CONFIG-SPEC-2026-03-15.md`
- `/Users/mildred/.openclaw/workspace/projects/command-center/PROJECT.md`

## What to build now
### Phase 1 implementation
- render the approved office master scene as the office background
- implement the defined desk/door/tray/avatar/click anchors
- ensure the office reads as one shared world

### Phase 2 implementation
Implement visible desk/agent states:
- Mildred desk: empty / active / blocked
- Dev desk: empty / active / blocked
- Claire desk: empty / active / blocked
- Future desk: reserved / empty only for now

### Interaction
- clicking an occupied or reserved desk should open plain-English detail
- keep UI chrome light so the room remains primary

## Important hard requirements
- no four-card dashboard framing
- no compositing of fake room pieces
- no layout regressions that break the room illusion
- avatars/overlays should be subordinate to the approved world art
- preserve single shared office feel

## Definition of done
- approved master-scene image integrated into app
- scene anchors implemented cleanly
- empty/active/blocked/reserved states working
- click interactions working
- office still reads as one world, not widget layout

## Required verification
- run project build/test equivalent and report results
- include screenshots of:
  - empty / mixed live office state
  - blocked state
  - click detail state
- note any anchor tuning you made relative to the spec

## Frontend quality bar
Mandatory:
- preserve visual polish
- no clipping / overflow / z-index regressions
- no new widget-card feeling
- no overlap issues that break spatial logic
- neighboring UI remains coherent

## Deliverable format
Return:
1. what changed
2. what’s verified
3. screenshots
4. any remaining limitations before movement phase
