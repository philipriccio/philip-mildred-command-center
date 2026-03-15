# Mission Control — Implementation Roadmap
## Date
2026-03-15

## Purpose
Translate the approved master-scene office direction into a concrete implementation path for Dev.

## Current approved visual base
Use this as the working master scene:
- `/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/office-master-scene-v2-refined-d-v4.png`

This is approved as strong enough to move into implementation.

## Product goal
Mission Control should become a living office world where Philip can see Mildred, Dev, Claire, and future agents working in a shared environment.

The implementation should evolve in stages, not all at once.

---

## Phase 1 — Static world + scene config
### Goal
Convert the approved room art into a stable scene system.

### Dev should build
- render the approved master-scene image as the office background
- define explicit scene anchors and interaction zones
- keep the scene visually stable and responsive

### Required scene anchors
- Mildred desk anchor
- Dev desk anchor
- Claire desk anchor
- future desk anchor
- door anchor
- reports tray anchor
- avatar anchor for each desk
- blocked badge anchor for each desk
- click region for each desk/agent

### Output
A stable office scene with invisible coordinates/anchors ready for live layering.

---

## Phase 2 — Live presence states
### Goal
Make the office feel alive without full motion yet.

### Dev should build
- active agent appears at desk
- inactive agent desk appears empty
- blocked agent is visually distinct
- clicking an agent/desk opens detail panel
- state is driven by task/agent data, not hardcoded demo logic where possible

### Required visible states
- inactive / desk empty
- active / agent at desk
- blocked / agent + visible blocked state
- reserved / future desk remains intentionally empty

### Output
A live office dashboard where the room is real and status is legible.

---

## Phase 3 — First movement pass
### Goal
Add simple game-like movement/state transitions.

### Dev should build
- avatar spawn from door
- avatar move to desk
- avatar leave desk / exit when done
- optional blocked stance near desk

### Movement principle
Simple, readable, not overanimated.
Believability over flash.

### Output
Office starts feeling like a management sim rather than a static dashboard.

---

## Phase 4 — Polish and systemic depth
### Goal
Make the office feel premium and alive.

### Future additions
- subtle idle motion
- improved tray behavior
- smoother transitions
- future-agent desk activation
- richer state overlays
- scene-specific UI polish

---

## Implementation philosophy
- Claire owns visual world/system direction
- Dev owns coded implementation
- Mildred owns orchestration, QA, and approval

Do not redesign the room during implementation.
Build the system on top of the approved world.

## Hard rules for Dev
- do not treat the office like four dashboard cards
- do not rebuild the room from separate pasted elements
- do not improvise composition against the approved master scene
- keep avatars and overlays subordinate to the room art
- preserve clarity and floor-plane believability

## Definition of done for the next build step
The next implementation pass is successful when:
- the approved master scene is in the app
- desk/agent anchors are implemented cleanly
- empty/active/blocked/reserved desk states exist
- clicking a desk/agent reveals useful task detail
- the office reads as a single shared world, not a dashboard gimmick
