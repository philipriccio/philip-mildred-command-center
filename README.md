# Philip-Mildred Command Center

A task management and agent coordination dashboard with multi-lane portfolio views, cost tracking, and deadline alerts.

## Features

### Multi-Lane Portfolio View
- Four dedicated lanes: Hawco Development, Company Theatre, Self-e-Tape, Personal
- Color-coded lanes (Blue, Amber, Green, Purple)
- Lane selector/filter in the header

### Dashboard View
- At-a-glance stats: total tasks, completed, in progress, overdue, due soon
- Portfolio overview with completion rates per lane
- Cost tracking summary (tokens, estimated, actual)
- Recent activity feed

### Deadline Alerts
- Overdue task indicators (red badges)
- Due-soon warnings (yellow for <48h, orange for <24h)
- Alert banner for critical deadlines

### Weekly Summary
- Auto-generated weekly reports
- Completed, in-progress, blocked task counts
- Cost summary for the week
- Upcoming deadlines (next 7 days)

### Kanban Board
- Drag-and-drop task management
- Five columns: Backlog, Ready, In Progress, Verification, Complete
- Task assignment to agents
- Deadline and blocker tracking

### Verification Panel (Phase 3)
- Evidence uploads
- GitHub PR linking with CI status
- Approval workflow: Approve, Request Changes, Send Back

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Express + better-sqlite3 + WebSocket
- **Real-time**: WebSocket for live updates

## Getting Started

```bash
# Install dependencies
npm install

# Start the server (port 3001)
npx tsx server/index.ts

# Start the frontend (port 3000)
npm run dev
```

## API Endpoints

### Tasks
- GET /api/tasks - List all tasks
- POST /api/tasks - Create task
- PUT /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task

### Lanes
- GET /api/lanes - List all lanes
- POST /api/lanes - Create lane
- PUT /api/lanes/:id - Update lane
- DELETE /api/lanes/:id - Delete lane

### Dashboard
- GET /api/dashboard/stats - Dashboard statistics
- GET /api/task-costs/summary - Cost summary
- GET /api/weekly-summaries - Weekly summaries
- POST /api/weekly-summaries/generate - Generate weekly summary

### Verification
- POST /api/tasks/:id/evidence - Upload evidence
- POST /api/tasks/:id/approve - Approve task
- POST /api/tasks/:id/request-changes - Request changes
- POST /api/tasks/:id/pr - Link PR

## Security
- Helmet.js for security headers
- CORS configured for localhost
- Input validation on all endpoints
- npm audit: 0 vulnerabilities
