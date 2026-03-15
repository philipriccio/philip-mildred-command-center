# Office Scene Direction — March 14, 2026

## Purpose
This document defines the visual composition for Mission Control's office so Dev does not need to invent scene design.

## Core rule
The office is **one shared pixel-art room**, not four widgets, cards, or modules.

## Critical correction
Do **not** use any background image that already contains desks if separate desk sprites are also being layered on top.
The room background must be an empty environment layer.

## Layer model
Build the office in layers:
1. **Room background** — walls, floor, windows/architecture, lighting, one door, no desks
2. **Room decor layer** — optional supporting props placed sparingly
3. **Desk layer** — four separate desk sprites placed into the room intentionally
4. **Avatar layer** — agents placed relative to their desks
5. **State overlay layer** — blocked badge, labels, tray highlights, etc.

## Composition goal
When Philip looks at the office, the first read should be:
**"This is one shared room where the agents work."**
Not: "these are four dashboard boxes."

## Spatial rules
### Room
- One continuous room background
- No card containers around desks
- No separate widget chrome framing each agent
- Perspective should feel consistent across room + desks + avatars

### Door
- One visible door should exist in the room
- This is the future entry/exit point for agents
- It should feel like part of the architecture, not a floating icon

### Walking space
- Keep a central lane / open floor area for future movement
- Do not cram desks too tightly
- Preserve enough open floor for a future door → desk → door path

## Desk placement model
Use four desks in fixed positions inside the one room.
Recommended first-pass layout:
- **Mildred:** upper-left quadrant
- **Dev:** upper-right quadrant
- **Research:** lower-left quadrant
- **Content:** lower-right quadrant

This creates an immediate readable 2x2 office map.

## Reports Tray placement
- Reports Tray should live naturally in the room, likely near a wall or lower-side area
- It should read as a physical object in the office, not a dashboard panel bolted to the scene

## Decor rules
- Decor should support the room, not clutter it
- Use sparingly: plant, cabinet, wall art, divider, lamp, etc.
- Every prop must feel like it belongs architecturally
- Avoid random placement that breaks spatial logic

## Avatar staging
- Avatars should be positioned in relation to the desks
- They should not float independently from the room
- Scale should be consistent across all agents
- Desk + avatar should read as one workstation

## State logic for later animation
Design the scene so future movement is easy:
- inactive = absent from desk / not visible in room
- arriving = appears at door and moves toward desk
- working = seated/working at desk
- blocked = standing near desk with BLOCKED marker
- done = leaves desk and exits via door

## Visual cleanliness rules
- No overlaps that make the room unreadable
- No doubled furniture imagery
- No placeholder dashboard framing competing with the office scene
- Keep labels lightweight
- Readability beats decoration

## Definition of success
The office succeeds when Philip feels he is looking at:
- one coherent pixel office,
- four agents sharing a real workspace,
- and a scene that could plausibly support simple game-like movement later.
