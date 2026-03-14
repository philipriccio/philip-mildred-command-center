# Philip-Mildred Command Center

[![CI](https://github.com/philipriccio/philip-mildred-command-center/actions/workflows/ci.yml/badge.svg)](https://github.com/philipriccio/philip-mildred-command-center/actions/workflows/ci.yml)

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

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start the server (port 3001)
npm run server

# Start the frontend (Vite defaults to port 5173)
npm run dev
```

See [SETUP.md](SETUP.md) for detailed installation instructions.

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup guide
- [ENVIRONMENT.md](ENVIRONMENT.md) - Environment variables
- [API.md](API.md) - API endpoint documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [SECURITY.md](SECURITY.md) - Security details

## Security
- Helmet.js for security headers
- CORS configured for localhost
- Input validation on all endpoints
- Parameterized SQL queries
- npm audit: 0 vulnerabilities
