# MISSION CONTROL — MOVEMENT VISUAL-GUIDELINES PACKAGE
## First Movement Phase | Claire, Creative Director | March 15, 2026

---

## 1. MOVEMENT PHILOSOPHY

### How Movement Should Feel

The Mission Control office is a **controlled environment** — movement should reflect that. This is not a game with bouncy characters. This is a management simulation where agents move with **purpose, restraint, and believability**.

**The feeling:**
- Deliberate, not rushed
- Professional, not playful  
- Grounded in the physical space
- Almost meditative in its quiet efficiency

**Reference energy:**
- Severance corridor walks — purposeful, unhurried
- Management sims (Two Point Hospital, Theme Hospital) — readable but restrained
- Real office movement — people walk, stop, sit, work

**Anti-reference:**
- Platformer bounciness
- Idle game waddling
- Cartoon squash-and-stretch
- Fast, gamey movement speeds

---

## 2. MOVEMENT BEHAVIOR RULES

### 2.1 ARRIVAL — Entering from Door

**Trigger:** Agent becomes active (from inactive state)

**Movement sequence:**
1. **Door opens** — subtle animation or state change
2. **Avatar appears** at door anchor (0.12, 0.72)
3. **Walk to desk** — follows path to assigned desk anchor
4. **Sit down** — brief transition (standing → seated crop)
5. **Active state** — glow activates, agent is "at work"

**Path rules:**
- Door → nearest desk point → desk anchor
- Use central aisle (x 0.44–0.56) for crossing between left/right sides
- Maintain isometric perspective alignment
- No diagonal shortcuts across desk areas

**Timing:**
- Door to desk: 1.5–2.5 seconds (unhurried walk)
- Sit transition: 0.3–0.5 seconds
- Total arrival: ~2.5 seconds

**Visual notes:**
- Avatar faces walking direction while moving
- Walking animation: subtle bob, 2-frame cycle max
- No arm swinging — keep it minimal
- Shadow follows avatar, grounded to floor

---

### 2.2 WORKING — At Desk

**State:** Agent is active and operational

**Movement:**
- **None** — avatar remains seated at desk
- **Micro-animation only:** Subtle breathing bob (2–3s cycle, 1–2px vertical)
- Optional: occasional "typing" hand movement (very subtle)

**Rule:** Working agents do not move. They are present. The desk glow and their presence is the signal.

---

### 2.3 BLOCKED — Stuck Near Desk

**Trigger:** Agent status changes to blocked

**Visual treatment:**
- Avatar remains at desk anchor (seated)
- **Posture shift:** Subtle "paused" cue
  - Hand to chin, or
  - Head slightly tilted, or
  - Looking up from screen
- Blocked badge appears at offset position
- Optional: very subtle "stuck" animation (leaning back slightly)

**Movement restraint:**
- No pacing
- No frustrated gestures
- No looping "confused" animation
- The badge + posture shift is enough

**Timing:**
- Posture transition: 0.5s ease
- Badge fade-in: 0.3s
- No continuous animation while blocked

---

### 2.4 LEAVING — Done / Exiting

**Trigger:** Agent becomes inactive or task completes

**Movement sequence:**
1. **Stand up** — seated crop → standing (0.3–0.5s transition)
2. **Walk to door** — reverse of arrival path
3. **Exit through door** — avatar fades or walks off-screen
4. **Door closes** — subtle animation or state change
5. **Inactive state** — desk returns to ambient lighting

**Path rules:**
- Desk → nearest aisle point → door
- Same path as arrival, reversed
- No lingering or hesitation

**Timing:**
- Stand transition: 0.3–0.5 seconds
- Desk to door: 1.5–2.5 seconds
- Exit fade: 0.3 seconds
- Total departure: ~2.5 seconds

**Visual notes:**
- Avatar faces walking direction
- Same walking animation as arrival
- Clean exit — no "looking back" or hesitation

---

## 3. THE "BLOCKED NEAR DESK" SPECIFICATION

### What It Should Look Like

**The scene:** Agent is at their desk, but something is preventing progress. They are present but paused.

**Visual composition:**
```
┌─────────────────────────────┐
│  ┌─────────┐                │
│  │  [⚠]   │ ← Blocked badge (amber, upper-right)
│  │  👤    │ ← Avatar (seated, "paused" posture)
│  └─────────┘ ← Desk         │
│                             │
└─────────────────────────────┘
```

**Blocked posture options (choose one per avatar):**
1. **Hand to chin** — thoughtful, assessing the blocker
2. **Leaning back slightly** — paused, waiting
3. **Head tilted up** — looking away from screen, considering

**Badge placement:**
- Offset: +40px X, -30px Y from desk center (relative to scene scale)
- Size: 36px
- Animation: Gentle pulse (2s cycle, 0.95–1.05 scale)
- Style: Warm amber, life preserver shape (existing asset)

**What NOT to do:**
- ❌ Avatar stands up and paces
- ❌ Avatar shakes head repeatedly
- ❌ "Help!" bubble or text
- ❌ Red alarm colors
- ❌ Continuous looping animation

**The feeling:** Calm, professional acknowledgment of a blocker. Not distress. Just "paused."

---

## 4. THE "DONE / LEAVING" SPECIFICATION

### What It Should Look Like

**The scene:** Agent has completed their work or is going inactive. They pack up and leave.

**Visual sequence:**
```
Frame 1: Avatar seated at desk (active state)
         ↓
Frame 2: Stand transition (0.3s)
         ↓
Frame 3: Avatar standing at desk, facing door
         ↓
Frame 4: Walking toward door (1.5–2.5s)
         ↓
Frame 5: At door, fading out (0.3s)
         ↓
Frame 6: Door closed, desk empty (inactive state)
```

**Standing transition:**
- If using seated crop: fade to standing sprite
- If using full avatar: show full body as standing
- Transition time: 0.3–0.5s

**Walking out:**
- Same speed as arrival (unhurried)
- Same animation style (subtle bob, no arm swing)
- Faces toward door while walking

**Exit treatment:**
- Avatar fades to 0% opacity at door position
- OR: walks "through" door and disappears
- Door subtle animation: closes or returns to neutral

**What NOT to do:**
- ❌ Avatar waves goodbye
- ❌ Celebratory animation
- ❌ Running or rushing
- ❌ Looking back at desk
- ❌ Disappearing instantly (no fade)

**The feeling:** Clean, professional departure. Work complete, time to go. No drama.

---

## 5. ANIMATION RESTRAINT RULES

### The "Elegant, Not Cartoony" Mandate

**Frame rate:** 12–15 fps for character animation (not 60fps smooth)
**Frame count:** Maximum 2-frame walk cycle
**Movement speed:** Slow, deliberate (see timing specs above)

### Allowed Animations

| Animation | Frames | When Used |
|-----------|--------|-----------|
| Walking | 2 frames | Arrival, departure, tray trips |
| Breathing | Subtle CSS | Always when seated |
| Badge pulse | CSS scale | When blocked |
| Glow pulse | CSS opacity | When active |
| Stand/sit transition | Crossfade | Arrival/departure only |

### Forbidden Animations

| Animation | Why Forbidden |
|-----------|---------------|
| Arm swinging | Too cartoony, draws attention |
| Leg movement while walking | Unnecessary complexity |
| Head bobbing | Distracting, too lively |
| Facial expression changes | Too subtle to read, adds complexity |
| Jumping / bouncing | Completely wrong energy |
| Celebratory gestures | Unprofessional for this world |
| Frustrated gestures | Blocked should be calm, not emotional |

### CSS-First Approach

Most "animation" should be CSS transitions:

```css
/* Walking bob — subtle, 2-frame feel */
@keyframes walk-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

.avatar-walking {
  animation: walk-bob 0.6s steps(2) infinite;
}

/* Breathing — barely perceptible */
@keyframes breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1px); }
}

.avatar-seated {
  animation: breathe 3s ease-in-out infinite;
}

/* Badge pulse — gentle attention */
@keyframes badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.blocked-badge {
  animation: badge-pulse 2s ease-in-out infinite;
}
```

---

## 6. MINIMUM AVATAR-STATE/MOTION NEEDS

### For First Movement Pass (MVP)

**Required assets:**
1. **Standing avatar** (front-facing) — for arrival/departure transitions
2. **Seated avatar** (or seated crop) — for working/blocked states
3. **Walking state** — can be standing sprite with bob animation

**Required animations:**
1. **Walk cycle** — 2-frame bob while moving between points
2. **Stand/sit transition** — crossfade or simple swap
3. **Blocked posture** — static offset or subtle lean

**Required paths:**
1. **Door → Mildred desk**
2. **Door → Dev desk**
3. **Door → Research desk**
4. **Door → Content desk**
5. **Reverse paths** for departure

**Implementation minimum:**
- Linear interpolation between path points
- CSS transitions for state changes
- No pathfinding required (predefined routes)
- No collision detection needed (paths don't overlap)

### Nice-to-Have (Future Phases)

| Feature | Phase | Notes |
|---------|-------|-------|
| Tray trips | 2 | Agent walks to tray, returns to desk |
| Cross-room visits | 2 | Agent visits another desk |
| Side/back walking sprites | 2 | Smoother direction changes |
| Door open/close animation | 2 | Currently: state change sufficient |
| Sitting animation (not crop) | 3 | Full sit-down motion |
| Multiple blocked postures | 3 | Variety per agent |

---

## 7. PATH SPECIFICATION

### Anchor-to-Anchor Routes

**Path structure:**
```
Door (0.12, 0.72)
  ↓
Aisle junction (0.12, 0.58) — bottom of central aisle
  ↓
[Branch to left or right desks]

Left route:
  Aisle junction → Mildred/Research aisle point (0.28, 0.58)
    ↓
  Mildred desk (0.28, 0.30) OR Research desk (0.28, 0.58)

Right route:
  Aisle junction → Dev/Content aisle point (0.72, 0.58)
    ↓
  Dev desk (0.72, 0.30) OR Content desk (0.72, 0.58)
```

**Path waypoints (normalized coordinates):**

```typescript
const movementPaths = {
  doorToMildred: [
    { x: 0.12, y: 0.72 },   // Door
    { x: 0.12, y: 0.58 },   // Aisle junction
    { x: 0.28, y: 0.58 },   // Left aisle
    { x: 0.28, y: 0.30 }    // Mildred desk
  ],
  doorToDev: [
    { x: 0.12, y: 0.72 },   // Door
    { x: 0.12, y: 0.58 },   // Aisle junction
    { x: 0.72, y: 0.58 },   // Right aisle
    { x: 0.72, y: 0.30 }    // Dev desk
  ],
  doorToResearch: [
    { x: 0.12, y: 0.72 },   // Door
    { x: 0.12, y: 0.58 },   // Aisle junction
    { x: 0.28, y: 0.58 }    // Research desk
  ],
  doorToContent: [
    { x: 0.12, y: 0.72 },   // Door
    { x: 0.12, y: 0.58 },   // Aisle junction
    { x: 0.72, y: 0.58 }    // Content desk
  ]
};

// Reverse paths for departure
```

**Visual path rules:**
- Follow floor perspective (isometric alignment)
- Keep within central aisle boundaries (x 0.44–0.56)
- No cutting across desk areas
- Maintain consistent walking speed throughout

---

## 8. DEV-READY IMPLEMENTATION NOTES

### State Machine

```typescript
type MovementState = 
  | 'inactive'      // Not in room
  | 'entering'      // Door → desk (walking)
  | 'sitting'       // Stand → sit transition
  | 'working'       // At desk, seated
  | 'blocked'       // At desk, blocked posture
  | 'standing'      // Sit → stand transition  
  | 'leaving'       // Desk → door (walking)
  | 'exiting';      // At door, fading out

interface AgentMovement {
  agentId: string;
  currentState: MovementState;
  currentPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  pathProgress: number; // 0-1 along current path segment
  facing: 'left' | 'right' | 'front';
}
```

### Movement Controller

```typescript
class MovementController {
  // Move agent along path
  moveAlongPath(
    agent: AgentMovement,
    path: Waypoint[],
    speed: number, // normalized units per second
    deltaTime: number
  ): void {
    // Interpolate between waypoints
    // Update facing based on movement direction
    // Trigger state changes at path end
  }

  // Handle state transitions
  transitionState(
    agent: AgentMovement,
    newState: MovementState
  ): void {
    // Play appropriate transition animation
    // Update visual state
    // Set timers for automatic next-state
  }
}
```

### CSS Classes for States

```css
/* Base avatar */
.avatar {
  position: absolute;
  transform: translate(-50%, -50%);
  transition: opacity 0.3s ease;
}

/* Movement states */
.avatar.walking {
  animation: walk-bob 0.6s steps(2) infinite;
}

.avatar.seated {
  animation: breathe 3s ease-in-out infinite;
  /* Or use clip-path for seated crop */
  clip-path: inset(0 0 30% 0);
}

.avatar.blocked {
  /* Static offset or subtle lean */
  transform: translate(-50%, -50%) rotate(-2deg);
}

/* Facing directions */
.avatar.facing-left { transform: scaleX(-1); }
.avatar.facing-right { transform: scaleX(1); }
.avatar.facing-front { /* default */ }
```

### Timing Constants

```typescript
const MOVEMENT_TIMING = {
  walkSpeed: 0.25,        // normalized units per second
  sitTransition: 400,     // ms
  standTransition: 400,   // ms
  doorFade: 300,          // ms
  badgePulse: 2000,       // ms cycle
  breatheCycle: 3000,     // ms cycle
  walkBob: 600            // ms cycle
};
```

---

## 9. MUST-HAVE VS NICE-TO-HAVE

### Must-Have (First Movement Pass)

| Feature | Priority | Notes |
|---------|----------|-------|
| Door entry | P0 | Agent appears at door, walks to desk |
| Desk arrival | P0 | Agent sits down, becomes active |
| Desk departure | P0 | Agent stands, walks to door |
| Door exit | P0 | Agent fades at door, becomes inactive |
| Walking animation | P0 | Subtle bob, 2-frame feel |
| Path following | P0 | Linear interpolation between waypoints |
| Facing direction | P0 | Face movement direction |

### Nice-to-Have (Phase 2+)

| Feature | Priority | Notes |
|---------|----------|-------|
| Tray trips | P1 | Agent walks to tray, returns |
| Inter-desk visits | P1 | Agent visits another desk |
| Door open/close anim | P1 | Visual door state change |
| Multiple blocked poses | P2 | Per-agent variety |
| Sitting animation | P2 | Full motion, not just crop |
| Side/back sprites | P2 | Smoother multi-directional movement |
| Path overlap handling | P2 | Agents pass each other gracefully |

### Out of Scope (Future Considerations)

- Collision detection (paths don't overlap in current layout)
- Complex pathfinding (predefined routes sufficient)
- Facial expressions during movement
- Interactive movement (click to move)
- Speed variations (consistent pace fits the world)

---

## 10. QUALITY CHECKLIST

Before shipping first movement pass:

- [ ] Arrival feels unhurried and professional
- [ ] Departure feels clean and complete
- [ ] Walking animation is subtle, not bouncy
- [ ] Agents face the direction they're moving
- [ ] Sit/stand transitions are smooth
- [ ] Blocked state is calm, not dramatic
- [ ] Movement preserves room-first composition
- [ ] Paths follow logical office routes
- [ ] Timing feels deliberate, not rushed
- [ ] No animation draws disproportionate attention
- [ ] Severance aesthetic maintained throughout

---

## SUMMARY

**Movement Principles:**
1. **Restrained** — minimal animation, maximum readability
2. **Believable** — professional office movement, not game physics
3. **Room-first** — movement serves the world, doesn't dominate it
4. **Management-sim energy** — purposeful, calm, efficient

**Key Behaviors:**
- **Arrival:** Door → desk → sit (2.5s, unhurried)
- **Working:** Still presence + micro-animation only
- **Blocked:** Seated + posture shift + badge (calm, not distressed)
- **Leaving:** Stand → desk → door → fade (2.5s, clean exit)

**Animation Rules:**
- 2-frame walk cycle max
- CSS-first for most effects
- No arm swinging, no bouncing, no celebrations
- Timing: slow and deliberate

**Implementation Priority:**
- P0: Entry, exit, sit/stand, walking bob
- P1: Tray trips, door animation
- P2: Multi-direction sprites, variety poses

---

*Prepared by Claire, Creative Director*  
*March 15, 2026*
