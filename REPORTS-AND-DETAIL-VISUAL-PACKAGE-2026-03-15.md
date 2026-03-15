# MISSION CONTROL — REPORTS TRAY & DETAIL PANEL VISUAL PACKAGE
## Claire, Creative Director | March 15, 2026

---

## 1. DESIGN PHILOSOPHY

The office world is the primary experience. All UI must feel like it *supports* the room, not competes with it.

**Core principle:**
> The room is the interface. UI is a reading lens, not a replacement.

This package defines two follow-on visual layers:
1. **Reports Tray** — how completed work lives in the world
2. **Task Detail Panel** — how task information appears without breaking the room illusion

---

## 2. REPORTS TRAY VISUAL LANGUAGE

### 2.1 What the Tray Is

The Reports Tray is a **physical in-world object** — a document inbox, a filing surface, a place where finished work lands after review.

It is NOT:
- A dashboard widget
- A card list
- A notification panel
- A table of records

### 2.2 Physical Treatment

**Base Object:**
- Position: bottom-right quadrant, anchored at x 86%, y 78%
- Form: A simple horizontal surface — desk extension, filing tray, or low cabinet
- Style: Matches office pixel art, slightly darker wood/metal tone than desks
- Scale: Smaller than a desk cluster, reads as support furniture

**Visual States:**

| State | Appearance |
|-------|------------|
| **Empty** | Clean surface, perhaps a subtle tray outline or empty inbox feel |
| **Has Reports** | One or more document stacks visible on the surface |
| **New Arrival** | Brief animation: document slides in from edge, settles onto tray |

### 2.3 Document Stack Visual Language

**The Stack:**
- Each completed report = one visible document
- Documents stack with slight offset (2–4px) to suggest multiple items
- Top document shows minimal identifying marks
- No full text — just visual suggestion of paperwork

**Document Appearance:**
- Size: ~24–32px wide relative to scene
- Shape: Slight perspective, rectangular, paper-like
- Color: Warm white/cream, distinct from cool office palette
- Detail level: Minimal — perhaps a thin line suggesting text, or small accent color per lane

**Lane Differentiation (Subtle):**
Each portfolio lane has a barely-there accent on its documents:
- Hawco Development: subtle blue edge
- Company Theatre: subtle amber edge  
- Self-e-Tape: subtle green edge
- Personal: subtle neutral/warm edge

These should be visible on close inspection but not loud.

### 2.4 New Report Animation

When a report arrives:
1. Document appears at tray edge (right side, near wall)
2. Slides left onto tray surface (200–300ms, ease-out)
3. Settles into stack with subtle bounce
4. Brief warm glow on tray (1 second fade)

**Animation values:**
- Duration: 300ms entry, 100ms settle
- Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (ease-out-quad)
- No sound required

### 2.5 Interaction: Clicking the Tray

**Click Result:**
- Opens Reports Panel (outside the room frame, see Section 3)
- Tray itself shows brief feedback: subtle highlight pulse

**Hover State (Optional):**
- Very subtle lift/glow on tray surface
- Tooltip: "Completed Reports" (minimal, outside room frame)

### 2.6 Anti-Patterns to Avoid

| Don't | Why |
|-------|-----|
| Show report titles on documents | Breaks physical illusion, creates clutter |
| Make tray scrollable | It's a surface, not a container |
| Add badges with numbers | Too dashboard-like |
| Animate documents constantly | Distracts from room calm |
| Use card/list UI inside tray | Violates world-first principle |

---

## 3. TASK DETAIL PANEL VISUAL LANGUAGE

### 3.1 Panel Philosophy

When Philip clicks a desk/agent, he enters **reading mode** — he wants to understand what this agent is working on.

The panel must:
- Provide clear, readable information
- Feel connected to the clicked desk (spatial relationship)
- Never cover or compete with the office world
- Use plain English, not system jargon

### 3.2 Panel Placement

**Position:** Outside the room frame, to the right of the office scene

```
┌─────────────────┬──────────────────┐
│                 │                  │
│   OFFICE WORLD  │   DETAIL PANEL   │
│   (primary)     │   (secondary)    │
│                 │                  │
│                 │                  │
└─────────────────┴──────────────────┘
```

**Sizing:**
- Width: 320–400px (readable but subordinate)
- Height: Match office scene height
- Background: Slightly darker than room, or subtle blur backdrop
- Border: None, or 1px subtle divider line

### 3.3 Panel Structure

**Header Section:**
```
┌─────────────────────────┐
│  [Avatar] Agent Name    │  ← 48px avatar, name, role
│  Status: Working        │  ← plain English status
├─────────────────────────┤
```

**Task Section:**
```
┌─────────────────────────┐
│  Working on             │  ← section label, subtle
│                         │
│  Task title here        │  ← primary task name
│  in Portfolio Lane      │  ← context (lane name)
│                         │
│  [Description text      │  ← plain English summary
│   of what the agent     │     2–3 lines max
│   is doing...]          │
├─────────────────────────┤
```

**Meta Section:**
```
┌─────────────────────────┐
│  Details                │  ← section label
│                         │
│  Model: Claude 4        │  ← model being used
│  Started: 2 hours ago   │  ← relative time
│  Deadline: Today 5pm    │  ← if applicable
│                         │
│  [View full task →]     │  ← optional link
├─────────────────────────┤
```

**Blocker Section (if blocked):**
```
┌─────────────────────────┐
│  ⚠ Waiting for          │  ← amber accent
│                         │
│  [Blocker description   │
│   in plain English]     │
│                         │
│  [Action button]        │  ← if Philip can help
└─────────────────────────┘
```

### 3.4 Visual Treatment

**Typography:**
- Agent name: 18px, medium weight, high contrast
- Task title: 16px, medium weight
- Body text: 14px, regular weight, comfortable line height
- Meta labels: 12px, muted color, uppercase or small caps
- Section labels: 11px, very muted, uppercase, letter-spaced

**Color Palette:**
- Background: `#1a1a1f` or `rgba(0,0,0,0.6)` with backdrop blur
- Primary text: `#f0f0f5` (near-white)
- Secondary text: `#8a8a95` (muted gray)
- Accent (active): `#6b9fff` (soft blue)
- Accent (blocked): `#f5a623` (warm amber)
- Divider: `rgba(255,255,255,0.08)`

**Spacing:**
- Section padding: 20px
- Between sections: 1px divider line
- Within sections: 12px between items
- Compact but breathable

### 3.5 Connection to Room

**Visual Link:**
When a desk is clicked:
1. Subtle highlight appears on the desk in the room (soft glow, 2px outline, or both)
2. Panel slides in from right (300ms, ease-out)
3. Connection line (optional): faint 1px line from desk to panel, fades after entry

**Panel Exit:**
- Click outside panel or on another desk
- Panel slides out, desk highlight fades

### 3.6 Content Rules: Plain English Only

| System Term | Plain English Equivalent |
|-------------|-------------------------|
| "Status: in_progress" | "Working on this now" |
| "Status: blocked" | "Waiting for something" |
| "Agent: dev" | "Dev" (with avatar) |
| "Model: claude-sonnet-4-20250514" | "Using Claude 4" |
| "Created: 2026-03-15T14:32:00Z" | "Started 2 hours ago" |
| "Priority: high" | "Due today" or omit |

**Never show:**
- Raw database IDs
- Internal status enums
- Technical timestamps
- System field names

### 3.7 Empty / Inactive States

**No Agent Assigned:**
```
┌─────────────────────────┐
│  This desk is available │
│                         │
│  No agent assigned      │
│                         │
│  [Assign agent →]       │  ← if Philip can assign
└─────────────────────────┘
```

**Agent Inactive:**
```
┌─────────────────────────┐
│  [Avatar] Agent Name    │
│  Status: Away           │
│                         │
│  Not currently working  │
│  on any task.           │
└─────────────────────────┘
```

**Reserved Desk:**
```
┌─────────────────────────┐
│  Reserved Desk          │
│                         │
│  This workspace is      │
│  being held for a       │
│  future team member.    │
└─────────────────────────┘
```

---

## 4. UI RESTRAINT RULES

### 4.1 The Cardinal Rules

1. **No cards inside the room**
   - The office is not a card container
   - Status is communicated through world state, not UI widgets

2. **No scrolling inside the scene**
   - The room is a fixed view
   - If content doesn't fit, it goes in the side panel

3. **No numbers as primary information**
   - "3 blocked tasks" is dashboard thinking
   - Show blocked state visually on agents instead

4. **No persistent labels on desks**
   - Agent identity comes from avatar recognition
   - Names appear on click, not hovering over the world

5. **No chrome inside the frame**
   - No headers, no tabs, no buttons overlaid on the office
   - UI lives outside or not at all

### 4.2 Allowed vs Forbidden

| Element | Allowed Location | Forbidden Location |
|---------|-----------------|-------------------|
| Agent name | Detail panel | Floating above desk |
| Status text | Detail panel | Badge on avatar |
| Task list | Detail panel / Reports panel | Inside room scene |
| Action buttons | Detail panel | Overlaid on room |
| Timestamps | Detail panel | On desk surfaces |
| Progress bars | Detail panel only | Anywhere in room |
| Notification badges | Detail panel | On room objects |

### 4.3 Dashboard Energy Detection

Watch for these warning signs:
- "Let's add a quick stat summary at the top"
- "Can we show the task count on each desk?"
- "What if we put a mini progress bar near the avatar?"
- "Let's make the tray expandable with a list view"
- "Can the blocked badge show the blocker text?"

**Response to each:** Move it to the detail panel or remove it.

### 4.4 Room-First Checklist

Before shipping any UI element, verify:
- [ ] Does this element exist *in* the world or *outside* it?
- [ ] If Philip screenshots just the room, is the status still readable?
- [ ] Does this feel like a game world or a dashboard?
- [ ] Would this element survive if the office were a real physical space?
- [ ] Is the information hierarchy: Room → Agent → Panel, not Panel → Room?

---

## 5. ASSET RECOMMENDATIONS

### 5.1 Existing Assets (Sufficient)

The current asset set supports this visual package:
- Master scene background
- Avatar sprites
- Blocked badge
- Desk sprites (if separate)

### 5.2 Optional Enhancements (Nice to Have)

| Asset | Purpose | Priority |
|-------|---------|----------|
| **Tray sprite** | Physical tray object on right wall | Low — can use scene background |
| **Document sprite sheet** | 3–4 document variations for stack | Low — can be CSS rectangles |
| **Panel backdrop blur** | CSS `backdrop-filter` | None — CSS only |

### 5.3 CSS-First Implementation

Most panel and tray effects can be achieved without new images:

```css
/* Detail panel base */
.detail-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 360px;
  height: 100vh;
  background: rgba(26, 26, 31, 0.95);
  backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  color: #f0f0f5;
}

/* Document stack */
.document-stack {
  position: absolute;
  bottom: 4px;
  right: 8px;
}

.document {
  width: 28px;
  height: 36px;
  background: #f5f5dc;
  border-radius: 2px;
  position: absolute;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.document:nth-child(1) { transform: translate(0, 0); }
.document:nth-child(2) { transform: translate(3px, -2px); }
.document:nth-child(3) { transform: translate(6px, -4px); }

/* Lane accent colors */
.document.hawco { border-top: 2px solid #6b9fff; }
.document.theatre { border-top: 2px solid #f5a623; }
.document.tape { border-top: 2px solid #7cb342; }
.document.personal { border-top: 2px solid #a1887f; }

/* Desk highlight when selected */
.desk-selected::after {
  content: '';
  position: absolute;
  inset: -8px;
  border: 2px solid rgba(107, 159, 255, 0.5);
  border-radius: 8px;
  pointer-events: none;
  animation: pulse-glow 2s ease-in-out infinite;
}
```

---

## 6. DEV-READY IMPLEMENTATION NOTES

### 6.1 Component Structure

```typescript
// OfficeView.tsx
<OfficeContainer>
  <OfficeScene 
    onDeskClick={handleDeskClick}
    selectedDesk={selectedDesk}
  />
  <AnimatePresence>
    {selectedDesk && (
      <DetailPanel 
        desk={selectedDesk}
        onClose={() => setSelectedDesk(null)}
      />
    )}
  </AnimatePresence>
</OfficeContainer>

// ReportsTray.tsx (inside OfficeScene)
<TrayContainer onClick={handleTrayClick}>
  <TraySurface />
  <DocumentStack count={reports.length} lanes={reportLanes} />
  {newReportAnimating && <DocumentEnterAnimation />}
</TrayContainer>
```

### 6.2 State Integration

```typescript
// Detail panel content mapping
const getPanelContent = (deskState: DeskState): PanelContent => {
  switch (deskState.status) {
    case 'active':
      return {
        title: deskState.agent.name,
        subtitle: 'Working on this now',
        task: deskState.currentTask,
        meta: {
          model: simplifyModelName(deskState.currentTask.model),
          started: relativeTime(deskState.currentTask.startedAt),
          deadline: deskState.currentTask.deadline 
            ? formatDeadline(deskState.currentTask.deadline)
            : null
        }
      };
    case 'blocked':
      return {
        title: deskState.agent.name,
        subtitle: 'Waiting for something',
        task: deskState.currentTask,
        blocker: deskState.currentTask.blocker,
        meta: { /* ... */ }
      };
    case 'inactive':
      return {
        title: deskState.agent?.name || 'Available Desk',
        subtitle: deskState.agent ? 'Away' : 'No agent assigned',
        task: null,
        meta: {}
      };
    case 'reserved':
      return {
        title: 'Reserved Desk',
        subtitle: 'Future workspace',
        description: 'This workspace is being held for a future team member.',
        task: null,
        meta: {}
      };
  }
};
```

### 6.3 Animation Specs

| Animation | Duration | Easing |
|-----------|----------|--------|
| Panel slide in | 300ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| Panel slide out | 200ms | `cubic-bezier(0.55, 0.085, 0.68, 0.53)` |
| Document arrival | 300ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| Desk highlight pulse | 2000ms | `ease-in-out` (infinite) |
| Tray glow on new report | 1000ms | `ease-out` |

### 6.4 Responsive Behavior

**Desktop (>1024px):**
- Office scene: 60–70% width
- Detail panel: Fixed 360px, slides in from right

**Tablet (768–1024px):**
- Office scene: Full width
- Detail panel: Overlay, 80% width, slides up from bottom

**Mobile (<768px):**
- Office scene: Full width, scrollable if needed
- Detail panel: Full-screen overlay, dismissible

---

## 7. QUALITY CHECKLIST

Before implementation is complete:

### Reports Tray
- [ ] Tray reads as physical surface, not UI widget
- [ ] Document stacks suggest paperwork without showing content
- [ ] Lane colors are subtle, not garish
- [ ] New report animation feels satisfying
- [ ] Clicking tray opens reports (future: panel or modal)

### Detail Panel
- [ ] Panel placement never covers the office
- [ ] Typography is readable and hierarchical
- [ ] All text is plain English, no system jargon
- [ ] Agent identity is clear
- [ ] Task context is immediately understandable
- [ ] Blocked state is visually distinct (amber accent)
- [ ] Empty/inactive states are graceful
- [ ] Panel entry/exit feels smooth

### Room-First Integrity
- [ ] No cards inside the office frame
- [ ] No persistent labels floating over desks
- [ ] Status readable from room state alone
- [ ] UI feels supportive, not competitive
- [ ] Severance atmosphere preserved

---

## SUMMARY

This package delivers:

1. **Reports Tray** as a physical in-world surface with document stacks
2. **Detail Panel** as a clean, plain-English reading experience outside the room
3. **UI restraint rules** to prevent dashboard energy from creeping back in
4. **Dev-ready specs** for implementation

The result should feel like:
> Philip is looking into a living office. When he wants to understand what someone is working on, a clean panel appears to tell him — but the office itself always remains the primary experience.

---

*Prepared by Claire, Creative Director*  
*March 15, 2026*
