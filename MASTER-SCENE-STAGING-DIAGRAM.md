# MASTER SCENE — VISUAL STAGING DIAGRAM
## Text-Based Reference for Generation & Implementation

---

## OVERALL COMPOSITION (16:9 Canvas)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [WALL / DECOR — minimal, corporate, subtle]                │
│                                                             │
│                                                             │
│       ┌─────────┐              ┌─────────┐                  │
│       │ MILDRED │              │   DEV   │                  │
│       │  DESK   │              │  DESK   │                  │
│       │  (UL)   │              │  (UR)   │                  │
│       └─────────┘              └─────────┘                  │
│                                                             │
│                  ← CENTRAL AISLE →                          │
│                        (keep clear)                         │
│                                                             │
│       ┌─────────┐              ┌─────────┐                  │
│       │ RESEARCH│              │ CONTENT │                  │
│       │  DESK   │              │  DESK   │                  │
│       │  (LL)   │              │  (LR)   │                  │
│       └─────────┘              └─────────┘                  │
│                                                             │
│  ┌────┐                                            ┌────┐   │
│  │DOOR│                                            │TRAY│   │
│  │(L) │                                            │(R) │   │
│  └────┘                                            └────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ANCHOR COORDINATES (Normalized 0-1)

```
Y=0.0 ───────────────────────────────────────────────────────
                                                             
       [UPPER WALL ZONE — minimal decor]                     
                                                             
Y=0.30        ┌─────────┐        ┌─────────┐                 
       │      │ MILDRED │        │   DEV   │      │          
       │      │  0.28   │        │  0.72   │      │          
       │      └─────────┘        └─────────┘      │          
       │                                          │          
       │          ← CENTRAL AISLE →               │          
       │           (0.44 to 0.56)                 │          
       │                                          │          
Y=0.58        ┌─────────┐        ┌─────────┐                 
       │      │ RESEARCH│        │ CONTENT │      │          
       │      │  0.28   │        │  0.72   │      │          
       │      └─────────┘        └─────────┘      │          
       │                                          │          
Y=0.72  ┌──┐                                     ┌──┐        
       │DOOR│                                   │TRAY│       
       │0.12│                                   │0.86│       
       └──┘                                     └──┘        
                                                             
Y=1.0 ───────────────────────────────────────────────────────
       ^                                          ^          
      X=0.0                                      X=1.0

Desk width: ~0.18 | Desk height: ~0.15
Door: 0.12, 0.72 | Tray: 0.86, 0.78
```

---

## LAYER ORDER (Back to Front)

```
Layer 1: Room Background (walls, floor, lighting)
    ↓
Layer 2: Architectural Elements (door frame, windows)
    ↓
Layer 3: Floor Details (tile patterns, shadows)
    ↓
Layer 4: Perimeter Decor (plant, cabinet — minimal)
    ↓
Layer 5: Desks (all four, grounded to floor)
    ↓
Layer 6: Desk Items (monitors, papers, etc.)
    ↓
Layer 7: Door (if not in background)
    ↓
Layer 8: Reports Tray
    ↓
Layer 9: Avatar Sprites (dynamic)
    ↓
Layer 10: State Overlays (blocked badges — dynamic)
    ↓
Layer 11: UI Elements (labels, tooltips — minimal)
```

---

## CRITICAL SPATIAL RULES

### The 2x2 Grid
```
┌─────────────────┬─────────────────┐
│   MILDRED       │      DEV        │
│   (Leadership)  │    (Builder)    │
│                 │                 │
├─────────────────┼─────────────────┤ ← Central aisle gap
│                 │                 │
│   RESEARCH      │    CONTENT      │
│   (Analyzer)    │   (Creator)     │
│                 │                 │
└─────────────────┴─────────────────┘
```

### Alignment Rules
- Left desks align vertically (x ≈ 0.28)
- Right desks align vertically (x ≈ 0.72)
- Top desks align horizontally (y ≈ 0.30)
- Bottom desks align horizontally (y ≈ 0.58)
- Central aisle: x 0.44–0.56 (keep visually open)

### Grounding Requirements
```
CORRECT (Grounded):
     Desk sits ON floor
     ↓
    ┌───┐
    │   │ ← shadow connects to floor
    └───┘
    █████ ← floor plane visible

INCORRECT (Floating):
    ┌───┐
    │   │ ← no floor contact
    └───┘
         
    █████ ← floor disconnected
```

---

## SEVERANCE AESTHETIC CHECKLIST

```
✓ Sterile white/off-white walls
✓ Corporate cleanliness (slightly unsettling)
✓ Minimal, intentional decor
✓ Soft, even lighting (no dramatic shadows)
✓ Desaturated palette with subtle blue/cool undertones
✓ Grid-like order and symmetry
✓ Sense of quiet, controlled environment
✓ No warmth, no personality, no clutter
✓ "Lumon Industries" vibes (if you know, you know)
```

---

## ANTI-PATTERNS (DO NOT ALLOW)

```
❌ Floating desks with no floor contact
❌ Mismatched perspective (some isometric, some flat)
❌ Door as a floating icon instead of architecture
❌ Tray as a UI panel instead of physical object
❌ Desks at different scales
❌ Clutter in central aisle
❌ Dashboard-style labels or chrome
❌ Avatars in the master scene
❌ Text in the environment
❌ Busy patterns or warm colors
```

---

## SUCCESS CRITERIA

```
✓ One coherent room (not a collage)
✓ Four desks in readable 2x2 grid
✓ All objects grounded to same floor plane
✓ Door feels architectural
✓ Tray feels physical
✓ Central aisle preserved
✓ Severance aesthetic achieved
✓ No floating elements
✓ Ready for avatar layering
✓ Future animation paths plausible
```

---

*Staging diagram for Master Scene generation and implementation*
