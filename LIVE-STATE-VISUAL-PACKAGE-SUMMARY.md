# LIVE-STATE VISUAL PACKAGE — EXECUTIVE SUMMARY
## Claire, Creative Director | March 15, 2026

---

## DELIVERABLE

**Full Package:** `LIVE-STATE-VISUAL-PACKAGE-2026-03-15.md`

---

## WHAT I DEFINED

### Four Core States

| State | Visual Treatment | Key Cue |
|-------|-----------------|---------|
| **ACTIVE** | Avatar present + subtle desk glow | Presence = activity |
| **BLOCKED** | Avatar + amber badge at offset | "Here but stuck" |
| **INACTIVE** | Clean empty desk, no avatar | Available, calm |
| **RESERVED** | Ghosted chair, clean desk, ethereal | Future promise |

### Avatar Integration

- **Mildred** (Helly-inspired) → Top-left desk
- **Dev** (Dylan-inspired, softened) → Top-right desk  
- **Claire** (creative director) → Bottom-left desk
- **Future** → Bottom-right desk (reserved, no avatar)

**No avatar refinements needed** — existing assets fit the approved office world.

### In-World vs UI Boundary

| In-World (Scene) | UI (Outside Frame) |
|-----------------|-------------------|
| Avatars | Agent names |
| Blocked badges | Status descriptions |
| Desk light layers | Action buttons |
| Reserved indicators | System notifications |

**Hard rule:** No dashboard cards inside the office.

---

## KEY DECISIONS

1. **Light layers over spotlights** — subtle ambient glow, not theatrical
2. **Amber for blocked** — warm contrast against cool Severance palette
3. **Reserved as ethereal** — ghosted, intentional, not abandoned
4. **CSS-first effects** — most states achievable without new assets

---

## ASSET STATUS

| Asset | Status | Action |
|-------|--------|--------|
| Master scene | ✓ Approved | Use `office-master-scene-v2-refined-d-v4.png` |
| Mildred avatar | ✓ Ready | Use existing |
| Dev avatar | ✓ Ready | Use existing |
| Blocked badge | ✓ Ready | Use existing |
| Claire avatar | Nice-to-have | Generate when convenient |
| Reserved indicator | Low priority | CSS ghost effect sufficient |

---

## DEV HANDOFF

Implementation uses existing `OFFICE-SCENE-CONFIG-SPEC-2026-03-15.md` anchors:

- Position avatars at `{agent}Avatar` coordinates
- Position blocked badges at `{agent}Blocked` offsets
- Toggle light layers via CSS (no new assets needed)
- Reserved state: opacity + desaturation on future desk

---

## QUALITY BAR

- Room remains primary — states are subordinate
- Legible at a glance — no reading required
- Elegant, not busy — Severance aesthetic preserved
- Spatially coherent — everything lives in the world

---

## NEXT STEP

Dev can proceed with implementation using existing assets. Claire avatar generation is optional polish, not a blocker.

---

*Claire, Creative Director*  
*Mission Control / Command Center*
