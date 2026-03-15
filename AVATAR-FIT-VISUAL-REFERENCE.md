# AVATAR FIT — VISUAL REFERENCE DIAGRAM
## Quick Reference for Implementation

---

## DESK STATE VISUAL MATRIX

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DESK STATE VISUALS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ACTIVE / WORKING              BLOCKED                                  │
│  ┌─────────────┐               ┌─────────────┐                          │
│  │   ~glow~    │               │   ~glow~    │                          │
│  │    ┌───┐    │               │    ┌───┐ ⚠️ │  ← Badge upper-right    │
│  │    │ A │    │  ← Avatar     │    │ A ├───┤                          │
│  │    └───┘    │    seated     │    └───┘    │                          │
│  │  [DESK]     │               │  [DESK]     │                          │
│  └─────────────┘               └─────────────┘                          │
│                                                                         │
│  • Subtle blue glow            • Same avatar                             │
│  • Avatar seated at desk       • Warm badge offset                       │
│  • "Present and working"       • "Present but stuck"                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INACTIVE / ABSENT             RESERVED                                 │
│  ┌─────────────┐               ┌─────────────┐                          │
│  │             │               │  ~ghosted~  │                          │
│  │   ┌───┐     │               │   ┌───┐     │  ← Faint outline        │
│  │   │   │     │  ← Empty      │   │░░░│     │    or dashed border     │
│  │   └───┘     │    chair      │   └───┘     │                          │
│  │  [DESK]     │               │  [DESK]     │  ← Clean, no items       │
│  └─────────────┘               └─────────────┘                          │
│                                                                         │
│  • No avatar                   • No avatar                               │
│  • No glow                     • Ethereal treatment                      │
│  • "Available/away"            • "Held for future"                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AVATAR PLACEMENT & SCALE

```
RELATIVE TO DESK CHAIR

Desk chair in scene:     Avatar target size:
┌─────────┐              ┌─────────┐
│  chair  │              │  head   │  ← ~25% of height
│  ~45px  │              │  torso  │  ← ~35% of height
│  tall   │              │  (hips) │  ← ~20% visible
└─────────┘              └─────────┘
                              ↑
                         Desk surface
                         (hides legs)

SCALE RATIO: Avatar 1.2x chair height (for readability)
PLACEMENT: Centered on desk, slightly above chair
Z-INDEX: Avatar (10) above desk, below badge (15)
```

---

## LAYER STACK (Visual Order)

```
TOP  ─────────────────────────────────────────
     UI Detail Panel (outside room frame)
     ─────────────────────────────────
     Blocked Badge (z: 15)
     ─────────────────────────────────
     Avatar Sprite (z: 10)
     ─────────────────────────────────
     Desk Glow/Effects (z: 5)
     ─────────────────────────────────
     Master Scene Background (z: 1)
BOTTOM ───────────────────────────────────────
```

---

## COORDINATE REFERENCE

```
NORMALIZED COORDINATES (0-1 scale)

Y=0.0 ───────────────────────────────────────
                                            
         Mildred (0.28, 0.30)    Dev (0.72, 0.30)
              ┌───┐                  ┌───┐
              │ A │                  │ A │
              └───┘                  └───┘
                                            
Y=0.44 ───── Central Aisle ─────────────────
                                            
         Claire (0.28, 0.58)   Future (0.72, 0.58)
              ┌───┐                  ┌───┐
              │ A │                  │   │  ← Reserved
              └───┘                  └───┘
                                            
Y=0.72  ┌──┐                         ┌──┐
       Door                          Tray
       (0.12)                        (0.86)
                                            
Y=1.0 ───────────────────────────────────────
       X=0.0                          X=1.0

AVATAR OFFSET: X=0, Y=-0.02 (slightly above desk center)
BADGE OFFSET: X=+0.04, Y=-0.03 (upper-right of desk)
```

---

## CSS EFFECTS REFERENCE

```css
/* Active desk glow */
.desk-active::after {
  background: radial-gradient(
    ellipse at center,
    rgba(200, 220, 255, 0.15) 0%,
    transparent 70%
  );
  animation: pulse 4s ease-in-out infinite;
}

/* Blocked badge pulse */
.blocked-badge {
  animation: pulse-badge 2s ease-in-out infinite;
}
@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Reserved desk ethereal */
.desk-reserved {
  opacity: 0.75;
  filter: saturate(0.7);
}

/* Avatar seated crop */
.avatar-container {
  height: 45px;      /* Show upper body only */
  overflow: hidden;  /* Hide legs behind desk */
}
```

---

## STATE TRANSITIONS

```
INACTIVE ──→ ACTIVE      Fade in avatar + activate glow
ACTIVE ────→ BLOCKED     Fade in badge (avatar stays)
BLOCKED ───→ ACTIVE      Fade out badge
ACTIVE ────→ INACTIVE    Fade out avatar + deactivate glow
EMPTY ─────→ RESERVED    Apply reserved styling
```

All transitions: 300-500ms, ease-out

---

## QUICK DECISION MATRIX

| Question | Answer |
|----------|--------|
| Do avatars need modification? | No — use existing assets |
| Seated or standing? | Seated crop (CSS) or generate seated variants |
| Animation level? | Micro only — breathing glow, badge pulse |
| Glow color? | Cool blue-white for active, subtle warm for blocked |
| Badge position? | Upper-right of desk, 36px size |
| Reserved treatment? | CSS opacity + desaturation, optional ghost outline |
| Click targets? | Entire desk area, not just avatar |

---

*Visual reference for AVATAR-FIT-REFINEMENT-PACKAGE*  
*March 15, 2026*
