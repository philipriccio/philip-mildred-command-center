# Reports Tray & Detail Panel — Quick Reference
## Claire | March 15, 2026

---

## REPORTS TRAY

**What it is:** Physical in-world surface (bottom-right, x 86% y 78%) where completed reports land.

**Visual treatment:**
- Smaller than desks, reads as support furniture
- Document stacks with subtle lane-color edges
- New reports animate in with satisfying slide
- No text on documents — visual suggestion only

**Lane accents (subtle):**
- Hawco: blue edge
- Company Theatre: amber edge
- Self-e-Tape: green edge
- Personal: neutral edge

**Anti-patterns:**
- No scrolling
- No badges with numbers
- No card/list UI inside tray
- No report titles visible

---

## DETAIL PANEL

**Placement:** Outside room frame, right side (360px width)

**Structure:**
1. Header: Avatar + Agent name + plain-English status
2. Task section: What they're working on (2–3 line summary)
3. Meta: Model, started time, deadline
4. Blocker section (if applicable): Amber accent, plain explanation

**Typography:**
- Agent name: 18px medium
- Task title: 16px medium
- Body: 14px regular
- Meta labels: 12px muted uppercase

**Colors:**
- Background: `rgba(26,26,31,0.95)` with blur
- Text: `#f0f0f5` (primary), `#8a8a95` (secondary)
- Active accent: `#6b9fff` (blue)
- Blocked accent: `#f5a623` (amber)

**Plain English rules:**
- "Working on this now" not "Status: in_progress"
- "Using Claude 4" not model ID string
- "Started 2 hours ago" not ISO timestamp

---

## UI RESTRAINT RULES

**Cardinal sins:**
1. No cards inside the room
2. No scrolling in the scene
3. No numbers as primary info
4. No persistent desk labels
5. No chrome inside the frame

**Dashboard energy detection:**
- "Quick stat summary" → Reject
- "Task count on desk" → Reject
- "Mini progress bar" → Reject
- "Expandable tray list" → Reject

**Room-first checklist:**
- [ ] Element exists IN world or OUTSIDE it — never on top
- [ ] Status readable from room screenshot alone
- [ ] Feels like game world, not dashboard
- [ ] Would survive in real physical space

---

## DEV SPECS

**Animations:**
- Panel slide: 300ms ease-out-quad
- Document arrival: 300ms ease-out-quad
- Desk highlight pulse: 2s infinite

**CSS-first approach:**
- Panel: `backdrop-filter: blur(12px)`
- Documents: CSS rectangles with transforms
- Lane accents: border-top colors
- Desk highlight: `::after` pseudo-element

**No new assets required** — implement with existing sprites + CSS.

---

## SUCCESS CRITERIA

Philip opens Mission Control and:
1. Sees a living office first
2. Understands status from world state
3. Clicks a desk to get readable context
4. Never feels like he's using a dashboard

The room is the interface. UI is a reading lens.
