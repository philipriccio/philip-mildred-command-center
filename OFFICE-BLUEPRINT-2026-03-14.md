# OFFICE BLUEPRINT — March 14, 2026

## Purpose
This is the implementation blueprint for the Mission Control office scene.
Dev should follow this closely and should **not improvise scene composition**.

The goal is to eliminate approximate placement.

---

## 1) Core rule
The office is **one shared pixel-art room**.
It is **not** four cards, widgets, columns, or panels.

Everything should be placed inside one scene with intentional spatial logic.

---

## 2) Background rule
Use this room background as the base environment layer:
- `/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/office-background-empty-v1.png`

Do **not** use a room background that visually contains desks/workstations.
Do **not** place desks on top of built-in desks.

---

## 3) Scene layer order
Render in this order, back to front:

1. **Room background**
2. **Door**
3. **Decor / architectural props**
4. **Desk sprites**
5. **Avatar sprites**
6. **State overlays** (blocked badge, subtle labels, active highlights)
7. **Interactive UI overlays** (tooltips/details only when needed)

Rule: if something visually reads wrong, reduce overlays first before moving the room structure.

---

## 4) Coordinate system
Use the office canvas as a normalized rectangle.
Think in percentages of the total room width/height.

Assume origin:
- x = 0% at left edge
- y = 0% at top edge
- x = 100% at right edge
- y = 100% at bottom edge

These are target **anchor zones**, not single-pixel mandates.
But placement should stay very close.

---

## 5) Fixed room anchors

### Door anchor
- Position: **bottom-left quadrant**, near left wall
- Target anchor: **x 12%, y 72%**
- It should feel like a real room exit/entry, not a floating badge.
- Leave visible floor space directly in front of it for future avatar arrival/departure.

### Reports Tray anchor
- Position: **bottom-right quadrant**, near right wall
- Target anchor: **x 86%, y 78%**
- It should read as a physical in-room object.
- Do not center it and do not make it look like a separate dashboard tile.

### Decor anchor zone
Use decor sparingly, mostly toward perimeter.
Preferred zones:
- upper wall area
- side wall area
- corners
- never in the central walking lane

Decor should not compete with desks.

---

## 6) Desk blueprint
Use a simple 2x2 map with one shared room.

### Mildred desk
- Quadrant: **upper-left**
- Desk anchor target: **x 28%, y 30%**
- Mildred is the most central leadership presence, so this desk should feel tidy and readable.

### Dev desk
- Quadrant: **upper-right**
- Desk anchor target: **x 72%, y 30%**
- Should feel parallel to Mildred’s desk.

### Research desk
- Quadrant: **lower-left**
- Desk anchor target: **x 28%, y 58%**
- Maintain similar left alignment with Mildred’s desk.

### Content desk
- Quadrant: **lower-right**
- Desk anchor target: **x 72%, y 58%**
- Maintain similar alignment with Dev’s desk.

### Desk spacing rules
- Upper desks and lower desks should form a readable grid.
- Left pair should align vertically.
- Right pair should align vertically.
- Do not stagger randomly.
- Keep enough gap between left and right desks to preserve a central aisle.
- Keep enough gap between upper and lower desks to avoid visual crowding.

---

## 7) Central walking lane
This is important for future movement.

Reserve a visible open lane approximately:
- **x 44% to 56%** across most of the room height

This lane should remain mostly clear of:
- desks
- tray
- bulky decor
- floating labels

Future avatar movement should plausibly work through:
- door → central lane → desk
- desk → central lane → door

---

## 8) Avatar placement
Each avatar should be positioned relative to its desk, not floating independently.

### General rule
- Avatar should read as belonging to the workstation.
- Avoid placing avatars so far from desks that they look detached.
- Avoid placing avatars directly on top of desk details in a way that makes the art unreadable.

### Default anchor relationship
For now, use one of these depending on desk art:
- centered slightly in front of the desk, or
- centered slightly behind/within the workstation zone if the art reads better that way

But be consistent across all four desks.

### State logic
- **working:** avatar present in desk position
- **inactive:** desk visible, avatar absent
- **blocked:** avatar visible near desk with blocked badge
- **done later:** avatar can disappear or path toward door

---

## 9) Blocked badge placement
- The blocked badge should attach to the agent/desk area
- It should not cover the face
- It should not hide the desk completely
- Place it at a corner offset relative to the desk/avatar cluster
- Keep it visually obvious but not huge

---

## 10) Labels and UI text
- Keep labels minimal
- The room should read as a room first
- Avoid large headers, card labels, boxed metadata, or dashboard chrome inside the office scene
- If labels are needed, keep them small and secondary

---

## 11) Overlap rules
Never allow these overlaps:
- desk on top of built-in desk imagery
- desk covering door
- tray covering desk
- decor placed in the middle of the aisle
- avatar covering entire desk so workstation disappears
- blocked badge covering avatar face
- labels floating in a way that breaks the room illusion

If overlap happens, fix the layout instead of shrinking everything blindly.

---

## 12) Scale rules
- Desks should feel like they belong to the same room
- Avatars should feel proportionate to desks
- Door should feel like part of the architecture
- Tray should be smaller than a desk cluster and read as a support object

If uncertain, prioritize believable office scale over maximal visibility.

---

## 13) Definition of done
This pass is successful only if:
- the office reads as one shared room
- the 2x2 desk arrangement is immediately legible
- the door and tray look like real room objects
- the central aisle is preserved
- nothing important overlaps awkwardly
- the scene feels game-like and ready for future movement

---

## 14) Deliverables
For the next handoff, include:
- updated office implementation
- screenshots of the main office and reports state
- a short note on whether actual anchor coordinates/path nodes should be extracted into explicit config next
