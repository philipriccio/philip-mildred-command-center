# Mission Control — Visual Direction Pack
## Date
2026-03-14

## Purpose
This document defines the intended visual direction for Mission Control's office scene before further coding passes.

---

## Product role of the office
The office is not decorative art.
It is the **primary live operations surface** for Mission Control.

The office should immediately communicate:
- who is active,
- where they are,
- what state they are in,
- and that Mildred is orchestrating a real working environment.

---

## First impression target
When Philip opens Mission Control, the first feeling should be:

**“I am looking into Mildred’s living operations office.”**

Not:
- “I’m looking at a dashboard with illustrations.”
- “These are widgets themed like an office.”
- “This is a collage of pixel assets.”

---

## Style goals
The office should feel:
- pixel-art
- clean
- slightly eerie/corporate
- game-like
- legible
- intentional
- premium enough to feel designed, not gimmicky

Tone reference:
- Severance-inspired corporate strangeness
- management-sim readability
- restrained, not childish

---

## Anti-goals
The office must not feel:
- like four cards/panels
- like assets floating in empty space
- like pasted stickers on a background
- like mismatched perspective
- like random prop placement
- like generic dashboard chrome with art dropped in

---

## Main visual failure modes to avoid
1. **Floating desks**
   - desks must feel grounded to a floor plane
2. **Asset collage feel**
   - all objects must feel like they belong to one camera angle/world
3. **Dashboard contamination**
   - labels, panels, and chrome must not overpower the scene
4. **Wrong architectural scale**
   - the door, tray, desks, and decor must feel like parts of the same room
5. **Prop guessing**
   - objects should not be placed approximately or arbitrarily

---

## Scene rules
### 1. One room
The office is one shared room with real spatial logic.

### 2. Grounded objects
Every desk and prop must appear to rest on the floor.
Use consistent grounding, spacing, and shadow logic.

### 3. Shared perspective
Background, desks, avatars, and props must all support the same rough perspective.
If an asset breaks the perspective too much, it should be replaced or restaged.

### 4. Architecture first
The room itself must read first:
- walls
- floor
- door
- windows / decor / perimeter details

Only after that should desks and avatars layer in.

### 5. Clear circulation
There should be a believable path from the door into the room and toward desks.
This is required for future movement.

---

## Scene composition target
Use a 2x2 desk layout with a central aisle.

### Zones
- Mildred desk: upper-left
- Dev desk: upper-right
- Research desk: lower-left
- Content desk: lower-right
- Door: left/lower-left architectural zone
- Reports Tray: lower-right support zone
- Decor: perimeter only

### Important
The central aisle must remain visually open.
Nothing should feel jammed into it.

---

## Grounding rules
To stop the desks from looking like they are flying:
- every desk cluster needs convincing floor contact
- shadows should support the same light logic
- desks should visually connect to the room’s floor plane
- avoid placing desks where the background perspective contradicts them
- avoid scale mismatches between desks and architecture

If grounding fails, the scene fails.

---

## UI chrome rules
Inside the office scene:
- labels should be minimal
- metadata should be secondary
- no obvious card containers around each agent
- no large dashboard blocks fighting the room

The office should read as a world first, status system second.

---

## Agent state direction
### Working
- avatar at desk
- desk occupied
- subtle activity signal

### Blocked
- avatar near desk or standing state eventually
- blocked badge visible
- should read immediately from a glance

### Inactive
- desk empty
- no avatar present

### Finished
- can later route to reports / departure behavior

---

## Movement-readiness direction
The office should be built so later it can support:
- door spawn
- walk path to desk
- desk occupancy
- exit path
- report drop behavior

This means layout decisions now should preserve movement space.

---

## Implementation guidance
Before another major visual pass, ideally create either:
1. a composition mockup, or
2. a stricter scene-config object with explicit anchors

Recommended future config values:
- room bounds
- floor plane region
- door anchor
- tray anchor
- desk anchors
- avatar anchors
- blocked badge anchor offsets
- future path nodes

---

## Definition of success
The office is successful when:
- it looks like one believable pixel office
- objects look grounded, not floating
- nothing feels arbitrarily placed
- it feels like a real operations room
- the scene supports future simple animation
- Philip’s attention goes to the office world first, not dashboard framing

---

## Next recommended step
Before the next Dev pass, Mildred should create:
- a rough visual mockup or staging reference,
- or a scene config / placement board with stronger grounding guidance,
so implementation is no longer interpretive.
