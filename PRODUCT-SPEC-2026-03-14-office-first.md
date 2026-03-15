# Product Spec — Mission Control (Office-First)

## Core Definition
Mission Control is a **live operations board first** and a **trusted reports archive second**.

Philip should be able to open it and understand within seconds:
- which agents are working,
- what they are working on,
- what has been completed,
- what still needs to be done,
- and what is blocked.

## Primary Interface Model
- **Telegram remains the command surface** between Philip and Mildred.
- **Mission Control is the visualization layer** for the work Mildred is coordinating.
- Philip should not need to create routine tasks manually in Mission Control.

## Main Screen: The Office
The office is the primary UI and should be the first screen Philip sees.

### Why
The office is not decorative. It is the main status map.
Philip should be able to understand agent state visually without reading a dense dashboard.

## Desk Model
- Each agent has a **fixed permanent desk**.
- Desks always exist even when empty.
- Empty desk = agent is not currently active.

### Default office state
At a glance, the office should stay visually clean.
Visible by default:
- agent name
- agent presence/state through animation/pose

## Agent States
### 1. Working
- Agent is present at desk
- visibly typing / writing / actively working
- means the agent is currently executing a task

### 2. Blocked
- Agent is present but no longer working
- standing idle at desk
- visible **BLOCKED** indicator/icon
- clicking reveals blocker details
- Mildred also sends Telegram message to Philip if blocker matters

### 3. Not active
- Desk is empty
- means agent is not currently working on a task

### 4. Finished
- Agent finishes task
- leaves active work state / office presence
- desk remains, but agent is no longer active there
- completed work moves to Reports Tray after Mildred review

## Clicking an Agent
Clicking an agent should open a clear plain-English detail panel.

It should show:
- current task title
- short summary of what they are doing
- progress so far
- blockers/issues
- next step or ETA
- model being used for the task
- access to relevant work/report history

## Live Ops Requirements
Within 5 seconds of opening Mission Control, Philip should understand:
1. who is active,
2. what each active agent is doing,
3. what is done vs still in progress,
4. whether anything is blocked.

## Reports Tray
The Reports Tray is the secondary system in Mission Control.
It is the archive of completed, trusted work.

### Behavior
- scrollable
- persistent
- clickable
- contains completed reports
- each report can be opened as a readable report / PDF-style document

## Trust Model for Reports
Reports from other agents do **not** go directly to Philip as final.

### Required flow
1. agent completes work
2. report comes to Mildred
3. Mildred reviews it
4. Mildred approves it (or sends it back)
5. only then does it enter Reports Tray as trusted completed work

### Tray/report metadata should show
- reviewed by Mildred
- approved by Mildred
- timestamp of approval

## Completed Report Contents
Reports must be in **plain English**.

Each report should show:
- title
- who did it
- when it finished
- lane/project
- brief result summary
- model used
- artifacts attached
- commit / PR / CI
- Mildred review/approval state

## Product Priorities
### Priority 1
Make the office the true homepage and primary status surface.

### Priority 2
Make agent states visually legible and meaningful.

### Priority 3
Make clicking an agent reveal useful, real operational detail.

### Priority 4
Implement Mildred review gate before reports appear as final.

### Priority 5
Make the Reports Tray feel like a genuine archive of trusted completed work.

### Priority 6
Keep language plain English by default.

## What Mission Control is NOT
- Not primarily a kanban board
- Not primarily a metrics dashboard
- Not primarily a manual task entry tool for Philip
- Not a dump of raw agent output

## Product Weighting
- **Primary:** live ops board
- **Secondary:** reports archive

## Design Principle
The test for Mission Control is not whether it looks like a sophisticated dashboard.
The test is whether Philip feels like he is **watching Mildred coordinate real work in real time**.
