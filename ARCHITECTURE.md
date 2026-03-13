# Architecture Documentation

## System Overview

The Philip-Mildred Command Center is a task management dashboard with multi-lane portfolio views, Kanban boards, and agent coordination features.

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React + Vite  │────▶│  Express Server  │────▶│   SQLite DB     │
│   Frontend      │◀────│  (Port 3001)     │     │  (better-sqlite3)│
│   (Port 3000)   │     └────────┬─────────┘     └─────────────────┘
└─────────────────┘              │
                                │
                    ┌───────────┴───────────┐
                    │                       │
              ┌─────▼─────┐           ┌──────▼──────┐
              │  WebSocket│           │   GitHub    │
              │  Clients  │           │   API       │
              │           │           │(Octokit)    │
              └───────────┘           └─────────────┘
                    │
           ┌────────▼────────┐
           │ OpenClaw       │
           │ Gateway        │
           │ (Port 18789)   │
           └────────────────┘
```

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling

### Backend
- **Express 5** - HTTP server
- **better-sqlite3** - SQLite database
- **WebSocket (ws)** - Real-time updates
- **Helmet** - Security headers
- **Multer** - File uploads
- **Octokit** - GitHub API

## Data Model

### Core Entities

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Agent  │────▶│  Task   │◀────│  Lane   │
└─────────┘     └────┬────┘     └─────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
   │Evidence │ │Approval │ │PR Track │
   └─────────┘ └─────────┘ └─────────┘
```

### Tables

- **agents** - Worker agents (Mildred, Dev, etc.)
- **tasks** - Task items with status, deadline, assignment
- **lanes** - Portfolio lanes (Hawco, Company Theatre, etc.)
- **evidence** - Uploaded files for verification
- **approvals** - Approval/decisions on tasks
- **pr_tracking** - GitHub PR links and CI status
- **task_costs** - Token usage and cost tracking
- **weekly_summaries** - Auto-generated reports
- **status** - Gateway connection state

## Security

### Implemented Security Measures

1. **Helmet.js** - Security headers (CSP, HSTS, etc.)
2. **CORS** - Restricted to localhost:3000
3. **Input Validation** - Required field checks
4. **Parameterized Queries** - SQL injection prevention (better-sqlite3)
5. **File Upload Validation** - MIME type filtering
6. **Rate Limiting** - Request size limits (10kb JSON)
7. **No Hardcoded Secrets** - Environment variable only

### File Upload Security

- Files stored in `uploads/` directory
- Random filename generation to prevent overwrites
- MIME type validation (images, PDFs, text only)
- 10MB size limit

## Real-Time Updates

### WebSocket Events

The server broadcasts updates to all connected clients:

| Event | Description |
|-------|-------------|
| `task_created` | New task added |
| `task_updated` | Task details changed |
| `task_deleted` | Task removed |
| `task_assigned` | Task assigned to agent |
| `task_moved` | Task status changed |
| `evidence_uploaded` | New file attached |
| `evidence_deleted` | File removed |
| `task_approved` | Task approved |
| `changes_requested` | Changes requested |
| `task_sent_back` | Task sent to backlog |
| `pr_linked` | PR attached to task |
| `pr_refreshed` | PR status updated |
| `lane_created/updated/deleted` | Lane changes |
| `cost_recorded` | New cost entry |
| `weekly_summary_generated` | Report ready |

### OpenClaw Gateway Integration

The backend connects to the OpenClaw Gateway to:
- Receive agent status updates
- Broadcast task events to other agents
- Sync task state across agents

## API Flow

### Creating a Task

1. Client sends POST to `/api/tasks`
2. Server validates required fields
3. Generates unique ID
4. Inserts into SQLite
5. Broadcasts to WebSocket clients
6. Returns created task

### Verification Workflow

1. Task moves to `verification` status
2. User uploads evidence via `/api/tasks/:id/evidence`
3. User links PR via `/api/tasks/:id/pr`
4. Server fetches CI status from GitHub
5. User approves/requests changes
6. Task status updated accordingly

## Deployment

### Development
```bash
npm run server   # Backend (port 3001)
npm run dev      # Frontend (port 3000)
```

### Production
```bash
npm run build    # Creates dist/
# Serve dist/ with nginx/apache
# Run server with NODE_ENV=production
```

## Data Persistence

- SQLite database stored in `server/data.db`
- Automatic schema migrations on startup (ALTER TABLE)
- Seed data for default agents and lanes

## Backup Strategy

- Database backup: Copy `server/data.db` periodically
- Evidence backup: Contents of `uploads/` directory
- Recommended: Daily automated backups
- Store backups in separate location from app
