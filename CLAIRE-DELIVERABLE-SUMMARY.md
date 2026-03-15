# CLAIRE DELIVERABLE — MASTER SCENE PACKAGE
## Mission Control / Command Center

---

## WHAT WAS DELIVERED

### 1. Creative Direction Document
**File:** `MASTER-SCENE-CREATIVE-PACKAGE-2026-03-14.md`

Complete creative package including:
- Approved direction reminder (Master Scene First)
- Exact creative approach and visual DNA
- Generation prompts and specifications
- Deliverable structure
- Dynamic layering plan
- Implementation notes for Dev
- Approval checkpoints

### 2. Generation-Ready Prompt
**File:** `MASTER-SCENE-GENERATION-PROMPT.md`

Copy-paste ready prompt for image generation tools:
- Primary generation prompt (full detail)
- Technical specifications table
- Tool options (fal.ai, Midjourney, GPT-4o)
- Selection criteria
- Output naming convention

### 3. Visual Staging Diagram
**File:** `MASTER-SCENE-STAGING-DIAGRAM.md`

Text-based reference showing:
- Overall composition layout
- Anchor coordinates (normalized)
- Layer order
- Spatial rules and alignment
- Severance aesthetic checklist
- Anti-patterns to avoid
- Success criteria

---

## THE MASTER SCENE APPROACH (RECAP)

**Problem:** Previous attempts created a collage feel — floating desks, mismatched perspective, inconsistent scale.

**Solution:** Generate ONE unified office environment first, then layer dynamic elements on top.

**Key principle:** The master scene is a complete world, not a background for separate sprites.

---

## NEXT STEP: IMAGE GENERATION

I do not have direct image generation access in this environment. The next step is:

### Route to Generation Tool

**Recommended tools in order:**
1. **fal.ai** — FLUX.2 [pro] or Recraft V3
2. **Midjourney** — v6 or v6.1
3. **GPT-4o** — Native image generation

**Prompt location:** `MASTER-SCENE-GENERATION-PROMPT.md`

**Generate:** 4-6 variants
**Save to:** `assets/generated/office-master-scene-v{n}.png`

---

## SELECTION CRITERIA (FOR CLAIRE/PHILIP)

When reviewing generated variants, prioritize:

1. **Floor plane coherence** — everything grounded?
2. **Perspective consistency** — same angle everywhere?
3. **2x2 desk grid readability** — immediately clear?
4. **Door architecture** — feels like real door?
5. **Tray physicality** — feels like real object?
6. **Overall world coherence** — one scene, not collage?

---

## AFTER GENERATION: DEV HANDOFF

Once the master scene is approved, Dev receives:

1. **Approved master scene PNG** — the base layer
2. **Scene config** — anchor coordinates (from Staging Diagram)
3. **Implementation notes** — from Creative Package
4. **Layering strategy** — what goes on top, in what order

---

## DYNAMIC LAYERS (POST-MASTER-SCENE)

These will be implemented AFTER the master scene is locked:

| Layer | Element | Implementation |
|-------|---------|----------------|
| Avatar | Agent sprites at desks | Positioned via config anchors |
| State | Blocked badges | Overlay at desk offset |
| UI | Labels, tooltips | Outside scene frame or minimal |
| Animation | Entry/exit/movement | Path nodes from config |

---

## QUALITY BAR

This package is designed for:
- **Near-finish thinking** — not exploratory
- **Excellence first** — no shortcuts
- **Production coherence** — solves the collage problem
- **Specific guidance** — Dev should not need to interpret

---

## FILES SUMMARY

| File | Purpose | For Whom |
|------|---------|----------|
| `MASTER-SCENE-CREATIVE-PACKAGE-2026-03-14.md` | Full creative direction | Claire, Philip, Mildred |
| `MASTER-SCENE-GENERATION-PROMPT.md` | Ready-to-run prompt | Mildred (to route) |
| `MASTER-SCENE-STAGING-DIAGRAM.md` | Visual reference | Dev, Claire |

---

## APPROVAL STATUS

- [x] Master Scene First approach approved by Philip
- [x] Creative package prepared by Claire
- [ ] Master scene generated (pending tool access)
- [ ] Master scene approved by Philip
- [ ] Dev implementation (pending scene approval)

---

*Prepared by Claire, Creative Director*
*March 14, 2026*
