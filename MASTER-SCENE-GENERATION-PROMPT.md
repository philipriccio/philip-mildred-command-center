# MASTER SCENE GENERATION PROMPT
## Ready for Image Generation Tool

---

## PRIMARY PROMPT (Copy-Paste Ready)

```
A pixel art office interior in the style of Severance (Apple TV series) — a slightly eerie, hyper-clean corporate workspace. The room is a single coherent environment with:

ROOM ARCHITECTURE:
- Clean white/off-white walls with subtle corporate sterility
- Light-colored floor with visible grid or tile pattern suggesting depth
- Soft ambient lighting with no harsh shadows
- Slightly desaturated color palette with occasional subtle accent

FOUR WORKSTATIONS (2x2 grid layout):
Upper row:
- Upper-left: A tidy executive-style desk with minimal items, leadership presence
- Upper-right: A developer desk with monitors visible, slightly more cluttered

Lower row:
- Lower-left: A research desk with papers/notes aesthetic
- Lower-right: A content desk with creative tools visible

Each desk should:
- Feel grounded to the same floor plane
- Cast consistent soft shadows
- Have similar scale and perspective
- Be clearly readable as a workstation

DOOR:
- Positioned on the left wall, lower area
- Corporate office door, closed
- Architecturally integrated, not floating

REPORTS TRAY:
- Positioned on right side, lower area
- Physical inbox tray on a small stand or table
- Secondary visual weight, support object

COMPOSITION:
- Central aisle/walkway preserved between left and right desk columns
- No clutter in the middle of the room
- Perimeter decor minimal: perhaps one plant, one cabinet
- Overall feeling: calm, sterile, slightly unsettling corporate perfection

STYLE:
- Pixel art but refined and premium
- Isometric-ish perspective (management sim style)
- Consistent lighting direction from upper left
- No characters/avatars in this master scene — just the environment
- 16:9 aspect ratio, high resolution
```

---

## TECHNICAL SPECS

| Parameter | Value |
|-----------|-------|
| Aspect Ratio | 16:9 |
| Resolution | 1920x1080 or 2560x1440 |
| Style | Pixel art, Severance-inspired |
| Palette | Desaturated whites, subtle corporate tones |
| Lighting | Soft ambient, upper-left direction |
| Characters | None (empty desks only) |
| Text | None |

---

## GENERATION TOOL OPTIONS

### Option 1: fal.ai (Recommended)
**Model:** `fal-ai/flux-pro/v2` or `fal-ai/recraft/v3`
**Endpoint:** `fal.ai/models/{model}/text-to-image`

### Option 2: Midjourney
**Version:** v6 or v6.1
**Parameters:** `--ar 16:9 --style raw --s 250`

### Option 3: GPT-4o Image Generation
**Direct prompt as written above**

---

## DESIRED OUTPUTS

Generate **4-6 variants** and save to:
```
/Users/mildred/.openclaw/workspace/projects/command-center/assets/generated/
office-master-scene-v1.png
office-master-scene-v2.png
office-master-scene-v3.png
office-master-scene-v4.png
```

---

## SELECTION CRITERIA

Choose the best variant based on:
1. **Floor plane coherence** — do all desks feel grounded?
2. **Perspective consistency** — same angle across all elements?
3. **Desk placement** — clean 2x2 grid readable?
4. **Door integration** — feels architectural, not floating?
5. **Tray placement** — feels like a physical object?
6. **Overall coherence** — one world, not a collage?

---

## APPROVAL PATH

1. Generate variants
2. Claire reviews against criteria
3. Philip selects final
4. Dev implements using approved master scene

---

*Prompt prepared for execution via available image generation tool*
