# API Documentation

Base URL: `http://localhost:3001`

## Health Check

### GET /api/health

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1700000000000
}
```

## Agents

### GET /api/agents

List all agents.

**Response:**
```json
[
  {
    "id": "mildred",
    "name": "Mildred (Main Agent)",
    "status": "idle",
    "last_seen": null,
    "metadata": null,
    "current_task_id": null
  }
]
```

## Tasks

### GET /api/tasks

List all tasks.

**Response:**
```json
[
  {
    "id": "task-1234567890-abc123",
    "title": "Build feature X",
    "description": "Description here",
    "status": "backlog",
    "agent_id": null,
    "deadline": 1700000000000,
    "blocker_reason": null,
    "promise_date": null,
    "delivery_notes": null,
    "request_summary": "Telegram request summary",
    "completion_summary": null,
    "source": "telegram",
    "requester": "Philip",
    "lane_id": "hawco",
    "created_at": 1700000000000,
    "updated_at": 1700000000000
  }
]
```

### POST /api/tasks

Create a new task.

**Request Body:**
```json
{
  "title": "Task title",
  "description": "Optional description",
  "status": "backlog",
  "agent_id": "dev",
  "deadline": 1700000000000,
  "promise_date": "2024-01-15",
  "lane_id": "hawco"
}
```

**Response:** Created task object

### PUT /api/tasks/:id

Update a task.

**Request Body:**
```json
{
  "title": "New title",
  "status": "in_progress",
  "agent_id": "dev",
  "deadline": 1700000000000,
  "blocker_reason": "Waiting on API",
  "promise_date": "2024-01-20",
  "delivery_notes": "Delivered via email"
}
```

### DELETE /api/tasks/:id

Delete a task and associated evidence.

### POST /api/tasks/:id/assign

Assign task to an agent.

**Request Body:**
```json
{
  "agent_id": "dev"
}
```

### POST /api/tasks/:id/move

Move task to a different status column.

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Valid statuses:** `backlog`, `ready`, `in_progress`, `verification`, `complete`

## Evidence

### GET /api/tasks/:id/evidence

List evidence files for a task.

### POST /api/tasks/:id/evidence

Upload evidence file.

**Content-Type:** `multipart/form-data`

**Form Field:** `file`

### DELETE /api/evidence/:id

Delete an evidence file.

### GET /api/evidence/:id/download

Download an evidence file.

## Approvals

### GET /api/tasks/:id/approvals

List approval history for a task.

### POST /api/tasks/:id/approve

Approve a task.

**Request Body:**
```json
{
  "notes": "Looks good!",
  "decided_by": "philip"
}
```

### POST /api/tasks/:id/request-changes

Request changes to a task.

**Request Body:**
```json
{
  "notes": "Please fix the bug in...",
  "decided_by": "philip"
}
```

### POST /api/tasks/:id/send-back

Send a task back to backlog.

**Request Body:**
```json
{
  "notes": "Not ready yet",
  "decided_by": "philip"
}
```

## PR Tracking

### GET /api/tasks/:id/pr

List PRs linked to a task.

### POST /api/tasks/:id/pr

Link a PR to a task.

**Request Body:**
```json
{
  "pr_url": "https://github.com/owner/repo/pull/123",
  "pr_number": 123,
  "owner": "owner",
  "repo": "repo"
}
```

### POST /api/tasks/:id/pr/refresh

Refresh PR and CI status.

**Request Body:**
```json
{
  "owner": "owner",
  "repo": "repo"
}
```

### DELETE /api/pr/:id

Unlink a PR from a task.

### GET /api/tasks/:id/history

Get complete history for a task (approvals, PRs, evidence).

## Lanes

### GET /api/lanes

List all portfolio lanes.

**Response:**
```json
[
  {
    "id": "hawco",
    "name": "Hawco Development",
    "color": "#3b82f6",
    "description": "Hawco CRM and development projects",
    "created_at": 1700000000000
  }
]
```

### POST /api/lanes

Create a new lane.

**Request Body:**
```json
{
  "id": "new-lane",
  "name": "New Lane",
  "color": "#ff0000",
  "description": "Description"
}
```

### PUT /api/lanes/:id

Update a lane.

### DELETE /api/lanes/:id

Delete a lane (tasks are unassigned but not deleted).

## Task Costs

### GET /api/task-costs

List all cost records.

### GET /api/task-costs/summary

Get cost summary with optional filters.

**Query Parameters:**
- `lane_id` - Filter by lane
- `start_date` - Filter start (Unix timestamp)
- `end_date` - Filter end (Unix timestamp)

**Response:**
```json
{
  "costs": [...],
  "totals": {
    "tokens": 100000,
    "estimated": 5.00,
    "actual": 4.50
  }
}
```

### POST /api/task-costs

Record a cost for a task.

**Request Body:**
```json
{
  "task_id": "task-123",
  "tokens_used": 50000,
  "estimated_cost": 2.50,
  "actual_cost": 2.25
}
```

## Weekly Summaries

### GET /api/weekly-summaries

List weekly summaries.

**Query Parameters:**
- `week_start` - Get specific week (Unix timestamp)

### POST /api/weekly-summaries/generate

Generate a weekly summary.

**Request Body:**
```json
{
  "week_start": 1700000000000,
  "week_end": 1700600000000
}
```

## Dashboard

### GET /api/dashboard/stats

Get dashboard statistics.

**Response:**
```json
{
  "totalTasks": 50,
  "byStatus": {
    "backlog": 10,
    "ready": 5,
    "in_progress": 15,
    "verification": 5,
    "complete": 15
  },
  "overdue": 2,
  "dueSoon": 5,
  "dueVerySoon": 2,
  "blocked": 3,
  "activeAgents": 2,
  "laneStats": [...],
  "recentActivity": [...]
}
```

## Status

### GET /api/status

Get OpenClaw Gateway connection status.

**Response:**
```json
{
  "id": 1,
  "gateway_connected": 1,
  "last_update": 1700000000000
}
```

## WebSocket

### ws://localhost:3001/gateway

Real-time updates for:
- Task created/updated/deleted
- Task assigned/moved
- Evidence uploaded/deleted
- Approval decisions
- PR status changes
- Agent status updates

**Message format:**
```json
{
  "type": "task_updated",
  "data": { ... }
}
```
