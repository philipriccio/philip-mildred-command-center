# Dev Brief — Mission Control Office-First Live Ops Refactor

## Objective
Refocus Mission Control into an **office-first live operations board** with a **trusted Reports Tray**.

This is a product-direction refinement on top of the Telegram-first model already implemented.

## Read first
- `/Users/mildred/.openclaw/workspace/projects/command-center/PROJECT.md`
- `/Users/mildred/.openclaw/workspace/projects/command-center/PRODUCT-SPEC-2026-03-14-office-first.md`
- `/Users/mildred/.openclaw/workspace/projects/command-center/DEV-BRIEF-2026-03-14-telegram-driven-mission-control.md`

## Product direction (must follow)
Telegram remains the command surface.
Mission Control remains the visualization layer.

But the main screen should now be the **video-game-style office**, not a conventional dashboard.

The office is the primary operational map.
Philip should be able to understand within seconds:
- which agents are active,
- what they are working on,
- what is blocked,
- and what has completed.

## Core UX requirements
### 1. Office is the homepage
Make the office the primary/default screen.
If a secondary dashboard exists, it should support the office — not overshadow it.

### 2. Fixed desks
Every agent should have a permanent desk.
Desks remain even when empty.
Empty desk = agent not active.

### 3. Agent states must be visually obvious
Implement clearly distinct states:
- **working** → agent seated/typing/writing
- **blocked** → agent standing idle with visible `BLOCKED` icon/marker
- **inactive** → empty desk
- **finished** → agent no longer present at desk after completion

Do not overcomplicate with flair before readability is strong.

### 4. Clicking an agent opens useful detail
Clicking an active or blocked agent should open a plain-English detail panel showing:
- current task title
- short summary
- progress so far
- blockers/issues
- next step or ETA
- model being used for the task
- relevant history/report link

### 5. Reports Tray becomes the completion archive
Completed work should land in the Reports Tray.
It should be:
- scrollable
- persistent
- easy to browse
- easy to open

### 6. Mildred review gate for reports
Important: reports from other agents should not appear as final/trusted automatically.
Design and implement a practical first-pass workflow where:
1. another agent completes work
2. Mildred reviews it
3. Mildred approves it
4. only then it appears in Reports Tray as approved/trusted

The tray / report metadata should visibly show approval state.

### 7. Plain-English reporting
Finished reports must read in plain English by default.
They should include:
- title
- who did it
- when it finished
- lane/project
- brief result summary
- model used
- artifacts
- commit / PR / CI
- Mildred review/approval status

## Expected implementation emphasis
Prioritize:
1. office-first clarity
2. legible live states
3. useful click-through detail
4. trusted reports tray
5. believable live operations feel

De-prioritize:
- decorative polish that does not improve readability
- conventional dashboard metrics competing with the office
- heavy manual workflow for Philip

## Definition of done
This assignment is done only when all are true:
- ✅ office is the clear homepage / primary experience
- ✅ fixed desks are always visible
- ✅ active / blocked / inactive states are visually legible
- ✅ clicking an agent reveals useful plain-English task detail including model used
- ✅ completed work enters a meaningful Reports Tray flow
- ✅ approval/review state is represented for completed reports
- ✅ no obvious regressions in existing workflow/report functionality
- ✅ frontend quality bar is met
- ✅ tests/typecheck/lint/build results are reported
- ✅ commits are clear/scoped

## Frontend quality bar (hard requirement)
Dev must verify:
1. visual polish consistent with product direction
2. no clipping/overflow/z-index/layout regressions
3. neighboring UI remains usable
4. existing information remains visible after changes
5. include regression notes and screenshots when practical

## Required tests / verification
Report results for:
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit` (or explain equivalent)
- manual verification covering:
  1. office loads as primary screen
  2. empty desks render correctly
  3. working state renders clearly
  4. blocked state renders clearly
  5. clicking agent opens detail panel
  6. completed work lands in Reports Tray
  7. approved report metadata is visible

## Required PR / CI evidence
Per standing rule:
1. create/update PR with clear title, summary, and known limitations
2. check CI via `gh run list` and report pass/fail
3. if CI fails, fetch logs, summarize, attempt fix, re-check
4. final report must include PR link, merge-readiness status, blockers

## Decision boundaries
Dev may choose implementation details and sequencing.
Dev must escalate if:
- product direction becomes ambiguous,
- a destructive change is required,
- approval flow conflicts with current architecture,
- or a much larger state/event model change is needed than expected.

## Stall protocol
If blocked >20 minutes:
- try at least 2 fallback approaches,
- then escalate with blocker, attempts, evidence, options, and recommended next step.

## Deliverables
- implementation summary
- commit hashes
- PR link
- CI status
- validation results
- screenshots when practical
- remaining risks/blockers
- recommended next step
