# SHARPENED PERSONALITY PASS — GENERATION BRIEF
## Mission Control Master Scene — Refined v2
## Claire, Creative Director — March 14, 2026

---

## EXECUTIVE SUMMARY

**Previous Issue:** The desk-personality pass had better intention but not best precision. Risk of becoming more detailed without becoming more exact.

**This Refinement:** Sharper identity cues, cleaner execution, stronger readability at a glance.

**Core Principle:** Less "more stuff." More "sharper identity."

---

## WHAT CHANGES (AND WHAT DOESN'T)

### PRESERVED (Do Not Change)
- ✅ Unified master-scene method — one coherent office world
- ✅ Single-chair fix — one chair per desk only
- ✅ Open floor plan — no cubicle dividers
- ✅ 2x2 desk grid layout
- ✅ Door on left wall
- ✅ Window/filing cabinet back-right
- ✅ Clock on right wall
- ✅ Central aisle preserved
- ✅ Severance aesthetic — sterile, corporate, slightly eerie

### REFINED (Sharpened Identity)

#### MILDRED'S DESK — "LEADERSHIP"
**Before:** Premium desk, dual monitors, plant, organizer
**After:** 
- High-back leather executive chair (authority silhouette)
- Dual monitors — matching, perfectly aligned (precision)
- Almost EMPTY desk surface — just ONE elegant pen, ONE small leather notebook
- ONE sophisticated plant in simple ceramic pot
- **The message:** "I'm in control, I don't need clutter to prove I'm working"

**Anti-pattern to avoid:** Multiple plants, busy organizers, scattered items

---

#### DEV'S DESK — "BUILDER"
**Before:** Multiple screens, technical books, robot figurine
**After:**
- Ergonomic chair — functional, not flashy
- Large main monitor + laptop on stand (clear multi-device setup)
- **VISIBLE MECHANICAL KEYBOARD** — this is the key identity cue
- Stack of 2-3 technical books — neatly arranged, spines showing
- ONE small robot figurine or retro tech item
- Cable management visible — organized, not chaotic
- **The message:** "I build things, my tools are purposeful"

**Anti-pattern to avoid:** Messy cables, random clutter, "chaotic coder" stereotype

---

#### CLAIRE'S DESK — "CREATIVE DIRECTOR"
**Before:** Drawing tablet, mood board, design books, plant
**After:**
- Design-conscious chair — subtle flair (distinctive but not loud)
- Drawing tablet visible — clearly a creative tool
- **Small CURATED reference board** — 3-4 images, arranged with intention (NOT a messy collage)
- ONE design book — lying flat, cover visible
- ONE small aesthetic object — sculpture, interesting rock, design object
- **The message:** "I curate visual taste, every item is chosen"

**Anti-pattern to avoid:** Mood board with too many images, scattered papers, "artist mess" stereotype

---

#### FOURTH DESK — "RESERVED"
**Before:** Clean minimal desk, basic chair, single monitor
**After:**
- Simple basic chair — positioned invitingly (not pushed away)
- Clean empty desk surface — completely empty
- NO monitor (or unpowered blank one if needed for balance)
- NO personal items, NO plants, NO decorations
- **The message:** "This space is intentionally held for someone"

**Anti-pattern to avoid:** Making it look abandoned or like storage

---

## GENERATION PROMPT (OPTIMIZED)

```
Pixel art isometric office, Severance aesthetic, sterile corporate workspace. 
White walls, light gray grid tile floor, soft ambient lighting.
Door on left wall, window back wall, clock right wall.
White filing cabinet with plants, back-right corner.

FOUR DESKS:

1. LEADERSHIP (top-right): High-back leather executive chair, dual matching monitors perfectly aligned, almost empty desk with one elegant pen and small leather notebook, one sophisticated plant in ceramic pot. Premium, commanding, minimal.

2. BUILDER (bottom-left): Ergonomic chair, large monitor plus laptop on stand, visible mechanical keyboard, stack of 2-3 technical books neatly arranged, small robot figurine. Organized, functional, technical.

3. CREATIVE (bottom-center): Design-conscious chair with subtle flair, drawing tablet on desk, small curated reference board with 3-4 arranged images, one design book lying flat, one small aesthetic object. Curated, visual, tasteful.

4. RESERVED (right side): Simple basic chair positioned invitingly, clean completely empty desk surface, no items no plants no decorations. Intentionally held space.

Open floor plan, central aisle, consistent isometric perspective, no avatars, no text, one chair per desk.
```

---

## TECHNICAL SPECIFICATIONS

| Parameter | Value |
|-----------|-------|
| **Model** | FLUX.1 [dev] or FLUX.2 [pro] via fal.ai |
| **Aspect Ratio** | 16:9 (1920x1080) or 1:1 (1024x1024) |
| **Style** | Pixel art isometric, Severance-inspired |
| **Palette** | Desaturated whites, subtle corporate tones |
| **Lighting** | Soft ambient, even, no harsh shadows |
| **Characters** | None (empty desks only) |
| **Text** | None |

---

## GENERATION INSTRUCTIONS

### Option 1: fal.ai (Preferred — matches previous workflow)
```bash
# Using inference.sh or direct API
fal-ai/flux-pro/v2 or fal-ai/recraft/v3

Prompt: [Optimized prompt above]
Aspect ratio: 16:9 or 1:1
```

### Option 2: Pollinations (Free, if fal unavailable)
```
https://image.pollinations.ai/prompt/[URL_ENCODED_PROMPT]?width=1920&height=1080&seed=100&nologo=true
```

### Option 3: Local SD WebUI
- Model: `pixel-art-xl.safetensors`
- Available at: `~/.openclaw/stable-diffusion-webui/models/Stable-diffusion/`

---

## OUTPUT FILES

Save generated variants to:
```
/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/
├── office-master-scene-sharpened-v1.png
├── office-master-scene-sharpened-v2.png
├── office-master-scene-sharpened-v3.png
└── office-master-scene-sharpened-v4.png
```

---

## SELECTION CRITERIA

When reviewing generated variants, prioritize:

1. **Immediate readability** — Can you tell each desk's role at a glance?
2. **Clean execution** — No visual noise, every item earns its place
3. **Structural clarity** — Floor plane coherent, perspective consistent
4. **Severance aesthetic** — Sterile, corporate, slightly unsettling calm
5. **No clutter** — Nothing that doesn't communicate role
6. **Sharper, not busier** — Identity through precision, not decoration

---

## COMPARISON: BEFORE vs AFTER

| Aspect | Previous Pass | Sharpened Pass |
|--------|---------------|----------------|
| Mildred's desk | Premium, organized | **Minimal, commanding** — empty surface is the statement |
| Dev's desk | Technical setup | **Builder identity** — mechanical keyboard as key cue |
| Claire's desk | Creative tools | **Curated taste** — reference board with intention |
| Fourth desk | Minimal, waiting | **Intentionally held** — inviting emptiness |
| Overall feel | Better intention | **Sharper precision** — cleaner, more exact |

---

## QUALITY BAR

- ✅ One coherent office world
- ✅ Clear and elegant role-specific desks
- ✅ Strong readability at a glance
- ✅ Cleaner, more intentional, more precise than the last pass
- ✅ No overdecorating, no clutter
- ✅ Compositional clarity preserved
- ✅ No generic office filler

---

## APPROVAL PATH

1. Generate 3-4 variants using this brief
2. Claire reviews against selection criteria
3. Present strongest option to Philip
4. Philip selects final or requests adjustment
5. Dev implements using approved master scene

---

## REMAINING RISKS

1. **Generation model may not render all specific cues** — mechanical keyboard, exact book count, etc.
2. **Perspective consistency** — must maintain isometric throughout
3. **Empty vs abandoned** — fourth desk must read as intentionally reserved, not forgotten

---

*Prepared by Claire, Creative Director*
*March 14, 2026*
