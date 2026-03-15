# OFFICE STAGING REFERENCE — March 14, 2026

## Purpose
This document is the visual staging target for Mission Control's office scene.
It exists so Dev can code to a visual composition instead of interpreting prose.

## Scene sentence
A shared Severance-inspired pixel office: four agent desks in a calm, eerie corporate room, with a clear door, a believable floor plane, a central aisle for movement, and every object feeling grounded and intentionally placed.

## Main read
When the scene loads, the eye should read in this order:
1. one coherent room
2. the 2x2 desk arrangement
3. who is present/active
4. support objects like the Reports Tray

If the first read is “dashboard widgets,” the scene has failed.

## Camera / perspective target
- Slightly top-down management-sim perspective
- Straight enough to keep desks readable
- Consistent floor plane
- Enough depth that desks feel placed into the room, not pasted flat to the screen

## Floor logic
The floor is critical. The desks currently feel like they float because they are not visually anchored to a believable floor plane.

Requirements:
- Desks must sit on clearly readable floor area
- Each desk cluster should have grounding/shadow support
- Desk spacing should respect room depth
- Door should visually connect to the same floor plane as the desks
- Reports Tray should also live on that floor plane

## Room composition target
### Upper band
- wall / windows / quiet corporate background detail
- no clutter
- no heavy UI

### Middle band
- upper pair of desks: Mildred left, Dev right
- breathing room around each
- central aisle preserved

### Lower band
- lower pair of desks: Research left, Content right
- enough space beneath them that the room still feels navigable

### Left lower zone
- architectural door
- obvious entry/exit area in front of door
- no desk crowding near it

### Right lower zone
- Reports Tray
- support object only, not competing with desks

## Exact staging intent
### Mildred desk
- should feel like the most legible and slightly most centered leadership station
- upper-left but not jammed into the wall

### Dev desk
- mirrors Mildred on the upper-right
- should create symmetry with Mildred across the central aisle

### Research desk
- lower-left, aligned with Mildred vertically
- should feel orderly and observant

### Content desk
- lower-right, aligned with Dev vertically
- should complete the 2x2 map cleanly

## Symmetry / alignment rules
- The top two desks should feel horizontally aligned
- The bottom two desks should feel horizontally aligned
- Left desks should share a clear column
- Right desks should share a clear column
- The center lane should visually separate left and right columns
- Avoid accidental diagonals or random staggering

## Door staging
The door must feel architectural, not decorative.

Requirements:
- Larger than a badge/icon feel
- Positioned against wall logic
- Leave open floor directly in front of it
- This will later be the spawn/exit zone for avatars

## Reports Tray staging
The tray should feel like a real support object.

Requirements:
- secondary visual weight
- bottom-right support zone
- not centered
- not attached to a panel/card
- not scaled so large that it competes with desks

## Decor staging
Decor should reinforce the room but never become the scene.

Use decor:
- near perimeter
- near wall/corner logic
- sparingly

Do not use decor:
- in the center aisle
- between desk and viewer if it breaks readability
- as filler for empty space

## Avatar staging
Avatars must feel part of the desks.

Requirements:
- each avatar belongs to its workstation
- no detached floating character feeling
- scale must match desk size
- if avatar placement obscures too much of desk art, reposition instead of shrinking everything blindly

## Label staging
Labels should be tiny, restrained, and secondary.
If a label is large enough to feel like a card header, it is too large.

## UI chrome rule
Outside the scene is where dashboard structure can live.
Inside the scene should be almost entirely world logic.

Meaning:
- avoid banners, pills, panel headers, and explanatory chrome inside the office frame
- keep the scene clean enough that it reads like a little world

## What to do if the scene still feels wrong
Check this order:
1. Is the floor plane convincing?
2. Are the desks truly aligned in a 2x2 map?
3. Does the door feel architectural?
4. Is the tray too prominent or misplaced?
5. Is any object floating because scale/perspective is off?
6. Is dashboard UI contaminating the room?

## Definition of success
The scene is correct when Philip feels:
- the room is real,
- the desks belong in it,
- the objects are grounded,
- and future simple movement would make sense naturally.

## Next implementation recommendation
After this staging pass, extract all final anchors into a dedicated scene config so future animation and asset swaps stay visually stable.
