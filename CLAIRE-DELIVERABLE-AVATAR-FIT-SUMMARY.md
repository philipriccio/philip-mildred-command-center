# CLAIRE DELIVERABLE — AVATAR FIT & STATE REFINEMENT
## Mission Control / Command Center

---

## WHAT WAS DELIVERED

### 1. Avatar Fit & State Refinement Package
**File:** `AVATAR-FIT-REFINEMENT-PACKAGE-2026-03-15.md`

Complete visual package including:
- Avatar-to-room fit analysis
- Scale and placement rules (with seated crop approach)
- State refinement specifications (Active, Blocked, Inactive, Reserved)
- Expression and role identity guidelines
- Asset refinement recommendations
- Dev-ready implementation notes
- Future movement readiness planning

### 2. Visual Reference Diagram
**File:** `AVATAR-FIT-VISUAL-REFERENCE.md`

Quick-lookup text diagrams showing:
- Desk state visual matrix (all four states)
- Avatar placement and scale relationships
- Layer stack (z-index order)
- Coordinate reference
- CSS effects reference
- State transitions
- Quick decision matrix

---

## KEY FINDINGS

### Existing Assets: Compatible

The current avatar assets (`mildred-avatar-severance-v1`, `dev-avatar-severance-v2`) work with the approved office world **without modification**.

**Style bridge:** Pixel art avatars + isometric office is intentional — digital entities inhabiting physical space reinforces the Severance "innies/outties" metaphor.

### Critical Integration Point: Grounding

Standing avatars placed at desk coordinates will appear to float. Solution: **CSS seated crop** (hide legs behind desk) or generate seated variants.

**Recommendation:** CSS crop for MVP — sufficient and flexible.

---

## STATE SYSTEM SUMMARY

| State | Visual | Meaning |
|-------|--------|---------|
| **Active** | Avatar + subtle blue glow | Present and working |
| **Blocked** | Avatar + glow + amber badge | Present but stuck |
| **Inactive** | Empty desk, no glow | Available/away |
| **Reserved** | Ghosted/ethereal desk | Held for future agent |

All states:
- Room-first (office always reads first)
- Restrained (no dramatic animations)
- Legible at a glance

---

## SCALE & PLACEMENT RULES

```
AVATAR SIZE: ~55-65px (1.2x desk chair height for readability)
PLACEMENT: Centered at desk anchor, slightly above chair
BADGE: 36px, upper-right offset from desk center
Z-INDEX: Avatar (10) above desk, below badge (15)
```

---

## ASSET RECOMMENDATIONS

### Use As-Is (No Changes)
- ✓ `mildred-avatar-severance-v1.png`
- ✓ `dev-avatar-severance-v2.png`
- ✓ `blocked-badge-v2.png`
- ✓ `office-master-scene-v2-refined-d-v4.png`

### Generate When Ready
- ○ Claire avatar (match existing style, curator energy)

### Optional (Nice-to-Have)
- ○ Seated avatar variants (if CSS crop insufficient)
- ○ Walking sprites (for future movement phase)

---

## DEV HANDOFF NOTES

Implementation is **CSS-first** where possible:
- Glow effects: CSS radial gradients
- Reserved state: CSS opacity + filter
- Avatar crop: CSS overflow hidden
- Animations: CSS keyframes (subtle pulse only)

All coordinates normalized (0-1) for responsive scaling.

See package for:
- TypeScript interface definitions
- CSS code blocks
- Layer stack specification
- Responsive scaling logic

---

## QUALITY BAR

This package delivers:
- ✓ Room-first hierarchy preserved
- ✓ Elegant, restrained treatment
- ✓ Existing avatar concept preserved
- ✓ Clear state readability
- ✓ Future movement paths preserved
- ✓ Dev-ready implementation guidance

**No weak or generic work.** All recommendations are specific to the Severance aesthetic and Mission Control context.

---

## APPROVAL STATUS

- [x] Avatar fit analysis complete
- [x] State refinement specifications defined
- [x] Scale/placement rules established
- [x] Dev-ready notes prepared
- [ ] Implementation (pending Dev)
- [ ] Visual QA after integration

---

## FILES SUMMARY

| File | Purpose | For Whom |
|------|---------|----------|
| `AVATAR-FIT-REFINEMENT-PACKAGE-2026-03-15.md` | Complete visual package | Claire, Philip, Mildred, Dev |
| `AVATAR-FIT-VISUAL-REFERENCE.md` | Quick-lookup diagrams | Dev, QA |

---

*Prepared by Claire, Creative Director*  
*March 15, 2026*
