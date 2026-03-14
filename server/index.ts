import express, { type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { Octokit } from 'octokit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'verification', 'complete'] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
type ApprovalDecision = 'approve' | 'request_changes' | 'send_back';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

interface AgentRow {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string | null;
  current_task_id: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  agent_id: string | null;
  lane_id: string | null;
  deadline: number | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  promise_date: string | null;
  delivery_notes: string | null;
  request_summary: string | null;
  completion_summary: string | null;
  source: string | null;
  requester: string | null;
}

interface LaneRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: number;
}

interface EvidenceRow {
  id: string;
  task_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: number;
}

interface ApprovalRow {
  id: string;
  task_id: string;
  decision: ApprovalDecision;
  notes: string | null;
  decided_by: string;
  decided_at: number;
}

interface PrTrackingRow {
  id: string;
  task_id: string;
  pr_number: number;
  pr_url: string;
  status: string;
  ci_status: string;
  last_checked: number;
}

interface TaskEventRow {
  id: string;
  task_id: string;
  event_type: string;
  actor: string;
  summary: string;
  details_json: string | null;
  created_at: number;
}

interface OfficeAgentRow {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  state: string;
  current_task: string | null;
  task_progress: number;
  color: string;
  office_enabled: number;
}

interface OfficeReportRow {
  id: string;
  agent_id: string;
  agent_name: string;
  task_title: string;
  completed_at: number;
  acknowledged: number;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '250kb' }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'text/plain', 'text/log', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type'));
  },
});

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    last_seen INTEGER,
    metadata TEXT,
    current_task_id TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    agent_id TEXT,
    lane_id TEXT,
    deadline INTEGER,
    blocker_reason TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    promise_date TEXT,
    delivery_notes TEXT,
    request_summary TEXT,
    completion_summary TEXT,
    source TEXT DEFAULT 'telegram',
    requester TEXT DEFAULT 'Philip',
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (lane_id) REFERENCES lanes(id)
  );

  CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gateway_connected INTEGER DEFAULT 0,
    last_update INTEGER
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    uploaded_at INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    notes TEXT,
    decided_by TEXT,
    decided_at INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pr_tracking (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    pr_number INTEGER,
    pr_url TEXT,
    status TEXT,
    ci_status TEXT,
    last_checked INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lanes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS task_costs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0,
    actual_cost REAL DEFAULT 0,
    recorded_at INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS weekly_summaries (
    id TEXT PRIMARY KEY,
    week_start INTEGER NOT NULL,
    week_end INTEGER NOT NULL,
    summary_json TEXT,
    generated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS office_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    state TEXT DEFAULT 'offline',
    current_task TEXT,
    task_progress INTEGER DEFAULT 0,
    color TEXT DEFAULT '#808080',
    office_enabled INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS office_reports (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    task_title TEXT NOT NULL,
    completed_at INTEGER,
    acknowledged INTEGER DEFAULT 0,
    FOREIGN KEY (agent_id) REFERENCES office_agents(id)
  );

  CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    summary TEXT NOT NULL,
    details_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

const migrationStatements = [
  'ALTER TABLE tasks ADD COLUMN deadline INTEGER',
  'ALTER TABLE tasks ADD COLUMN blocker_reason TEXT',
  'ALTER TABLE agents ADD COLUMN current_task_id TEXT',
  'ALTER TABLE tasks ADD COLUMN promise_date TEXT',
  'ALTER TABLE tasks ADD COLUMN delivery_notes TEXT',
  'ALTER TABLE tasks ADD COLUMN lane_id TEXT',
  'ALTER TABLE tasks ADD COLUMN request_summary TEXT',
  'ALTER TABLE tasks ADD COLUMN completion_summary TEXT',
  "ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'telegram'",
  "ALTER TABLE tasks ADD COLUMN requester TEXT DEFAULT 'Philip'",
];

for (const statement of migrationStatements) {
  try {
    db.exec(statement);
  } catch (error) {
    void error;
  }
}

db.exec(`INSERT OR IGNORE INTO status (id, gateway_connected, last_update) VALUES (1, 0, 0)`);

const defaultAgents = [
  { id: 'mildred', name: 'Mildred (Main Agent)' },
  { id: 'dev', name: 'Dev (Coding Agent)' },
  { id: 'content-agent', name: 'Content Agent (Future)' },
  { id: 'research-agent', name: 'Research Agent (Future)' },
] as const;

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agents (id, name, status, last_seen)
  VALUES (?, ?, 'idle', NULL)
`);
for (const agent of defaultAgents) {
  insertAgent.run(agent.id, agent.name);
}

const defaultLanes = [
  { id: 'hawco', name: 'Hawco Development', color: '#3b82f6', description: 'Hawco CRM and development projects' },
  { id: 'company-theatre', name: 'Company Theatre', color: '#f59e0b', description: 'Company Theatre website and CRM' },
  { id: 'selfe-tape', name: 'Self-e-Tape', color: '#10b981', description: 'Self-e-Tape app development' },
  { id: 'personal', name: 'Personal', color: '#a855f7', description: 'Personal projects and tasks' },
] as const;

const insertLane = db.prepare(`
  INSERT OR IGNORE INTO lanes (id, name, color, description)
  VALUES (?, ?, ?, ?)
`);
for (const lane of defaultLanes) {
  insertLane.run(lane.id, lane.name, lane.color, lane.description);
}

const officeDefaultAgents = [
  { id: 'mildred', name: 'Mildred', position_x: 18, position_y: 4, state: 'idle', color: '#008080' },
  { id: 'dev', name: 'Dev', position_x: 3, position_y: 4, state: 'idle', color: '#808080' },
  { id: 'content', name: 'Content', position_x: 3, position_y: 12, state: 'idle', color: '#800080' },
  { id: 'research', name: 'Research', position_x: 18, position_y: 12, state: 'idle', color: '#8B4513' },
] as const;

const insertOfficeAgent = db.prepare(`
  INSERT OR IGNORE INTO office_agents (id, name, position_x, position_y, state, color, office_enabled)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`);
for (const agent of officeDefaultAgents) {
  insertOfficeAgent.run(agent.id, agent.name, agent.position_x, agent.position_y, agent.state, agent.color);
}

const octokit = process.env.GITHUB_TOKEN ? new Octokit({ auth: process.env.GITHUB_TOKEN }) : null;

const selectTaskById = db.prepare<TaskRow>('SELECT * FROM tasks WHERE id = ?');
const selectLaneById = db.prepare<LaneRow>('SELECT * FROM lanes WHERE id = ?');
const selectAgentById = db.prepare<AgentRow>('SELECT * FROM agents WHERE id = ?');
const selectEvidenceByTask = db.prepare<EvidenceRow>('SELECT * FROM evidence WHERE task_id = ? ORDER BY uploaded_at DESC');
const selectApprovalsByTask = db.prepare<ApprovalRow>('SELECT * FROM approvals WHERE task_id = ? ORDER BY decided_at DESC');
const selectPrsByTask = db.prepare<PrTrackingRow>('SELECT * FROM pr_tracking WHERE task_id = ? ORDER BY last_checked DESC');
const selectEventsByTask = db.prepare<TaskEventRow>('SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC');
const selectOfficeAgentById = db.prepare<OfficeAgentRow>('SELECT * FROM office_agents WHERE id = ?');

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJson<T extends JsonValue>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeStatus(value: unknown, fallback: TaskStatus = 'backlog'): TaskStatus {
  if (typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)) {
    return value as TaskStatus;
  }
  return fallback;
}

function getTaskOr404(res: Response, id: string) {
  const task = selectTaskById.get(id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return null;
  }
  return task;
}

function readTaskDetail(id: string) {
  const task = selectTaskById.get(id);
  if (!task) return null;
  return {
    ...task,
    agent: task.agent_id ? selectAgentById.get(task.agent_id) ?? null : null,
    lane: task.lane_id ? selectLaneById.get(task.lane_id) ?? null : null,
    evidence: selectEvidenceByTask.all(id),
    approvals: selectApprovalsByTask.all(id),
    prs: selectPrsByTask.all(id),
    history: selectEventsByTask.all(id).map(event => ({
      ...event,
      details: parseJson<JsonObject>(event.details_json),
    })),
  };
}

function syncAgentCurrentTask(agentId: string | null, taskId: string | null) {
  if (!agentId) return;
  db.prepare('UPDATE agents SET current_task_id = ? WHERE id = ?').run(taskId, agentId);
}

function syncOfficeAgentForTask(task: TaskRow) {
  if (!task.agent_id) return;
  const officeAgent = selectOfficeAgentById.get(task.agent_id);
  if (!officeAgent) return;
  const officeState = task.status === 'complete'
    ? 'idle'
    : task.status === 'verification'
      ? 'completing'
      : task.status === 'in_progress'
        ? 'working'
        : 'idle';
  const taskProgress = task.status === 'complete' ? 100 : task.status === 'verification' ? 90 : task.status === 'in_progress' ? 55 : task.status === 'ready' ? 20 : 0;
  db.prepare('UPDATE office_agents SET state = ?, current_task = ?, task_progress = ? WHERE id = ?')
    .run(officeState, task.title, taskProgress, task.agent_id);
  officeWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'agent.state',
        agentId: task.agent_id,
        state: officeState,
        task: task.title,
        progress: taskProgress,
      }));
    }
  });
}

function createOfficeReport(task: TaskRow) {
  if (!task.agent_id) return;
  const officeAgent = selectOfficeAgentById.get(task.agent_id);
  if (!officeAgent) return;
  const reportId = createId('report');
  db.prepare(`
    INSERT INTO office_reports (id, agent_id, agent_name, task_title, completed_at, acknowledged)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(reportId, task.agent_id, officeAgent.name, task.title, Date.now());
  officeWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'report.new',
        reportId,
        agentId: task.agent_id,
        agentName: officeAgent.name,
        taskTitle: task.title,
      }));
    }
  });
}

function recordTaskEvent(taskId: string, eventType: string, actor: string, summary: string, details?: JsonObject) {
  const event = {
    id: createId('evt'),
    task_id: taskId,
    event_type: eventType,
    actor,
    summary,
    details_json: details ? JSON.stringify(details) : null,
    created_at: Date.now(),
  };
  db.prepare(`
    INSERT INTO task_events (id, task_id, event_type, actor, summary, details_json, created_at)
    VALUES (@id, @task_id, @event_type, @actor, @summary, @details_json, @created_at)
  `).run(event);
  broadcastUpdate({
    type: 'task_event',
    data: {
      ...event,
      details: details ?? null,
    },
  });
}

function broadcastTask(type: string, taskId: string) {
  const detail = readTaskDetail(taskId);
  if (detail) {
    broadcastUpdate({ type, data: detail });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), frontendOrigins: FRONTEND_ORIGINS });
});

app.get('/api/agents', (_req, res) => {
  const agents = db.prepare<AgentRow>('SELECT * FROM agents ORDER BY name').all();
  res.json(agents);
});

app.get('/api/tasks', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, a.name AS agent_name, l.name AS lane_name, l.color AS lane_color
    FROM tasks t
    LEFT JOIN agents a ON a.id = t.agent_id
    LEFT JOIN lanes l ON l.id = t.lane_id
    ORDER BY CASE t.status
      WHEN 'in_progress' THEN 1
      WHEN 'verification' THEN 2
      WHEN 'ready' THEN 3
      WHEN 'backlog' THEN 4
      WHEN 'complete' THEN 5
      ELSE 6
    END, t.updated_at DESC
  `).all();
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = readTaskDetail(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
});

app.get('/api/status', (_req, res) => {
  const status = db.prepare('SELECT * FROM status WHERE id = 1').get();
  res.json(status);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, status, agent_id, lane_id, deadline, blocker_reason, promise_date, delivery_notes, request_summary, completion_summary, source, requester } = req.body as Partial<TaskRow>;
  if (!title?.trim()) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const id = createId('task');
  const now = Date.now();
  const nextStatus = normalizeStatus(status);
  db.prepare(`
    INSERT INTO tasks (
      id, title, description, status, agent_id, lane_id, deadline, blocker_reason,
      created_at, updated_at, promise_date, delivery_notes, request_summary,
      completion_summary, source, requester
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title.trim(),
    description?.trim() ?? '',
    nextStatus,
    agent_id ?? null,
    lane_id ?? null,
    deadline ?? null,
    blocker_reason?.trim() || null,
    now,
    now,
    promise_date ?? null,
    delivery_notes?.trim() || null,
    request_summary?.trim() || title.trim(),
    completion_summary?.trim() || null,
    source?.trim() || 'telegram',
    requester?.trim() || 'Philip',
  );
  if (agent_id) syncAgentCurrentTask(agent_id, id);
  const task = getTaskOr404(res, id);
  if (!task) return;
  recordTaskEvent(id, 'created', requester?.trim() || 'Mildred', `Created from ${source?.trim() || 'telegram'} request`, {
    status: nextStatus,
    agent_id: agent_id ?? null,
    lane_id: lane_id ?? null,
  });
  syncOfficeAgentForTask(task);
  broadcastTask('task_created', id);
  res.status(201).json(readTaskDetail(id));
});

app.put('/api/tasks/:id', (req, res) => {
  const existing = getTaskOr404(res, req.params.id);
  if (!existing) return;
  const payload = req.body as Partial<TaskRow>;
  const nextStatus = payload.status ? normalizeStatus(payload.status, existing.status) : existing.status;
  const nextAgentId = Object.prototype.hasOwnProperty.call(payload, 'agent_id') ? payload.agent_id ?? null : existing.agent_id;
  const nextLaneId = Object.prototype.hasOwnProperty.call(payload, 'lane_id') ? payload.lane_id ?? null : existing.lane_id;
  const now = Date.now();

  db.prepare(`
    UPDATE tasks
    SET title = ?,
        description = ?,
        status = ?,
        agent_id = ?,
        lane_id = ?,
        deadline = ?,
        blocker_reason = ?,
        promise_date = ?,
        delivery_notes = ?,
        request_summary = ?,
        completion_summary = ?,
        source = ?,
        requester = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    payload.title?.trim() || existing.title,
    Object.prototype.hasOwnProperty.call(payload, 'description') ? payload.description?.trim() ?? '' : existing.description,
    nextStatus,
    nextAgentId,
    nextLaneId,
    Object.prototype.hasOwnProperty.call(payload, 'deadline') ? payload.deadline ?? null : existing.deadline,
    Object.prototype.hasOwnProperty.call(payload, 'blocker_reason') ? payload.blocker_reason?.trim() || null : existing.blocker_reason,
    Object.prototype.hasOwnProperty.call(payload, 'promise_date') ? payload.promise_date ?? null : existing.promise_date,
    Object.prototype.hasOwnProperty.call(payload, 'delivery_notes') ? payload.delivery_notes?.trim() || null : existing.delivery_notes,
    Object.prototype.hasOwnProperty.call(payload, 'request_summary') ? payload.request_summary?.trim() || null : existing.request_summary,
    Object.prototype.hasOwnProperty.call(payload, 'completion_summary') ? payload.completion_summary?.trim() || null : existing.completion_summary,
    Object.prototype.hasOwnProperty.call(payload, 'source') ? payload.source?.trim() || 'telegram' : existing.source,
    Object.prototype.hasOwnProperty.call(payload, 'requester') ? payload.requester?.trim() || 'Philip' : existing.requester,
    now,
    existing.id,
  );

  if (existing.agent_id && existing.agent_id !== nextAgentId) {
    syncAgentCurrentTask(existing.agent_id, null);
  }
  if (nextAgentId) {
    syncAgentCurrentTask(nextAgentId, existing.id);
  }

  recordTaskEvent(existing.id, 'updated', 'Mildred', 'Task details updated', {
    from_status: existing.status,
    to_status: nextStatus,
    from_agent_id: existing.agent_id,
    to_agent_id: nextAgentId,
  });

  const updated = getTaskOr404(res, existing.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  broadcastTask('task_updated', existing.id);
  res.json(readTaskDetail(existing.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const evidenceFiles = db.prepare<EvidenceRow>('SELECT * FROM evidence WHERE task_id = ?').all(task.id);
  for (const evidence of evidenceFiles) {
    try {
      fs.unlinkSync(path.join(uploadsDir, evidence.filename));
    } catch (error) {
      void error;
    }
  }
  if (task.agent_id) syncAgentCurrentTask(task.agent_id, null);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  broadcastUpdate({ type: 'task_deleted', data: { id: task.id } });
  res.status(204).send();
});

app.post('/api/tasks/:id/assign', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const agentId = typeof req.body.agent_id === 'string' ? req.body.agent_id : null;
  if (task.agent_id && task.agent_id !== agentId) {
    syncAgentCurrentTask(task.agent_id, null);
  }
  db.prepare('UPDATE tasks SET agent_id = ?, updated_at = ? WHERE id = ?').run(agentId, Date.now(), task.id);
  if (agentId) syncAgentCurrentTask(agentId, task.id);
  recordTaskEvent(task.id, 'assigned', 'Mildred', agentId ? `Assigned to ${agentId}` : 'Unassigned task owner', { agent_id: agentId });
  const updated = getTaskOr404(res, task.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  broadcastTask('task_assigned', task.id);
  res.json(readTaskDetail(task.id));
});

app.post('/api/tasks/:id/move', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const nextStatus = normalizeStatus(req.body.status, task.status);
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, Date.now(), task.id);
  recordTaskEvent(task.id, 'status_changed', 'Mildred', `Moved from ${task.status.replace('_', ' ')} to ${nextStatus.replace('_', ' ')}`, {
    from_status: task.status,
    to_status: nextStatus,
  });
  const updated = getTaskOr404(res, task.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  if (nextStatus === 'complete') {
    createOfficeReport(updated);
  }
  broadcastTask('task_moved', task.id);
  res.json(readTaskDetail(task.id));
});

app.get('/api/tasks/:id/evidence', (req, res) => {
  res.json(selectEvidenceByTask.all(req.params.id));
});

app.post('/api/tasks/:id/evidence', upload.single('file'), (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const evidenceId = createId('ev');
  db.prepare(`
    INSERT INTO evidence (id, task_id, filename, original_name, mime_type, size, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, task.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, Date.now());
  recordTaskEvent(task.id, 'evidence_added', 'Mildred', `Attached evidence: ${req.file.originalname}`, {
    evidence_id: evidenceId,
    original_name: req.file.originalname,
  });
  const evidence = db.prepare<EvidenceRow>('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  broadcastUpdate({ type: 'evidence_uploaded', data: evidence });
  res.status(201).json(evidence);
});

app.get('/api/evidence/:id/download', (req, res) => {
  const evidence = db.prepare<EvidenceRow>('SELECT * FROM evidence WHERE id = ?').get(req.params.id);
  if (!evidence) {
    res.status(404).json({ error: 'Evidence not found' });
    return;
  }
  const filePath = path.join(uploadsDir, evidence.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.setHeader('Content-Type', evidence.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${evidence.original_name}"`);
  res.sendFile(filePath);
});

app.delete('/api/evidence/:id', (req, res) => {
  const evidence = db.prepare<EvidenceRow>('SELECT * FROM evidence WHERE id = ?').get(req.params.id);
  if (evidence) {
    try {
      fs.unlinkSync(path.join(uploadsDir, evidence.filename));
    } catch (error) {
      void error;
    }
    recordTaskEvent(evidence.task_id, 'evidence_removed', 'Mildred', `Removed evidence: ${evidence.original_name}`);
  }
  db.prepare('DELETE FROM evidence WHERE id = ?').run(req.params.id);
  broadcastUpdate({ type: 'evidence_deleted', data: { id: req.params.id } });
  res.status(204).send();
});

app.get('/api/tasks/:id/approvals', (req, res) => {
  res.json(selectApprovalsByTask.all(req.params.id));
});

function createApproval(taskId: string, decision: ApprovalDecision, notes: string | null, decidedBy: string) {
  const approvalId = createId('apr');
  const now = Date.now();
  db.prepare(`
    INSERT INTO approvals (id, task_id, decision, notes, decided_by, decided_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(approvalId, taskId, decision, notes, decidedBy, now);
  return db.prepare<ApprovalRow>('SELECT * FROM approvals WHERE id = ?').get(approvalId);
}

app.post('/api/tasks/:id/approve', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
  const decidedBy = typeof req.body.decided_by === 'string' ? req.body.decided_by : 'Philip';
  const approval = createApproval(task.id, 'approve', notes, decidedBy);
  db.prepare('UPDATE tasks SET status = ?, completion_summary = COALESCE(?, completion_summary), updated_at = ? WHERE id = ?')
    .run('complete', notes, Date.now(), task.id);
  recordTaskEvent(task.id, 'approved', decidedBy, 'Approved for completion', { notes });
  const updated = getTaskOr404(res, task.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  createOfficeReport(updated);
  broadcastUpdate({ type: 'task_approved', data: { task: readTaskDetail(task.id), approval } });
  res.json(approval);
});

app.post('/api/tasks/:id/request-changes', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
  const decidedBy = typeof req.body.decided_by === 'string' ? req.body.decided_by : 'Philip';
  const approval = createApproval(task.id, 'request_changes', notes, decidedBy);
  db.prepare('UPDATE tasks SET status = ?, blocker_reason = ?, updated_at = ? WHERE id = ?')
    .run('in_progress', notes, Date.now(), task.id);
  recordTaskEvent(task.id, 'changes_requested', decidedBy, 'Requested changes before completion', { notes });
  const updated = getTaskOr404(res, task.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  broadcastUpdate({ type: 'changes_requested', data: { task: readTaskDetail(task.id), approval } });
  res.json(approval);
});

app.post('/api/tasks/:id/send-back', (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
  const decidedBy = typeof req.body.decided_by === 'string' ? req.body.decided_by : 'Philip';
  const approval = createApproval(task.id, 'send_back', notes, decidedBy);
  db.prepare('UPDATE tasks SET status = ?, blocker_reason = ?, updated_at = ? WHERE id = ?')
    .run('backlog', notes, Date.now(), task.id);
  recordTaskEvent(task.id, 'sent_back', decidedBy, 'Sent back to backlog', { notes });
  const updated = getTaskOr404(res, task.id);
  if (!updated) return;
  syncOfficeAgentForTask(updated);
  broadcastUpdate({ type: 'task_sent_back', data: { task: readTaskDetail(task.id), approval } });
  res.json(approval);
});

app.get('/api/tasks/:id/pr', (req, res) => {
  res.json(selectPrsByTask.all(req.params.id));
});

app.post('/api/tasks/:id/pr', async (req, res) => {
  const task = getTaskOr404(res, req.params.id);
  if (!task) return;
  const { pr_url, pr_number, owner, repo } = req.body as { pr_url?: string; pr_number?: number; owner?: string; repo?: string };
  let prNum = pr_number;
  if (!prNum && pr_url) {
    const match = pr_url.match(/\/pull\/(\d+)/);
    if (match) {
      prNum = Number.parseInt(match[1], 10);
    }
  }
  if (!prNum) {
    res.status(400).json({ error: 'PR number or URL required' });
    return;
  }

  const now = Date.now();
  let prStatus = 'open';
  let ciStatus = 'unknown';

  if (octokit && owner && repo) {
    try {
      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNum });
      prStatus = pr.merged_at ? 'merged' : pr.state;
      try {
        const { data: checks } = await octokit.rest.checks.listForRef({ owner, repo, ref: pr.head.sha });
        const conclusion = checks.check_runs[0]?.conclusion;
        ciStatus = conclusion === 'success' ? 'passing' : conclusion === 'failure' ? 'failing' : 'pending';
      } catch {
        ciStatus = 'unknown';
      }
    } catch {
      prStatus = 'open';
    }
  }

  const prId = createId('pr');
  db.prepare(`
    INSERT INTO pr_tracking (id, task_id, pr_number, pr_url, status, ci_status, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(prId, task.id, prNum, pr_url || `https://github.com/${owner}/${repo}/pull/${prNum}`, prStatus, ciStatus, now);
  recordTaskEvent(task.id, 'pr_linked', 'Mildred', `Linked PR #${prNum}`, { pr_number: prNum, pr_url: pr_url ?? null, owner: owner ?? null, repo: repo ?? null });
  const pr = db.prepare<PrTrackingRow>('SELECT * FROM pr_tracking WHERE id = ?').get(prId);
  broadcastUpdate({ type: 'pr_linked', data: pr });
  res.status(201).json(pr);
});

app.post('/api/tasks/:id/pr/refresh', async (req, res) => {
  const taskId = req.params.id;
  const prs = selectPrsByTask.all(taskId);
  const { owner, repo } = req.body as { owner?: string; repo?: string };
  if (!octokit || !owner || !repo) {
    res.json(prs);
    return;
  }
  const now = Date.now();
  const updated = await Promise.all(prs.map(async (pr) => {
    try {
      const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pr.pr_number });
      const status = data.merged_at ? 'merged' : data.state;
      let ciStatus = 'unknown';
      try {
        const { data: checks } = await octokit.rest.checks.listForRef({ owner, repo, ref: data.head.sha });
        const conclusion = checks.check_runs[0]?.conclusion;
        ciStatus = conclusion === 'success' ? 'passing' : conclusion === 'failure' ? 'failing' : 'pending';
      } catch {
        ciStatus = 'unknown';
      }
      db.prepare('UPDATE pr_tracking SET status = ?, ci_status = ?, last_checked = ? WHERE id = ?').run(status, ciStatus, now, pr.id);
      return { ...pr, status, ci_status: ciStatus, last_checked: now };
    } catch {
      return pr;
    }
  }));
  recordTaskEvent(taskId, 'pr_refreshed', 'Mildred', 'Refreshed PR status');
  broadcastUpdate({ type: 'pr_refreshed', data: updated });
  res.json(updated);
});

app.delete('/api/pr/:id', (req, res) => {
  const pr = db.prepare<PrTrackingRow>('SELECT * FROM pr_tracking WHERE id = ?').get(req.params.id);
  if (pr) {
    recordTaskEvent(pr.task_id, 'pr_unlinked', 'Mildred', `Unlinked PR #${pr.pr_number}`);
  }
  db.prepare('DELETE FROM pr_tracking WHERE id = ?').run(req.params.id);
  broadcastUpdate({ type: 'pr_unlinked', data: { id: req.params.id } });
  res.status(204).send();
});

app.get('/api/tasks/:id/history', (req, res) => {
  const detail = readTaskDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ approvals: detail.approvals, prs: detail.prs, evidence: detail.evidence, events: detail.history });
});

app.get('/api/lanes', (_req, res) => {
  const lanes = db.prepare<LaneRow>('SELECT * FROM lanes ORDER BY name').all();
  res.json(lanes);
});

app.post('/api/lanes', (req, res) => {
  const { id, name, color, description } = req.body as Partial<LaneRow>;
  if (!id || !name || !color) {
    res.status(400).json({ error: 'id, name, and color are required' });
    return;
  }
  db.prepare('INSERT INTO lanes (id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, color, description ?? '', Date.now());
  const lane = selectLaneById.get(id);
  broadcastUpdate({ type: 'lane_created', data: lane });
  res.status(201).json(lane);
});

app.put('/api/lanes/:id', (req, res) => {
  const { name, color, description } = req.body as Partial<LaneRow>;
  db.prepare(`UPDATE lanes SET name = COALESCE(?, name), color = COALESCE(?, color), description = COALESCE(?, description) WHERE id = ?`)
    .run(name, color, description, req.params.id);
  const lane = selectLaneById.get(req.params.id);
  broadcastUpdate({ type: 'lane_updated', data: lane });
  res.json(lane);
});

app.delete('/api/lanes/:id', (req, res) => {
  db.prepare('UPDATE tasks SET lane_id = NULL WHERE lane_id = ?').run(req.params.id);
  db.prepare('DELETE FROM lanes WHERE id = ?').run(req.params.id);
  broadcastUpdate({ type: 'lane_deleted', data: { id: req.params.id } });
  res.status(204).send();
});

app.get('/api/task-costs', (_req, res) => {
  const costs = db.prepare(`
    SELECT tc.*, t.title AS task_title
    FROM task_costs tc
    LEFT JOIN tasks t ON tc.task_id = t.id
    ORDER BY tc.recorded_at DESC
  `).all();
  res.json(costs);
});

app.get('/api/task-costs/summary', (req, res) => {
  const { lane_id, start_date, end_date } = req.query;
  let query = `
    SELECT tc.*, t.title AS task_title, t.lane_id, l.name AS lane_name, l.color AS lane_color
    FROM task_costs tc
    LEFT JOIN tasks t ON tc.task_id = t.id
    LEFT JOIN lanes l ON t.lane_id = l.id
    WHERE 1 = 1
  `;
  const params: Array<string | number> = [];
  if (typeof lane_id === 'string' && lane_id) {
    query += ' AND t.lane_id = ?';
    params.push(lane_id);
  }
  if (typeof start_date === 'string' && start_date) {
    query += ' AND tc.recorded_at >= ?';
    params.push(Number.parseInt(start_date, 10));
  }
  if (typeof end_date === 'string' && end_date) {
    query += ' AND tc.recorded_at <= ?';
    params.push(Number.parseInt(end_date, 10));
  }
  query += ' ORDER BY tc.recorded_at DESC';
  const costs = db.prepare(query).all(...params) as Array<{ tokens_used?: number; estimated_cost?: number; actual_cost?: number }>;
  const totals = costs.reduce((acc, cost) => ({
    tokens: acc.tokens + (cost.tokens_used || 0),
    estimated: acc.estimated + (cost.estimated_cost || 0),
    actual: acc.actual + (cost.actual_cost || 0),
  }), { tokens: 0, estimated: 0, actual: 0 });
  res.json({ costs, totals });
});

app.post('/api/task-costs', (req, res) => {
  const { task_id, tokens_used, estimated_cost, actual_cost } = req.body as { task_id?: string; tokens_used?: number; estimated_cost?: number; actual_cost?: number };
  if (!task_id) {
    res.status(400).json({ error: 'task_id is required' });
    return;
  }
  const id = createId('tc');
  db.prepare(`
    INSERT INTO task_costs (id, task_id, tokens_used, estimated_cost, actual_cost, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, task_id, tokens_used || 0, estimated_cost || 0, actual_cost || 0, Date.now());
  const cost = db.prepare('SELECT * FROM task_costs WHERE id = ?').get(id);
  broadcastUpdate({ type: 'cost_recorded', data: cost });
  res.status(201).json(cost);
});

app.get('/api/weekly-summaries', (req, res) => {
  const { week_start } = req.query;
  if (typeof week_start === 'string' && week_start) {
    const summary = db.prepare('SELECT * FROM weekly_summaries WHERE week_start = ?').get(week_start);
    res.json(summary || null);
    return;
  }
  const summaries = db.prepare('SELECT * FROM weekly_summaries ORDER BY week_start DESC LIMIT 10').all();
  res.json(summaries);
});

app.post('/api/weekly-summaries/generate', (req, res) => {
  const { week_start, week_end } = req.body as { week_start?: string; week_end?: string };
  const start = week_start ? Number.parseInt(week_start, 10) : Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) * 7 * 24 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000;
  const end = week_end ? Number.parseInt(week_end, 10) : start + 7 * 24 * 60 * 60 * 1000;
  const tasks = db.prepare(`
    SELECT * FROM tasks
    WHERE (created_at >= ? AND created_at < ?) OR (updated_at >= ? AND updated_at < ?)
  `).all(start, end, start, end) as TaskRow[];
  const completed = tasks.filter(task => task.status === 'complete').length;
  const inProgress = tasks.filter(task => task.status === 'in_progress').length;
  const blocked = tasks.filter(task => task.blocker_reason).length;
  const costs = db.prepare(`
    SELECT SUM(tokens_used) AS tokens, SUM(actual_cost) AS total_cost
    FROM task_costs
    WHERE recorded_at >= ? AND recorded_at < ?
  `).get(start, end) as { tokens?: number; total_cost?: number } | undefined;
  const upcoming = db.prepare(`
    SELECT * FROM tasks
    WHERE deadline IS NOT NULL AND deadline > ? AND deadline <= ? AND status NOT IN ('complete')
    ORDER BY deadline ASC
  `).all(end, end + 7 * 24 * 60 * 60 * 1000) as TaskRow[];
  const summary = {
    week_start: start,
    week_end: end,
    tasks_completed: completed,
    tasks_in_progress: inProgress,
    tasks_blocked: blocked,
    total_tasks: tasks.length,
    tokens_used: costs?.tokens || 0,
    total_cost: costs?.total_cost || 0,
    upcoming_deadlines: upcoming.length,
    deadline_tasks: upcoming.map(task => ({ id: task.id, title: task.title, deadline: task.deadline, status: task.status })),
  };
  const id = createId('ws');
  db.prepare(`
    INSERT INTO weekly_summaries (id, week_start, week_end, summary_json, generated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, start, end, JSON.stringify(summary), Date.now());
  const saved = db.prepare('SELECT * FROM weekly_summaries WHERE id = ?').get(id);
  broadcastUpdate({ type: 'weekly_summary_generated', data: saved });
  res.status(201).json(saved);
});

app.get('/api/dashboard/stats', (_req, res) => {
  const now = Date.now();
  const in48h = now + 48 * 60 * 60 * 1000;
  const in24h = now + 24 * 60 * 60 * 1000;
  const allTasks = db.prepare<TaskRow>('SELECT * FROM tasks').all();
  const byStatus = {
    backlog: allTasks.filter(task => task.status === 'backlog').length,
    ready: allTasks.filter(task => task.status === 'ready').length,
    in_progress: allTasks.filter(task => task.status === 'in_progress').length,
    verification: allTasks.filter(task => task.status === 'verification').length,
    complete: allTasks.filter(task => task.status === 'complete').length,
  };
  const overdue = allTasks.filter(task => task.deadline && task.deadline < now && task.status !== 'complete').length;
  const dueSoon = allTasks.filter(task => task.deadline && task.deadline >= now && task.deadline <= in48h && task.status !== 'complete').length;
  const dueVerySoon = allTasks.filter(task => task.deadline && task.deadline >= now && task.deadline <= in24h && task.status !== 'complete').length;
  const blocked = allTasks.filter(task => task.blocker_reason).length;
  const activeAgents = db.prepare("SELECT * FROM agents WHERE status != 'idle'").all().length;
  const lanes = db.prepare<LaneRow>('SELECT * FROM lanes').all();
  const laneStats = lanes.map(lane => {
    const laneTasks = allTasks.filter(task => task.lane_id === lane.id);
    const completed = laneTasks.filter(task => task.status === 'complete').length;
    return {
      id: lane.id,
      name: lane.name,
      color: lane.color,
      total: laneTasks.length,
      completed,
      completionRate: laneTasks.length > 0 ? Math.round((completed / laneTasks.length) * 100) : 0,
    };
  });
  const recentActivity = db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC LIMIT 10').all();
  const recentCompletions = db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'complete'
    ORDER BY updated_at DESC
    LIMIT 6
  `).all();
  const activeWork = db.prepare(`
    SELECT * FROM tasks
    WHERE status IN ('ready', 'in_progress', 'verification')
    ORDER BY updated_at DESC
    LIMIT 8
  `).all();
  res.json({
    totalTasks: allTasks.length,
    byStatus,
    overdue,
    dueSoon,
    dueVerySoon,
    blocked,
    activeAgents,
    laneStats,
    recentActivity,
    recentCompletions,
    activeWork,
  });
});

const server = createServer(app);

app.get('/api/office/agents', (_req, res) => {
  const agents = db.prepare<OfficeAgentRow>('SELECT * FROM office_agents WHERE office_enabled = 1').all();
  res.json({ agents });
});

app.get('/api/office/agents/:id', (req, res) => {
  const agent = selectOfficeAgentById.get(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

app.post('/api/office/agents/:id/state', (req, res) => {
  const { state, task, progress } = req.body as { state?: string; task?: string; progress?: number };
  db.prepare('UPDATE office_agents SET state = ?, current_task = ?, task_progress = ? WHERE id = ?')
    .run(state || 'idle', task || null, progress || 0, req.params.id);
  officeWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'agent.state', agentId: req.params.id, state, task, progress }));
    }
  });
  res.json({ success: true });
});

app.post('/api/office/agents/:id/move', (req, res) => {
  const { x, y } = req.body as { x: number; y: number };
  db.prepare('UPDATE office_agents SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, req.params.id);
  officeWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'agent.move', agentId: req.params.id, to: { x, y } }));
    }
  });
  res.json({ success: true });
});

app.get('/api/office/reports', (_req, res) => {
  const reports = db.prepare<OfficeReportRow>('SELECT * FROM office_reports ORDER BY completed_at DESC').all();
  res.json({ reports });
});

app.post('/api/office/report', (req, res) => {
  const { agent_id, agent_name, task_title } = req.body as { agent_id?: string; agent_name?: string; task_title?: string };
  if (!agent_id || !agent_name || !task_title) {
    res.status(400).json({ error: 'agent_id, agent_name, and task_title are required' });
    return;
  }
  const id = createId('report');
  db.prepare(`
    INSERT INTO office_reports (id, agent_id, agent_name, task_title, completed_at, acknowledged)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, agent_id, agent_name, task_title, Date.now());
  const report = db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE id = ?').get(id);
  officeWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'report.new', reportId: id, agentId: agent_id, agentName: agent_name, taskTitle: task_title }));
    }
  });
  res.status(201).json(report);
});

app.post('/api/office/report/:id/acknowledge', (req, res) => {
  db.prepare('UPDATE office_reports SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const officeWss = new WebSocketServer({ server, path: '/ws/office' });

officeWss.on('connection', (ws) => {
  const agents = db.prepare<OfficeAgentRow>('SELECT * FROM office_agents WHERE office_enabled = 1').all();
  ws.send(JSON.stringify({ type: 'office.init', agents }));
});

const wss = new WebSocketServer({ server, path: '/gateway' });

function broadcastUpdate(message: JsonObject | { type: string; data?: unknown }) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      handleGatewayMessage(JSON.parse(data.toString()) as JsonObject);
    } catch {
      // ignore malformed gateway messages
    }
  });
});

let gatewayWs: WebSocket | null = null;

function connectToGateway() {
  try {
    gatewayWs = new WebSocket('ws://localhost:18789');
    gatewayWs.on('open', () => {
      db.prepare('UPDATE status SET gateway_connected = 1, last_update = ? WHERE id = 1').run(Date.now());
      gatewayWs?.send(JSON.stringify({ type: 'register', client: 'command-center' }));
    });
    gatewayWs.on('message', (data) => {
      try {
        handleGatewayMessage(JSON.parse(data.toString()) as JsonObject);
      } catch {
        // ignore malformed gateway payload
      }
    });
    gatewayWs.on('close', () => {
      gatewayWs = null;
      db.prepare('UPDATE status SET gateway_connected = 0 WHERE id = 1').run();
      setTimeout(connectToGateway, 5000);
    });
    gatewayWs.on('error', () => {
      db.prepare('UPDATE status SET gateway_connected = 0 WHERE id = 1').run();
    });
  } catch {
    setTimeout(connectToGateway, 5000);
  }
}

function handleGatewayMessage(message: JsonObject) {
  if (message.type === 'agent_status' || message.type === 'agent_update') {
    const agent = typeof message.data === 'object' && message.data ? message.data as JsonObject : null;
    if (agent?.id && typeof agent.id === 'string') {
      db.prepare(`
        INSERT INTO agents (id, name, status, last_seen)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          last_seen = excluded.last_seen
      `).run(agent.id, typeof agent.name === 'string' ? agent.name : agent.id, typeof agent.status === 'string' ? agent.status : 'unknown', Date.now());
    }
  }
  broadcastUpdate({ type: String(message.type || 'gateway_message'), data: message.data });
}

server.listen(PORT, () => {
  console.log(`Command Center API running on port ${PORT}`);
  console.log(`Frontend origins: ${FRONTEND_ORIGINS.join(', ')}`);
  console.log(`GitHub: ${octokit ? 'enabled' : 'disabled'}`);
  connectToGateway();
});

export { app, db };
