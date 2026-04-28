# PROJECT.md — Mission Control / Command Center

## Overview
Mission Control is the **Philip–Mildred Command Center** project.

- **Repo path:** `/Users/mildred/.openclaw/workspace/projects/command-center`
- **Purpose:** a private, local-first dashboard that visualizes the real work Mildred is doing with agents across Philip’s portfolio.
- **Primary interface:** **Telegram**. Philip should continue talking to Mildred in Telegram. Mission Control is the visibility layer, not the command surface.
- **Local-first:** intended for local/internal use, not public deployment.

## Product Objective (plain English)
Philip talks to Mildred on Telegram.
Mildred interprets the work, creates tasks, delegates to herself or other agents, and drives execution.
Mission Control automatically shows that work in real time so Philip can watch what is happening without having to manage the board himself.
When work is complete, Philip can open Mission Control to see the full report, history, evidence, and status — and Mildred also notifies Philip on Telegram.

## Core Product Principles
1. **Telegram-first** — Telegram remains the place for instructions, clarifications, approvals, and updates.
2. **Mildred-operated** — Philip should not need to manually create routine tasks in Mission Control.
3. **Live visualization** — Mission Control should reflect real work state, not a manually maintained fiction.
4. **Agent visibility** — Philip should be able to see who owns a task, what they are doing, and where it stands.
5. **Audit trail** — Every meaningful task should leave behind a readable record: request, owner, progress, output, and result.
6. **Low-friction oversight** — Mission Control exists so Philip can watch and inspect, not duplicate work.

## Primary Workflow
1. Philip sends instruction on Telegram.
2. Mildred interprets and structures the work.
3. Mildred creates the task in Mission Control.
4. Mildred assigns the task to herself or another agent.
5. Mission Control updates in real time as status changes.
6. Final report/evidence is attached to the task.
7. Mildred notifies Philip on Telegram.
8. Philip can open Mission Control anytime to inspect the full record.

## What Mission Control Is
- A live operations mirror of Philip’s work being coordinated by Mildred.
- A status board showing active work, owners, progress, blockers, and completions.
- A review surface for full reports, evidence, PR/CI details, and historical context.
- A portfolio-wide dashboard across multiple lanes of work.

## What Mission Control Is Not
- Not the main place where Philip should create tasks.
- Not a second inbox.
- Not a second chat system.
- Not a system that requires duplicating what was already said on Telegram.

## Portfolio Lanes
Current lane model:
1. Hawco Development
2. Company Theatre
3. Self-e-Tape
4. Personal

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS
- **Backend:** Express + better-sqlite3
- **Realtime:** WebSocket
- **Gateway integration:** OpenClaw Gateway (`localhost:18789`)
- **Frontend dev URL:** typically `http://localhost:5173/`
- **Backend local port:** typically `3001`
- **Database:** `server/data.db`

## Phase History (verified from git)

### Phase 1 — Initial command center setup
**Commit:** `e4ae276`
Built:
- React/Vite frontend
- Express backend
- SQLite database
- basic agent status dashboard
- OpenClaw gateway integration
- Tailwind setup

### Runtime / hardening follow-up
**Commits:** `e1d35cc`, `fe41bc8`, `0e55f94`
Covered:
- security documentation,
- ESM `__dirname` / WebSocket fixes,
- ignoring local DB artifact.

### Phase 2 — Kanban workflow
**Commit:** `54b9bc8`
Built:
- drag-and-drop kanban board,
- task CRUD,
- assignment to agents,
- deadlines,
- blockers,
- workflow columns: Backlog / Ready / In Progress / Verification / Complete.

### Phase 3 — Verification workflow
**Verified via docs + code (`README.md`, `SECURITY.md`, `ARCHITECTURE.md`, `src/App.tsx`)**
Built:
- evidence uploads,
- GitHub PR linking,
- CI status tracking,
- approval actions (Approve / Request Changes / Send Back),
- delivery notes / historical record,
- DB tables for evidence / approvals / PR tracking.

### Phase 4 — Visual Office
**Commit:** `c82252e`
Built:
- canvas-based visual office,
- four agent desks (Dev, Mildred, Content, Research),
- agent state visualization,
- dialogue bubbles,
- reports inbox tray,
- `/ws/office` WebSocket endpoint,
- office view toggle,
- placeholder 32x32 sprites.

## Reframed Product Direction (as of 2026-03-14)
The existing manual dashboard / kanban app should now be treated as a foundation, not the final product direction.

The next major evolution is to turn Mission Control into a **Telegram-driven operations mirror**.

That means prioritizing:
- automatic task creation by Mildred,
- automatic assignment tracking,
- live status updates from real work,
- readable completion reports,
- and strong visibility for Philip without requiring manual board management.

## Current Known Repo State (as of 2026-03-14 reconstruction)
- **Branch:** `main`
- **HEAD:** `c82252e`
- **Remote:** `origin/main`
- **Uncommitted runtime data may exist locally:** `server/data.db`
- Interpretation: source code was committed; local runtime data changed after use/testing.

## Backup Evidence
Mission Control / Command Center was included in full backup made the night of Mar 13:
- `/Users/mildred/.openclaw/backups/2026-03-13-complete-backup-20260313-211155`

This confirms the project was considered active and worth preserving alongside other priority projects.

## Important Operating Notes
- If `localhost:5173` is unreachable, do **not** assume the project is lost or broken; first verify whether the local Vite dev server is running.
- For context rebuild after resets, use this file plus git history before claiming uncertainty.
- Mission Control progress must be logged explicitly in daily memory after each substantial work block.
- New feature decisions should be evaluated against the Telegram-first product objective above.

## New Strategic Priorities
1. **Office-first live ops** — the office becomes the primary homepage and status surface.
2. **Automatic task lifecycle** — Mildred can create/update/complete tasks without Philip using the dashboard manually.
3. **Agent assignment visibility** — tasks clearly show who owns them and what state they are in.
4. **Readable agent states** — active, blocked, inactive, and finished states must be visually obvious.
5. **Trusted Reports Tray** — completed work should land in a reviewed/approved archive.
6. **Telegram notification loop** — Telegram remains the authoritative completion/update channel.
7. **UI supports watching, not typing** — de-emphasize manual board maintenance.

## Likely Next Build Direction
1. Make the Office view the true homepage.
2. Implement fixed desks + clear visual agent states.
3. Make clicking an agent reveal useful plain-English task detail including model used.
4. Add Mildred review/approval gate before reports appear as final in Reports Tray.
5. Strengthen Reports Tray as the archive of trusted completed work.

## Self-e-Tape operating-system dashboard foundation — Apr 27, 2026
- Added a first Mission Control Ops view focused on Self-e-Tape as a standing strategic workstream, not just a task list.
- North star: become the best and most-used self-tape app by winning actor trust first, then awareness/adoption.
- Dashboard foundation now tracks actor journey health, authority boundaries, proactive loops, risks, and opportunities.
- Created recurring proactive loops outside the app:
  - daily Self-e-Tape trust scan at 8 AM Toronto
  - weekly market-leadership review Monday 9 AM Toronto
- Verification: `npm run build` passed after the Ops view changes.

## Self-e-Tape Ops live status — Apr 27, 2026
- Added `/api/selftape/status` to Mission Control API.
- Ops tab now pulls live SelfTape repo/build state instead of relying only on static operating-system copy:
  - branch/head
  - dirty tree flag
  - iOS build number
  - recent build attempts parsed from `BUILD-LOG.md`
  - Expo/EAS iOS incident signal from Expo Status
  - recommended next action
- Smoke-tested endpoint locally: returned SelfTape branch `feature/audit-fixes-submission-reader-mode`, head `03c3da7`, clean tree, build `277`, and active Expo incident matching Builds 276/277.
- Verification: `npm run build` passed.

## Private/local dashboard serving guard — Apr 27, 2026
- During laptop access testing, local LAN routing/Bonjour failed, so a temporary localtunnel was briefly tested and then shut down after Philip raised safety concerns.
- Added an explicit opt-in server flag `ENABLE_PUBLIC_DASHBOARD_TUNNEL=1` for serving the built dashboard through the API process when a temporary tunnel is intentionally used.
- Default behavior remains local/dev split (`localhost:5173` frontend, `localhost:3001` API); public serving is off unless explicitly enabled.
- Frontend API fallback now uses `window.location.origin` when no `VITE_API_BASE_URL` is set, allowing a same-origin private/tunnel deployment without hardcoding `localhost:3001`.
- Verification: `npm run build` and `git diff --check` passed.

## Self-e-Tape Ops actionable layer — Apr 27, 2026
- Added actionable operating-state sections to the Self-e-Tape Ops page:
  - Decisions needed, with Mildred recommendations and timing.
  - Watched signals, with why each matters and how Mildred should respond.
  - Action packets, with owner/status/approval-needed/next step.
- This turns the Ops tab from a status dashboard into the first version of a proactive operating board: what I can move, what is blocked, what needs Philip, and what I am watching.
- Verification: `npm run build` and `git diff --check` passed.

### SelfTape diagnostics radar — Apr 27
- Added a Mission Control diagnostics backend endpoint: `/api/selftape/diagnostics`.
- The endpoint reads recent SelfTape `diagnostic_events` from Supabase when the Command Center server has `SELFTAPE_SUPABASE_SERVICE_ROLE_KEY` or `SELFTAPE_SUPABASE_ANON_KEY` available.
- The API returns recent redacted events plus summary counts by severity, build number, flow, and event type.
- Added a Self-e-Tape Ops dashboard "Diagnostic event radar" panel showing totals, severity counts, build/flow/type clustering, and the latest events.
- If Supabase read credentials are not configured, the panel fails closed with setup guidance instead of exposing or guessing data.
- Fixed the Expo status parser to avoid treating historical incident text as an active EAS outage when the current status says all systems operational.
- Verification: `npm run build` passed.

### SelfTape Supabase PAT support — Apr 27
- Added server-only support for a Supabase personal access token for SelfTape diagnostics.
- Command Center can now resolve a REST API key from Supabase Management API when `SELFTAPE_SUPABASE_ACCESS_TOKEN` / `SUPABASE_ACCESS_TOKEN` is set or when the token is stored in macOS Keychain under `openclaw` / `command-center/selftape/supabase-access-token`.
- Added local backend route `POST /api/selftape/diagnostics/access-token` to store a PAT in macOS Keychain without committing it to git or exposing it to the frontend.
- Diagnostics queries still return only redacted event summaries to the browser.
- Verification: `npm run build` passed.

## Mission Control hub and avatar-truth pass — Apr 27, 2026
- Started the next Mission Control phase beyond Self-e-Tape: make the hub easier to understand and ensure the visual office represents real activity honestly.
- Office/avatar truth changes:
  - task status `ready` now maps to `reserved`, not `working`, so assigned-but-not-started work no longer falsely shows an agent actively working.
  - live gateway events temporarily override task-derived state for 45 seconds, so real thinking/tool/speaking activity is what lights up the desk.
  - frontend also expires stale live working/blocked states after 45 seconds without fresh activity.
  - fixed office-report auto-approval identity from stale `mildred` agent id to real `main` id.
- Added plain copy in the Office page explaining avatar truth: live gateway activity lights desks; assigned-but-not-started work is reserved.
- Verification: `npm run build` passed.

## Mission Control command hub — Apr 27, 2026
- Added `hub` as the default Mission Control view so Philip lands on a plain-English command desk rather than raw widgets.
- New `CommandHubPage` groups work into:
  - Needs Philip: approvals, device tests, decisions, external actions.
  - Mildred Moving: active/prepared work packets.
  - Blocked / Risk: constraints and why progress is stopped.
  - Project Cockpits: fast paths into Self-e-Tape Ops, Projects, Visual Office, and Systems Dashboard.
- Design intent: Mission Control should answer “what needs me, what is Mildred handling, what is blocked, what changed?” before showing operational detail.
- Verification: `npm run build` passed.

## Morning Command Queue operating ritual — Apr 27, 2026
- Philip approved the Morning Command Queue as the primary daily operating ritual.
- Purpose: Philip should not have to keep prompting Mildred through the day. Each morning, Mission Control should show the approval/action/decision items that actually need Philip, then Mildred works quietly from the approved/held queue during the day.
- Philip and Mildred will still chat naturally through the day, but the queue is the baseline anti-idling mechanism.
- Each check-in should include a point-form report of everything accomplished since the last check-in, focused on real verified progress rather than activity theatre.
- Design implication: Mission Control needs a durable “Since last check-in” section plus clear item states: needs Philip, approved, held, in progress, blocked, done/verified.

## Morning Command Queue schedule — Apr 27, 2026
- Philip set the Morning Command Queue default time to 7:30 AM Toronto/Eastern.
- Cron created: `Morning Command Queue`, job id `b8ccf958-b91d-4957-aca6-9e31a38366b7`, schedule `30 7 * * *` America/Toronto.
- Required output: Needs Philip, approve/hold/reject items, Philip actions, blockers/risks, Mildred recommended day plan, and point-form accomplishments since last check-in.
- Must verify live sources where needed and avoid stale/noisy items.

## Dual-path Command Queue answers — Apr 27, 2026
- Philip approved both Telegram and Mission Control as valid ways to answer the Morning Command Queue.
- Telegram path: Philip can copy the queue and put answers next to questions in chat.
- Mission Control path: Command Hub now shows simple action buttons on Needs Philip items: Approve, Hold, Reject, Discuss / Details.
- This is the first implementation of one-tap queue clearing; deeper per-item answer forms can be added next for nuanced text responses.
- Verification: `npm run build` passed.

## Approval button safety rule — Apr 27, 2026
- Philip confirmed that `Approve` in Mission Control should not by itself authorize external actions.
- Meaning: Approve can clear/advance an internal planning item, but external sends/actions still require explicit second confirmation.
- Explicit second confirmation remains required for sending emails/messages, triggering paid builds/submissions, contacting people, spending money, publishing, public announcements, or other irreversible/external effects.
- Mission Control should visually distinguish “approved to prepare/proceed internally” from “external action confirmed.”

## Waiting on Philip list — Apr 27, 2026
- Philip clarified Mission Control should track human tasks/actions only when Mildred is waiting on them.
- Added a first-class `Waiting on Philip` section to Command Hub.
- Purpose: Philip can quickly see what Mildred needs from him and mark/answer items so work can continue.
- This should include items like device tests, upgrades, replies, approvals, or human-only actions that block Mildred.
- Verification: `npm run build` passed.

## Waiting-on-Philip verification rule — Apr 27, 2026
- Philip confirmed that when he marks a waiting-on-Philip item as done, Mildred should verify it if possible before clearing it.
- Examples: check TestFlight/build state, confirm an email/send state, inspect SendGrid/account state, verify a file/status/source of truth.
- If verification is possible, the item should move through `done reported → verification → cleared` rather than disappearing immediately.
- If verification is not possible, Mission Control should mark it as `reported done — unverified` or ask for evidence/context.

## Check-in accomplishment report format — Apr 27, 2026
- Philip wants check-ins to include both completed work and meaningful forward movement that is not finished yet.
- Required split:
  - Done / verified
  - Moved forward
  - Still needs doing
  - Blocked / waiting on Philip, if applicable
- Avoid activity theatre: report concrete movement, evidence, and remaining work.

## Portfolio priority model — Apr 27, 2026
Philip clarified the durable portfolio hierarchy Mission Control should use:
1. Hawco Productions — ongoing work, including improving the CRM and CoverageIQ/platform systems.
2. Company Theatre — current top priority is Jackpot Twins.
3. Revenue-generating projects/businesses — current priority is Self-e-Tape.
4. Philip's freelance acting/directing/writing career — limited operational leverage for now, but long-term Jackpot Twins goal includes licensing productions in New York, Chicago, London, and as many Canadian productions as possible, not produced by Company Theatre but licensed to other theatres.
5. Staying on top of advancements in AI, OpenClaw, and how Philip/Mildred use them to increase productivity, ambition, and success.

Design implication: Mission Control should organize the portfolio around these durable lanes, while still surfacing the current urgent operational edge inside each lane.

## CoverageIQ active Hawco platform lane — Apr 27, 2026
- Philip clarified CoverageIQ should be active Hawco Productions/platform work, not parked.
- It was taken down temporarily for a reason Philip does not currently remember; Mildred must investigate and recover the rationale before making restart changes.
- Initial live check: `https://coverageiq.companytheatre.ca` returns HTTP 503; `https://api.coverageiq.companytheatre.ca/health` does not resolve.
- Known historical deployment note: CoverageIQ had Coolify frontend/backend/database resources and pending DNS/deploy verification in `projects/coverageiq/COOLIFY_MIGRATION_REPORT.md`.
- Mission Control portfolio should treat CoverageIQ as active-but-unhealthy, with next action to diagnose Coolify/DNS/deploy state.

## CoverageIQ ownership and product lane — Apr 27, 2026
- Philip clarified CoverageIQ is owned by Philip/us, not Hawco Productions.
- Treat CoverageIQ as a possible external revenue product later, while it may still support Hawco-style/internal development workflows.
- Mission Control should move CoverageIQ out of Hawco-owned work and into the revenue-generating projects/businesses lane, with current status active-but-unhealthy/recovery investigation.

## CoverageIQ ownership vs operational home — Apr 27, 2026
- Philip clarified the nuance: CoverageIQ is owned by Philip/us, not Hawco Productions, but it is incorporated into the Hawco CRM and used for Philip's role as development executive at Hawco Productions.
- Mission Control should model it as a revenue/product asset with a Hawco operational use case and CRM integration dependency.
- Practical lane: show CoverageIQ in revenue-generating projects/businesses for ownership/strategy, and cross-link it under Hawco Productions platform work because it supports Philip's Hawco development-exec workflow.

## Portfolio authority gradient — Apr 27, 2026
Philip confirmed the authority model should vary by lane:
1. Hawco Productions — most cautious. Relationship, partner, legal, business, and brand stakes are highest. Prepare/research/draft/audit freely, but external actions and commitments require explicit confirmation.
2. Company Theatre — cautious, especially around Mirvish, board, donors, artists, press, sponsors, legal/brand issues, and Jackpot Twins production commitments. Mildred can prepare and recommend proactively; external/commitment-bearing actions require confirmation.
3. Internal revenue/product projects — Self-e-Tape, CoverageIQ, Mission Control/OpenClaw work can be more proactive as long as work clearly advances the main goals. Approval still required for paid builds/submissions, spending, public launch/marketing, external outreach, irreversible actions, or major pivots.
4. AI/OpenClaw/productivity frontier — very proactive for research, prototyping, audits, dashboards, and internal process improvements, provided private data is protected and external systems are not changed without approval.

Design implication: Mission Control should show lane-specific caution/authority so Philip can trust what Mildred will do quietly vs what needs explicit approval.

## Morning recommended focus filter — Apr 27, 2026
- Philip wants the Morning Command Queue to include Mildred's recommendation for what to prioritize today.
- The recommendation must be results-impact driven, connected to overarching goals, not merely oldest task/email cleanup.
- Low-value routine items should not dominate unless they are high-priority, time-sensitive, or have tangible upside/risk.
- Good recommendation shape: "Do X and Y today because they materially move [goal] by [result/upside/risk reduction]."
- Mission Control should rank recommendations by tangible results: revenue, product viability, relationship leverage, production deadlines, strategic opportunity, trust/risk reduction, or operational unblock.

## Not worth attention section — Apr 27, 2026
- Philip approved a small "not worth your attention today" section when useful.
- Purpose: reassure him that lower-value items are deliberately deferred, not forgotten.
- Use sparingly; it should reduce noise, not create a second task list.
- Include only items where the deferral rationale matters: low upside, no current leverage, not time-sensitive, or overshadowed by higher-impact work.

## Core operating thesis: protect Philip's creative/deep-work time — Apr 27, 2026
- Philip clarified the big goal of the AI agent team and Mission Control: free him to prioritize the work only he can do, while Mildred manages and advances the rest without losing momentum.
- Protected Philip work includes writing, auditions, acting work, networking, reading for Hawco Productions and Company Theatre, and workout/physical maintenance.
- Morning Command Queue should not merely organize admin; it should actively recommend when Philip should read a script, write for an hour or two, set up/attend a high-value coffee meeting, do audition/acting work, or protect workout time.
- The success condition is that Philip can trust Mildred to run management, monitoring, organization, follow-through, and many execution lanes while he spends serious time on creative/high-leverage work.
- Updated Morning Command Queue cron to include a dedicated creative/deep-work protection section.

## Philip deep-work category weighting — Apr 27, 2026
- Philip clarified that writing and reading are probably on par in value.
- Workout is a daily must, not optional.
- Watching TV/industry material is important Hawco Productions development work, even though it can feel like a luxury.
- All protected categories matter: writing, reading, auditions, acting work, networking, watching TV/industry material, and workout.
- Writing needs special protection because it is hardest, requires the most focus, and is the one Philip procrastinates on most.
- Morning Command Queue cron updated with these weights.

## Flexible deep-work scheduling — Apr 27, 2026
- Philip wants suggestions for deep-work timing, but not rigid schedules, because his day is unpredictable.
- Morning Command Queue should suggest flexible windows, sequence, or priority order rather than firm time blocks unless live calendar commitments make a specific time genuinely important.
- Good shape: "protect the first clear 90 minutes for writing" or "fit workout before the day fragments" rather than pretending the day can be scheduled precisely.
- Morning Command Queue cron updated accordingly.

## Protected-work accountability — Apr 27, 2026
- Philip wants to try tracking whether protected work actually happened: writing, reading, workout, auditions/acting work, networking, and TV/industry watching.
- Tone should be accountability without nagging.
- Purpose: notice patterns, protect neglected high-value work, and adjust recommendations over time.
- Morning/check-in flow should include a light check such as "Did protected work happen?" and use the answer to refine future recommendations.

## Evening check-in ritual — Apr 27, 2026
- Philip wants an evening check-in for both daily recap and next-day priority setting.
- Purpose: close the loop on what was accomplished, what moved forward, what still needs doing, what protected work happened, and what tomorrow's highest-impact priorities should be.
- It should complement the Morning Command Queue: evening = recap + tomorrow setup; morning = decisions/actions + current-day focus.
- Evening recap should use the same plain split: Done/verified, Moved forward, Still needs doing, Blocked/waiting on Philip, Protected work/accountability, Recommended priorities for tomorrow.

## Evening check-in schedule — Apr 27, 2026
- Philip set the default Evening Check-in time to 9:00 PM Toronto/Eastern.
- Cron created: `Evening Check-in and Tomorrow Setup`, job id `94f0f38f-3be5-45b3-949b-2cb2e5ba742f`, schedule `0 21 * * *` America/Toronto.
- Delivery: Telegram announce to Philip.
