# MISSION CONTROL — AVATAR FIT & STATE REFINEMENT PACKAGE
## Claire, Creative Director | March 15, 2026

---

## 1. EXECUTIVE SUMMARY

This package defines how existing avatars integrate into the approved office world, establishing scale, placement, and state treatment rules that preserve the Severance aesthetic while ensuring clear readability.

**Key principle:** Avatars are guests in the room, not decorations on top of it. They must feel grounded, proportional, and naturally present.

---

## 2. AVATAR-TO-ROOM FIT ANALYSIS

### Current Asset Inventory

| Asset | Style | Status | Notes |
|-------|-------|--------|-------|
| **Mildred avatar** | Pixel art, standing | ✓ Ready | Helly-inspired, dark green suit, red hair |
| **Dev avatar** | Pixel art, standing | ✓ Ready | Dylan-inspired (softened), cream shirt, teal tie |
| **Research avatar** | Pixel art, standing | Reference only | Exists but not currently assigned |
| **Blocked badge** | Pixel art, life preserver | ✓ Ready | Warm red/orange, distinctive shape |
| **Master scene** | Isometric illustration | ✓ Approved | Four desks, Severance aesthetic, grounded |

### Critical Observation: Style Bridge Required

The avatars (pixel art, front-facing) and the office (isometric illustration) exist in different visual languages. This is **intentional and acceptable** — the pixel art avatars read as "digital entities" inhabiting a physical space, which reinforces the Severance "innies/outties" metaphor.

**However**, proper integration requires careful attention to:
1. **Scale consistency** — avatars must feel proportionate to desk chairs
2. **Grounding** — avatars must appear seated, not floating
3. **Lighting harmony** — pixel art should feel lit by the same ambient source

---

## 3. SCALE & PLACEMENT RULES

### Avatar Scale

```
RELATIVE SIZING (to office scene)

Desk chair height in scene: ~40-50px
Avatar target height (seated): ~55-65px
Avatar target width: ~35-45px

This places avatars at roughly 1:1.2 scale to chairs —
slightly larger for readability, but not comically so.
```

### Placement Coordinates

Using the existing anchor system from the Staging Diagram:

```
DESK ANCHOR POSITIONS (normalized 0-1)
┌─────────────────────────────────────────┐
│                                         │
│    Mildred (0.28, 0.30)    Dev (0.72, 0.30)
│         ┌───┐                  ┌───┐    │
│         │ A │                  │ A │    │  ← Avatar sits
│         └───┘                  └───┘    │    at desk center
│                                         │
│  ─────────── Central Aisle ───────────  │
│                                         │
│    Claire (0.28, 0.58)   Future (0.72, 0.58)
│         ┌───┐                  ┌───┐    │
│         │ A │                  │   │    │  ← Future desk
│         └───┘                  └───┘    │    (reserved/empty)
│                                         │
└─────────────────────────────────────────┘

AVATAR OFFSET FROM DESK CENTER:
- X: 0 (centered horizontally)
- Y: -0.02 (slightly above desk center, to appear seated behind)
- Z-index: 10 (above desk, below blocked badge)
```

### Visual Grounding Treatment

**Problem:** Standing pixel-art avatars placed directly at desk coordinates will appear to float.

**Solution:** Implement a "seated crop" approach

```
SEATED AVATAR TREATMENT

Original avatar (full body):
┌─────────┐
│  HEAD   │  ← 25% of height
│  TORSO  │  ← 35% of height
│  LEGS   │  ← 40% of height
└─────────┘

Displayed avatar (seated crop):
         ┌─────────┐
         │  HEAD   │  ← Show 100%
         │  TORSO  │  ← Show 100%
Desk ────┤  HIPS   ├────  ← Show top 20% only
         └─────────┘
         (legs hidden behind desk)

Visual result: Avatar appears seated at desk,
with desk surface covering lower body.
```

**Implementation note:** Use CSS `clip-path` or `overflow: hidden` on avatar container, or pre-generate seated variants if preferred.

---

## 4. STATE REFINEMENT SPECIFICATIONS

### STATE 1: ACTIVE / WORKING

**Visual definition:** Agent present and operational

**Avatar treatment:**
- Seated crop displayed at desk anchor
- Subtle "active" posture — upright, facing forward
- Optional: micro-animation (subtle breathing/bob at 2-3s cycle)

**Ambient treatment:**
- Soft radial gradient behind desk (CSS)
- Color: `rgba(200, 220, 255, 0.12)` — cool blue-white
- Size: 150% of desk area
- Animation: Very slow pulse (4s cycle, barely perceptible)

**Click behavior:** Opens agent detail panel

---

### STATE 2: BLOCKED

**Visual definition:** Agent present but stuck/waiting

**Avatar treatment:**
- Same seated crop as Active
- Optional: subtle posture shift (hand on chin, head slightly tilted)

**Badge placement:**
```
BLOCKED BADGE POSITIONING

Desk area:     Badge appears at upper-right of desk
┌──────────┐
│      ┌───┤  ← Badge: 32-40px
│      │ ! │     Offset: +0.04 X, -0.03 Y from desk center
│ Avatar └───┤     Z-index: 15 (above avatar)
└──────────┘

Badge specs:
- Size: 36px (relative to scene)
- Style: Use existing blocked-badge-v2.png
- Treatment: Drop shadow for depth
- Animation: Gentle pulse (2s cycle, 0.95-1.05 scale)
```

**Ambient treatment:**
- Same as Active (maintain presence)
- Optional: very subtle warm tint to gradient (amber at 5% opacity)

**Click behavior:** Opens agent detail panel with blocker context

---

### STATE 3: INACTIVE / ABSENT

**Visual definition:** No agent at desk

**Avatar treatment:**
- **No avatar displayed**
- Empty chair visible (part of master scene)

**Ambient treatment:**
- No glow effect
- Desk sits in ambient office lighting only
- Optional: very subtle cool tint (desaturate desk area by 10%)

**Visual result:** Clean, quiet, available desk

**Click behavior:** No action or "Available desk" tooltip

---

### STATE 4: RESERVED (Future Desk)

**Visual definition:** Desk held for future agent

**Avatar treatment:**
- **No avatar displayed**
- Ghosted chair outline or subtle "reserved" indicator

**Reserved indicator options (CSS-first):**
```css
/* Option A: Ghosted chair outline */
.desk-reserved::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 50px;
  border: 2px dashed rgba(150, 160, 170, 0.4);
  border-radius: 4px;
  /* Positioned at chair location */
}

/* Option B: Subtle ethereal glow */
.desk-reserved {
  opacity: 0.75;
  filter: saturate(0.7);
}
```

**Ambient treatment:**
- No active glow
- Slightly ethereal/desaturated compared to other desks
- Desk clean — no monitors, no personal items

**Visual result:** Intentionally held space, not abandoned

**Click behavior:** "Reserved for future agent" minimal message

---

## 5. EXPRESSION & ROLE IDENTITY

### Current Avatar Character Assessment

| Avatar | Role | Current Expression | Assessment |
|--------|------|-------------------|------------|
| Mildred | Leadership | Composed, direct gaze | ✓ Strong — reads as authority |
| Dev | Builder | Friendly, slight smile | ✓ Good — approachable but professional |
| Claire (future) | Creative | — | Should match style, thoughtful/curator energy |

### Role Readability Without Overpowering

**The balance:** Avatars must be recognizable at a glance, but not demand attention.

**Achieved through:**
1. **Consistent sizing** — all avatars same scale
2. **Restrained positioning** — all at desk centers, no dramatic offsets
3. **Limited animation** — only micro-movements (breathing, not waving)
4. **Color discipline** — avatars use muted corporate palette

**Anti-patterns to avoid:**
- ❌ Avatars larger than desks
- ❌ Avatars with outline strokes (creates sticker effect)
- ❌ Avatars animated with entrance effects on every state change
- ❌ Avatars with facial expressions that change (too busy)

---

## 6. ASSET REFINEMENT RECOMMENDATIONS

### Required: None

The existing avatar assets (`mildred-avatar-severance-v1`, `dev-avatar-severance-v2`) are compatible with the approved office world.

### Recommended: Seated Variants (Optional)

If the "crop" approach feels insufficient, generate seated versions:

**Seated avatar prompt (if needed):**
```
Pixel art character, seated at desk posture, facing forward slightly angled,
Severance corporate style, [character description],
muted color palette, transparent background,
same art style as existing avatars,
upper body visible, hands resting on desk
```

**Priority:** Low — CSS crop approach is sufficient for MVP

### Future: Claire Avatar

When ready to assign Claire to a desk:
- Match existing pixel art style
- Curator energy: thoughtful, visually-oriented
- Slightly more expressive than Mildred/Dev (creative role)
- Color note: subtle warm accent within corporate palette

---

## 7. DEV-READY IMPLEMENTATION NOTES

### Layer Stack (Z-Index)

```
z-index:   1 — Master scene background
z-index:   5 — Desk ambient glow (active state)
z-index:  10 — Avatar sprites
z-index:  15 — Blocked badges
z-index:  20 — Reserved indicators
z-index: 100 — UI detail panel (outside room)
```

### State Configuration

```typescript
interface DeskState {
  agentId: string | null;
  status: 'inactive' | 'active' | 'blocked' | 'reserved';
  avatar: string | null;      // PNG path or null
  showGlow: boolean;
  showBadge: boolean;
  badgeType: 'blocked' | null;
  reserved: boolean;
}

const deskConfig: Record<string, DeskState> = {
  mildred: {
    agentId: 'mildred',
    status: 'active',
    avatar: '/assets/mildred-avatar-severance-v1.png',
    showGlow: true,
    showBadge: false,
    badgeType: null,
    reserved: false
  },
  dev: {
    agentId: 'dev',
    status: 'blocked',
    avatar: '/assets/dev-avatar-severance-v2.png',
    showGlow: true,
    showBadge: true,
    badgeType: 'blocked',
    reserved: false
  },
  claire: {
    agentId: 'claire',
    status: 'inactive',
    avatar: null,
    showGlow: false,
    showBadge: false,
    badgeType: null,
    reserved: false
  },
  future: {
    agentId: null,
    status: 'reserved',
    avatar: null,
    showGlow: false,
    showBadge: false,
    badgeType: null,
    reserved: true
  }
};
```

### CSS Implementation

```css
/* Avatar container with seated crop */
.avatar-container {
  position: absolute;
  width: 45px;          /* Scaled relative to scene */
  height: 45px;         /* Crop to upper body */
  overflow: hidden;     /* Hide legs behind desk */
  transform: translate(-50%, -50%);
}

.avatar-container img {
  width: 100%;
  height: auto;
  object-fit: cover;
  object-position: top; /* Show head/torso, hide legs */
}

/* Active desk glow */
.desk-glow {
  position: absolute;
  width: 120%;
  height: 120%;
  background: radial-gradient(
    ellipse at center,
    rgba(200, 220, 255, 0.15) 0%,
    transparent 70%
  );
  animation: pulse-glow 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* Blocked badge */
.blocked-badge {
  position: absolute;
  width: 36px;
  height: 36px;
  background: url('/assets/blocked-badge-v2.png') center/contain no-repeat;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Reserved desk */
.desk-reserved {
  opacity: 0.75;
  filter: saturate(0.7);
}
```

### Responsive Scaling

```typescript
// All coordinates normalized (0-1), scale to container
const scaleToContainer = (
  normalizedCoord: number,
  containerSize: number
) => normalizedCoord * containerSize;

// Minimum readable size: 600px width
// Below this: consider alternative layout or simplified view
```

---

## 8. FUTURE MOVEMENT READINESS

### Nice-to-Have Assets for Movement Phase

| Asset | Purpose | Priority |
|-------|---------|----------|
| **Walking sprites** (side/back views) | Avatar movement between desks | Medium |
| **Standing variant** | Avatar "getting up" transition | Low |
| **Door entry/exit** | Avatar entering/leaving room | Low |
| **Tray interaction pose** | Avatar at reports tray | Low |

### Movement Path Planning

```
FUTURE MOVEMENT PATHS (preserve clear routes)

Entry/Exit: Door (0.12, 0.72) → nearest desk
Central aisle: Keep clear for crossing movement
Tray access: Path from any desk to tray (0.86, 0.78)

Avatar movement should follow floor perspective,
maintaining isometric alignment with room.
```

---

## 9. QUALITY CHECKLIST

Before shipping avatar integration:

- [ ] Avatars feel proportional to desk chairs (not too large/small)
- [ ] Avatars appear grounded (seated crop working correctly)
- [ ] Active state has subtle glow, not spotlight
- [ ] Blocked badge is visible but not alarming
- [ ] Inactive desks feel calm, not broken
- [ ] Reserved desk feels intentional, not abandoned
- [ ] No avatar draws disproportionate attention
- [ ] All states readable at a glance
- [ ] Severance aesthetic preserved (muted, corporate, quiet)
- [ ] Room remains primary, avatars are secondary

---

## 10. SUMMARY

**Avatar Fit Principles:**
1. **Room-first** — avatars support the office world, don't dominate it
2. **Grounded** — seated crop or seated variants ensure physical presence
3. **Consistent scale** — all avatars same size, proportional to furniture
4. **Restrained expression** — role identity through presence, not animation

**State Treatment Rules:**
- **Active:** Avatar + subtle glow = "present and working"
- **Blocked:** Avatar + badge = "present but stuck"
- **Inactive:** No avatar = "available/away"
- **Reserved:** Ghosted indicator = "held for future"

**Asset Status:**
- ✓ Existing avatars compatible — no refinement needed
- ✓ Blocked badge ready — use as-is
- ○ Claire avatar — generate when role assigned
- ○ Seated variants — optional, CSS crop sufficient for MVP

**Implementation:**
- CSS-first approach for glows and effects
- Normalized coordinates for responsive scaling
- Layer stack maintains visual hierarchy
- Future movement paths preserved in layout

---

*Prepared by Claire, Creative Director*  
*March 15, 2026*
