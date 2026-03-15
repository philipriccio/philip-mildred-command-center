# MISSION CONTROL — LIVE-STATE VISUAL PACKAGE
## Claire, Creative Director | March 15, 2026

---

## 1. VISUAL-STATE SYSTEM SUMMARY

The Mission Control office is a **living environment**, not a dashboard. State visualization must:

- **Preserve the room as primary** — the office world always reads first
- **Communicate status at a glance** — without requiring reading or interpretation
- **Use light, elegant overlays** — never overpower the Severance aesthetic
- **Maintain spatial logic** — states exist *in* the world, not on top of it

### Core Principle
> State should feel like natural properties of the office world, not UI widgets imposed upon it.

---

## 2. STATE BEHAVIOR DEFINITIONS

### ACTIVE / WORKING
**What it means:** Agent is present and operational at their desk.

**Visual treatment:**
- Avatar sprite positioned at desk anchor (seated or standing posture)
- Subtle ambient glow around desk area — soft cool-blue or warm-white light wash
- Optional: faint activity indicator (typing animation, subtle screen flicker)
- No badges, no labels — presence itself is the signal

**Behavior:**
- Avatar appears at `mildredAvatar`, `devAvatar`, or `claireAvatar` coordinates
- Light layer activates (CSS gradient or subtle PNG overlay)
- Clicking desk opens detail panel outside the room frame

**Priority:** Primary state — the office feels alive when agents are present.

---

### BLOCKED
**What it means:** Agent is present but cannot proceed (waiting, stuck, needs help).

**Visual treatment:**
- Avatar remains visible at desk anchor
- **Blocked badge** appears at `blocked` anchor offset (upper-right of desk)
- Badge: small, elegant, amber/warm tone — distinct from cool office palette
- Optional: subtle pulse animation on badge (gentle, not urgent)

**Badge specification:**
- Size: ~32–48px (scaled relative to scene)
- Style: Rounded square or subtle circle with minimal icon (⚠ or custom glyph)
- Color: Warm amber (#F5A623) or soft coral — stands out against cool office
- Treatment: Slight drop shadow for depth, but not heavy

**Behavior:**
- Avatar + badge together signal "I'm here but stuck"
- Clicking opens detail with context about the blocker
- Badge should feel like a physical object placed on the desk, not a UI popup

**Priority:** Secondary state — important but not alarmist.

---

### INACTIVE / EMPTY
**What it means:** No agent assigned or agent is away.

**Visual treatment:**
- **No avatar** at desk anchor
- **No light layer** — desk sits in ambient office lighting only
- Desk items remain visible (monitors, etc.) — the space feels maintained
- Slightly cooler tone to the desk area (subtle, almost subliminal)

**Behavior:**
- Clean empty desk — reads as "available" or "awaiting"
- No click interaction (or click shows "No agent assigned" minimal state)
- Room composition remains balanced — empty desks are part of the world

**Priority:** Default state — calm, quiet, ready.

---

### RESERVED (Future Desk)
**What it means:** Desk is intentionally held for future agent assignment.

**Visual treatment:**
- **No avatar** — desk remains unoccupied
- **Subtle reserved indicator** — faint outline or ghosted silhouette of chair
- Desk completely clean — no monitors, no items, no personalization
- Slightly different lighting — softer, more ethereal than active desks
- Optional: very faint "reserved" glyph or symbol (minimal, elegant)

**Key distinction from "empty":**
- Empty = could be assigned, no commitment
- Reserved = intentionally held, future promise

**Visual metaphor:**
> Like a theater seat held with a coat — the space is claimed but not occupied.

**Behavior:**
- Clicking shows "Reserved for future agent" minimal message
- No interaction possible until assigned
- Should feel inviting, not abandoned

**Priority:** Special state — signals growth and future potential.

---

## 3. AVATAR MAPPING & REFINEMENTS

### Current Avatar Direction (Preserved)

| Agent | Base Character | Desk Position | Notes |
|-------|---------------|---------------|-------|
| **Mildred** | Helly-inspired | Top-left (UL) | Leadership presence, composed |
| **Dev** | Dylan-inspired (softened) | Top-right (UR) | Builder energy, approachable |
| **Claire** | Creative director persona | Bottom-left (LL) | Curator aesthetic, visual focus |
| **Future** | — | Bottom-right (LR) | Reserved, no avatar yet |

### Avatar-to-Room Integration

**Scale & Positioning:**
- Avatars should feel like they belong *in* the office, not pasted on top
- Size: ~60–80px relative to scene (proportional to desk chairs)
- Position: Seated at desk, not floating above it
- Shadow: Subtle drop shadow grounding avatar to floor plane

**Posture by State:**
- **Active:** Seated upright, facing monitor (or viewer for Mildred's commanding presence)
- **Blocked:** Same posture + subtle "paused" cue (hand on chin, looking up)

**Style Consistency:**
- All avatars share the same art style (Severance-inspired corporate portraits)
- Consistent lighting direction (match office ambient light)
- No outline strokes — let them live in the scene naturally

### Refinements Needed

**None required for current avatars.** The existing `mildred-avatar-severance-v1` and `dev-avatar-severance-v2` assets are compatible with the approved office world.

**If generating Claire avatar:**
- Match the Severance corporate portrait style
- Curator energy: thoughtful, visually-oriented, slightly more expressive than Helly/Dylan
- Color notes: muted palette, perhaps subtle warm accent (creative warmth within corporate cool)

---

## 4. OVERLAYS & BADGES: IN-WORLD vs UI

### In-World Elements (Part of the Scene)

| Element | Type | Placement | Notes |
|---------|------|-----------|-------|
| **Avatars** | Dynamic sprite | Desk anchor | Lives in the world |
| **Blocked badge** | Status overlay | Blocked anchor | Small, elegant, physical-feeling |
| **Desk light layer** | Ambient effect | Desk area | Subtle glow, not spotlight |
| **Reserved indicator** | Ghost/outline | Future desk | Faint, ethereal, intentional |

### UI Elements (Outside the Room Frame)

| Element | Type | Placement | Notes |
|---------|------|-----------|-------|
| **Agent name** | Label | Detail panel | Outside scene or minimal hover |
| **Status text** | Description | Detail panel | Plain English, clean typography |
| **Action buttons** | Controls | Detail panel | Outside the office world |
| **System notifications** | Alerts | Top/bottom bar | Never overlay the room |

### Hard Rule
> **No dashboard cards inside the office.** The room is not a container for widgets. UI lives outside or is so minimal it disappears into the world.

---

## 5. STATE TRANSITION BEHAVIORS

### Entry (Inactive → Active)
- Avatar fades in at desk anchor (300–500ms)
- Desk light layer activates simultaneously
- Optional: subtle "sitting down" animation if movement system ready

### Block (Active → Blocked)
- Blocked badge fades in at offset position
- Optional: avatar posture shifts to "paused" stance
- No jarring color changes — maintain calm aesthetic

### Unblock (Blocked → Active)
- Badge fades out
- Avatar returns to active posture
- Optional: subtle "resuming" cue

### Exit (Active → Inactive)
- Avatar fades out
- Desk light layer deactivates
- Desk returns to ambient lighting

### Reserve (Empty → Reserved)
- Reserved indicator fades in (ghosted chair/outline)
- Desk remains clean, no items appear

---

## 6. ASSET RECOMMENDATIONS

### Existing Assets (Use As-Is)

| Asset | File | Purpose | Status |
|-------|------|---------|--------|
| Master scene | `office-master-scene-v2-refined-d-v4.png` | Room background | ✓ Approved |
| Mildred avatar | `mildred-avatar-severance-v1.png` | Active state | ✓ Ready |
| Dev avatar | `dev-avatar-severance-v2.png` | Active state | ✓ Ready |
| Research avatar | `research-avatar-severance-v1.png` | Reference only | — |
| Blocked badge | `blocked-badge-v2.png` | Blocked state | ✓ Ready |
| Desk states | `desk-working-v1`, `desk-idle-v1`, `desk-empty-v1` | Reference | — |

### Assets to Generate (If Needed)

| Asset | Purpose | Priority |
|-------|---------|----------|
| **Claire avatar** | Creative director presence at desk | Medium |
| **Reserved desk indicator** | Ghosted chair or subtle outline for future desk | Low |
| **Desk light overlay** | Subtle glow effect for active desks (can be CSS) | Low |

### CSS-First Approach (Recommended)

Many state effects can be achieved without new image assets:

```css
/* Active desk glow */
.desk-active::after {
  content: '';
  position: absolute;
  inset: -10%;
  background: radial-gradient(
    ellipse at center,
    rgba(200, 220, 255, 0.15) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* Blocked badge positioning */
.blocked-badge {
  position: absolute;
  width: 40px;
  height: 40px;
  background: url('blocked-badge-v2.png') center/contain no-repeat;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

/* Reserved desk ethereal effect */
.desk-reserved {
  opacity: 0.7;
  filter: saturate(0.8);
}
```

---

## 7. DEV-READY IMPLEMENTATION NOTES

### Scene Config Integration

Use the existing `OFFICE-SCENE-CONFIG-SPEC-2026-03-15.md` anchors:

```typescript
// State-to-visual mapping
const stateVisuals = {
  mildred: {
    inactive: { avatar: null, light: false, badge: null },
    active: { avatar: 'mildred-avatar.png', light: true, badge: null },
    blocked: { avatar: 'mildred-avatar.png', light: true, badge: 'blocked.png' }
  },
  dev: {
    inactive: { avatar: null, light: false, badge: null },
    active: { avatar: 'dev-avatar.png', light: true, badge: null },
    blocked: { avatar: 'dev-avatar.png', light: true, badge: 'blocked.png' }
  },
  claire: {
    inactive: { avatar: null, light: false, badge: null },
    active: { avatar: 'claire-avatar.png', light: true, badge: null },
    blocked: { avatar: 'claire-avatar.png', light: true, badge: 'blocked.png' }
  },
  future: {
    reserved: { avatar: null, light: false, badge: null, reserved: true },
    inactive: { avatar: null, light: false, badge: null, reserved: false }
  }
};
```

### Layer Order (Z-Index)

```
z-index:  1 — Master scene background
z-index:  5 — Desk light overlays (active state)
z-index: 10 — Avatars
z-index: 15 — Blocked badges
z-index: 20 — Reserved indicators (future desk)
z-index: 100 — UI detail panel (outside room)
```

### Click Region Behavior

| State | Click Result |
|-------|--------------|
| Active | Open agent detail panel |
| Blocked | Open agent detail panel (with blocker context) |
| Inactive | No action or "Available desk" tooltip |
| Reserved | "Reserved for future agent" minimal message |

### Responsive Considerations

- All coordinates in config spec are normalized (0–1)
- Scale proportionally with container
- Maintain aspect ratio to prevent distortion
- Minimum width: 600px (below this, consider alternative layout)

---

## 8. QUALITY CHECKLIST

Before shipping, verify:

- [ ] Room remains primary — no state overlay dominates
- [ ] Active desks feel alive but not busy
- [ ] Blocked state is clear without being alarming
- [ ] Empty desks feel calm, not broken
- [ ] Reserved desk feels intentional, not abandoned
- [ ] Avatars feel grounded in the scene
- [ ] No UI cards inside the office frame
- [ ] All states legible at a glance
- [ ] Severance aesthetic preserved throughout
- [ ] Transitions feel smooth, not jarring

---

## SUMMARY

This visual-state system treats the Mission Control office as a **living world** where agent presence, status, and availability are communicated through subtle, elegant cues that live *within* the environment rather than on top of it.

**Key principles:**
1. Room first, always
2. State as natural property, not UI widget
3. Light touch — less is more
4. Consistent spatial logic
5. Preserve the Severance atmosphere

The existing assets are sufficient for implementation. Claire avatar generation is a nice-to-have, not a blocker. CSS-based effects can handle most state transitions elegantly.

---

*Prepared by Claire, Creative Director*  
*March 15, 2026*
