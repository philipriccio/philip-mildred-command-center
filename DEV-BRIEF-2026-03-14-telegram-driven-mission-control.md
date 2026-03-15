# Dev Brief — Mission Control Reframe

## Objective
Refactor Mission Control / Command Center from a manually operated task dashboard into a **Telegram-driven operations mirror**.

Philip should continue talking to Mildred on Telegram.
Mission Control should automatically reflect the work Mildred is doing: creating tasks, assigning them to herself or other agents, updating status, and attaching final reports.

## Project Path
`/Users/mildred/.openclaw/workspace/projects/command-center`

## Product Direction (must follow)
### Primary rule
**Telegram remains the command surface. Mission Control becomes the visualization and audit layer.**

### Desired user experience
- Philip gives instructions on Telegram.
- Mildred creates the task in Mission Control.
- Mildred assigns it to herself or another agent.
- Philip can watch progress in Mission Control in real time.
- When complete, Philip can open Mission Control and read the full report/history.
- Mildred still sends the user-facing update on Telegram.

### What this means for the product
Mission Control should emphasize:
- active work
- agent ownership
- status changes
- blockers
- recent completions
- readable final reports

Mission Control should de-emphasize:
- manual task entry by Philip
- workflow that requires board babysitting
- decorative features that do not improve oversight

## Immediate implementation priorities
### Priority 1 — Runtime correctness
Fix the known app issues before deeper feature work:
1. Add missing backend route: `GET /api/tasks/:id`
2. Reconcile frontend port/docs/CORS mismatch (`5173` vs `3000`)
3. Verify verification panel works end-to-end

### Priority 2 — Mildred-operated task lifecycle
Design and implement the first practical version of a task/event model that supports:
- task creation by Mildred without Philip manually using the UI
- task assignment to agent/self
- status transitions reflecting actual execution
- completion summaries attached to task records

This does **not** need full Telegram API integration yet if there is a simpler local/event-driven bridge, but the architecture should clearly support Telegram-first operation.

### Priority 3 — Read-first dashboard UX
Refocus the dashboard around visibility rather than authoring:
- active tasks at top
- recent completed tasks with reports
- blockers / overdue / waiting states
- clear agent ownership
- reduced emphasis on manual create-card workflow

### Priority 4 — Completion detail / report view
A completed task should clearly show:
- original request summary
- who owned it
- meaningful progress/history
- result summary
- links/evidence/PR/CI where relevant
- what remains unfinished, if anything

### Priority 5 — Office view evaluation
Keep the Office view only if it helps visibility.
If retained, it should support real oversight rather than placeholder novelty.
Do not spend major effort on art polish until workflow/reporting is solid.

## Expected output
Dev should deliver a practical first implementation of the Telegram-driven Mission Control direction, not just a memo.

At minimum, the handoff should include:
1. What product/UX changes were made
2. What runtime correctness issues were fixed
3. How task lifecycle now works
4. What is still simulated vs. fully integrated
5. Exact next steps to finish the direction

## Definition of done for this assignment
A task is only done when all of the following are true:
- ✅ Runtime correctness issues above are fixed
- ✅ Mission Control better reflects a Mildred-operated workflow
- ✅ UI clearly supports watching work rather than requiring manual board maintenance
- ✅ A completed task can show a readable report/history
- ✅ No obvious regressions in dashboard / board / verification / office navigation
- ✅ Frontend quality bar is met
- ✅ Code is committed in clear logical slices

## Frontend quality bar (hard requirement)
Dev must verify:
1. Visual polish is coherent with the rest of the app
2. No clipping / overflow / z-index / layout regressions
3. Neighboring components remain usable
4. Existing data/options remain visible after refactor
5. Include regression notes and screenshots when practical

## Required tests / verification
Before handoff, report results for:
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit` (or explain if build already covers equivalent)
- manual end-to-end verification covering:
  1. create task
  2. assign owner
  3. move through status changes
  4. open detail/report view
  5. use verification flow
  6. confirm recent completion is visible

If any existing failures remain, separate clearly between pre-existing and newly introduced issues.

## Required PR / CI evidence
Per standing rule, handoff must include:
1. PR created or updated with clear title, summary, and known limitations
2. `gh run list` checked and pass/fail reported
3. If CI fails: fetch logs, summarize, attempt fix, and re-check
4. Final report must include PR link, merge-readiness status, and blockers

## Commit / artifact expectations
Provide:
- commit hashes
- PR link
- CI status
- concise implementation summary
- remaining risks/blockers
- recommended next move

## Decision boundaries
Dev may choose implementation details and sequencing.
Dev must escalate if:
- product direction becomes ambiguous,
- a destructive change is required,
- auth/secrets risk appears,
- Telegram integration assumptions conflict with the current architecture.

## Stall protocol
If blocked for more than 20 minutes:
- try at least 2 fallback approaches,
- then escalate with:
  - exact blocker,
  - what was tried,
  - evidence,
  - 2–3 options,
  - recommended next move.
