import express, { type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { execFileSync } from 'child_process';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { Octokit } from 'octokit';
import { GatewayClient, type AgentVisualStatus, type ParsedAgentEvent } from './gateway-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const ENABLE_PUBLIC_DASHBOARD_TUNNEL = process.env.ENABLE_PUBLIC_DASHBOARD_TUNNEL === '1';
const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'verification', 'complete'] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
type ApprovalDecision = 'approve' | 'request_changes' | 'send_back';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}


interface DiagnosticEventRow {
  id: string;
  created_at: string;
  user_id: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  flow: string | null;
  screen: string | null;
  project_id: string | null;
  scene_id: string | null;
  take_id: string | null;
  error_code: string | null;
  message: string | null;
  app_platform: string | null;
  app_version: string | null;
  build_number: string | null;
  device_name: string | null;
  os_version: string | null;
  metadata: Record<string, unknown> | null;
}

interface DiagnosticEventsResponse {
  configured: boolean;
  source: string;
  checkedAt: number;
  events: DiagnosticEventRow[];
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    byBuild: Array<{ buildNumber: string; count: number }>;
    byFlow: Array<{ flow: string; count: number }>;
    byType: Array<{ eventType: string; count: number; latestAt: string | null }>;
  };
  error?: string;
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
  progress_summary: string | null;
  next_step: string | null;
  model_used: string | null;
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
  task_id: string | null;
  agent_id: string;
  agent_name: string;
  task_title: string;
  summary: string | null;
  lane_name: string | null;
  model_used: string | null;
  completed_at: number;
  acknowledged: number;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: number | null;
  approved_by: string | null;
  approved_at: number | null;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  eventType: 'thinking' | 'tool_call' | 'speaking' | 'idle' | 'error';
  tool: string | null;
  summary: string;
}

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  repo_url: string | null;
  live_url: string | null;
  local_path: string | null;
  description: string | null;
  created_at: number;
  updated_at: number;
}

const WORK_ITEM_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const;
type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

interface WorkItemRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: number;
  status: WorkItemStatus;
  assigned_agent: string | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface ProjectCronLinkRow {
  project_id: string;
  cron_job_id: string;
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
if (ENABLE_PUBLIC_DASHBOARD_TUNNEL) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/^\/(?!api|ws).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

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
    progress_summary TEXT,
    next_step TEXT,
    model_used TEXT,
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
    task_id TEXT,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    task_title TEXT NOT NULL,
    summary TEXT,
    lane_name TEXT,
    model_used TEXT,
    completed_at INTEGER,
    acknowledged INTEGER DEFAULT 0,
    review_status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    approved_by TEXT,
    approved_at INTEGER,
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

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    repo_url TEXT,
    live_url TEXT,
    local_path TEXT,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','blocked')),
    assigned_agent TEXT,
    blocker_reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    completed_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_cron_links (
    project_id TEXT NOT NULL,
    cron_job_id TEXT NOT NULL,
    PRIMARY KEY (project_id, cron_job_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
  'ALTER TABLE tasks ADD COLUMN progress_summary TEXT',
  'ALTER TABLE tasks ADD COLUMN next_step TEXT',
  'ALTER TABLE tasks ADD COLUMN model_used TEXT',
  "ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'telegram'",
  "ALTER TABLE tasks ADD COLUMN requester TEXT DEFAULT 'Philip'",
  'ALTER TABLE office_reports ADD COLUMN task_id TEXT',
  'ALTER TABLE office_reports ADD COLUMN summary TEXT',
  'ALTER TABLE office_reports ADD COLUMN lane_name TEXT',
  'ALTER TABLE office_reports ADD COLUMN model_used TEXT',
  "ALTER TABLE office_reports ADD COLUMN review_status TEXT DEFAULT 'pending'",
  'ALTER TABLE office_reports ADD COLUMN reviewed_by TEXT',
  'ALTER TABLE office_reports ADD COLUMN reviewed_at INTEGER',
  'ALTER TABLE office_reports ADD COLUMN approved_by TEXT',
  'ALTER TABLE office_reports ADD COLUMN approved_at INTEGER',
];

for (const statement of migrationStatements) {
  try {
    db.exec(statement);
  } catch (error) {
    void error;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    file_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    url TEXT,
    category TEXT DEFAULT 'general',
    collected INTEGER DEFAULT 0,
    collected_at INTEGER,
    created_at INTEGER NOT NULL
  );
`);

db.exec(`INSERT OR IGNORE INTO status (id, gateway_connected, last_update) VALUES (1, 0, 0)`);

const defaultAgents = [
  { id: 'main', name: 'Mildred (Main Agent)' },
  { id: 'dev', name: 'Dev (Coding Agent)' },
  { id: 'janet', name: 'Janet (Email Agent)' },
  { id: 'kimi', name: 'Kimi (Research Agent)' },
  { id: 'gpt-mini', name: 'GPT-mini (Utility Agent)' },
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

const defaultProjects = [
  { id: 'selftape', name: 'Self-e-Tape', slug: 'selftape', color: '#f97316', repo_url: 'https://github.com/philipriccio/SelfTapeApp', live_url: 'https://selfetape.com', local_path: '/Users/mildred/.openclaw/workspace/projects/SelfTapeApp', description: null },
  { id: 'ct-crm', name: 'Company Theatre CRM', slug: 'ct-crm', color: '#ef4444', repo_url: 'https://github.com/philipriccio/company-theatre-crm', live_url: 'https://crm.companytheatre.ca', local_path: '/Users/mildred/.openclaw/workspace/projects/company-theatre-crm', description: null },
  { id: 'ct-website', name: 'Company Theatre Website', slug: 'ct-website', color: '#ef4444', repo_url: 'https://github.com/philipriccio/company-theatre-website', live_url: 'https://companytheatre.ca', local_path: '/Users/mildred/.openclaw/workspace/projects/company-theatre-website', description: null },
  { id: 'hawco-crm', name: 'Hawco Dev CRM', slug: 'hawco-crm', color: '#8b5cf6', repo_url: 'https://github.com/philipriccio/hawco-dev-crm', live_url: 'https://hawco.companytheatre.ca', local_path: '/Users/mildred/.openclaw/workspace/projects/hawco-dev-crm', description: null },
  { id: 'command-center', name: 'Mission Control', slug: 'command-center', color: '#3b82f6', repo_url: 'https://github.com/philipriccio/philip-mildred-command-center', live_url: null, local_path: '/Users/mildred/.openclaw/workspace/projects/command-center', description: null },
  { id: 'coverageiq', name: 'CoverageIQ', slug: 'coverageiq', color: '#10b981', repo_url: null, live_url: 'https://coverageiq.companytheatre.ca', local_path: '/Users/mildred/.openclaw/workspace/projects/coverageiq', description: null },
  { id: 'infrastructure', name: 'Infrastructure', slug: 'infrastructure', color: '#6b7280', repo_url: null, live_url: null, local_path: null, description: null },
] as const;

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (id, name, slug, color, repo_url, live_url, local_path, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const project of defaultProjects) {
  insertProject.run(project.id, project.name, project.slug, project.color, project.repo_url, project.live_url, project.local_path, project.description);
}

// Agent desk positions in the pixel art office grid
const AGENT_DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  main:       { x: 18, y: 4 },   // Mildred's desk (top-right)
  dev:        { x: 3,  y: 4 },   // Dev's desk (top-left)
  janet:      { x: 3,  y: 12 },  // Janet's desk (bottom-left)
  kimi:       { x: 18, y: 12 },  // Kimi's desk (bottom-right)
  'gpt-mini': { x: 10, y: 8 },   // GPT-mini's desk (center)
};

const AGENT_COLORS: Record<string, string> = {
  main: '#008080',
  dev: '#808080',
  janet: '#8B4513',
  kimi: '#2E86C1',
  'gpt-mini': '#27AE60',
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  main: 'Mildred',
  dev: 'Dev',
  janet: 'Janet',
  kimi: 'Kimi',
  'gpt-mini': 'GPT-mini',
};

// Clean up legacy hardcoded agents that don't match gateway IDs
for (const legacyId of ['mildred', 'content', 'research', 'claire', 'content-agent', 'research-agent']) {
  db.prepare('DELETE FROM office_agents WHERE id = ?').run(legacyId);
  // Clean up task references first, then agent
  db.prepare('UPDATE tasks SET agent_id = NULL WHERE agent_id = ?').run(legacyId);
  db.prepare('DELETE FROM agents WHERE id = ?').run(legacyId);
}

// Default agents — these are the real gateway agent IDs
const officeDefaultAgents = [
  { id: 'main', name: 'Mildred', position_x: 18, position_y: 4, state: 'idle', color: '#008080' },
  { id: 'dev', name: 'Dev', position_x: 3, position_y: 4, state: 'idle', color: '#808080' },
  { id: 'janet', name: 'Janet', position_x: 3, position_y: 12, state: 'idle', color: '#8B4513' },
  { id: 'kimi', name: 'Kimi', position_x: 18, position_y: 12, state: 'idle', color: '#2E86C1' },
  { id: 'gpt-mini', name: 'GPT-mini', position_x: 10, position_y: 8, state: 'idle', color: '#27AE60' },
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
const selectLatestOfficeReportByTaskId = db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1');
const selectProjectById = db.prepare<ProjectRow>('SELECT * FROM projects WHERE id = ?');
const selectWorkItemById = db.prepare<WorkItemRow>('SELECT * FROM work_items WHERE id = ?');

const activityBuffer: ActivityEntry[] = [];
const MAX_ACTIVITY_ENTRIES = 100;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushActivityEntry(entry: ActivityEntry) {
  activityBuffer.push(entry);
  if (activityBuffer.length > MAX_ACTIVITY_ENTRIES) {
    activityBuffer.splice(0, activityBuffer.length - MAX_ACTIVITY_ENTRIES);
  }
}

function getRecentActivity(limit = 50) {
  return activityBuffer.slice(-limit);
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

function normalizeWorkItemStatus(value: unknown, fallback: WorkItemStatus = 'todo'): WorkItemStatus {
  if (typeof value === 'string' && WORK_ITEM_STATUSES.includes(value as WorkItemStatus)) {
    return value as WorkItemStatus;
  }
  return fallback;
}

function clampPriority(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(3, Math.trunc(num)));
}

function getProjectOr404(res: Response, id: string) {
  const project = selectProjectById.get(id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

function getWorkItemOr404(res: Response, id: string) {
  const workItem = selectWorkItemById.get(id);
  if (!workItem) {
    res.status(404).json({ error: 'Work item not found' });
    return null;
  }
  return workItem;
}

async function readProjectDetail(id: string) {
  const project = selectProjectById.get(id);
  if (!project) return null;
  const work_items = db.prepare<WorkItemRow>('SELECT * FROM work_items WHERE project_id = ? ORDER BY priority ASC, updated_at DESC').all(id);
  const cron_job_ids = db.prepare<ProjectCronLinkRow>('SELECT * FROM project_cron_links WHERE project_id = ? ORDER BY cron_job_id').all(id).map((row) => row.cron_job_id);

  let cron_jobs: unknown[] = [];
  if (cron_job_ids.length > 0 && gateway?.isConnected()) {
    try {
      const data = await gateway.request('cron.list', { includeDisabled: true }) as { jobs?: Array<{ id: string }> };
      cron_jobs = (data.jobs ?? []).filter((job) => cron_job_ids.includes(job.id));
    } catch (error) {
      console.warn('[Projects] Failed to fetch linked cron jobs', error);
    }
  }

  return {
    ...project,
    work_items,
    cron_job_ids,
    cron_jobs,
  };
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
    office_report: selectLatestOfficeReportByTaskId.get(id) ?? null,
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

function deriveOfficeState(task: TaskRow | null) {
  if (!task || task.status === 'complete') {
    return { officeState: 'inactive', taskProgress: 0, taskTitle: null as string | null };
  }
  if (task.blocker_reason) {
    return { officeState: 'blocked', taskProgress: Math.max(task.status === 'verification' ? 85 : 45, 20), taskTitle: task.title };
  }
  if (task.status === 'verification') {
    return { officeState: 'working', taskProgress: 90, taskTitle: task.title };
  }
  if (task.status === 'in_progress') {
    return { officeState: 'working', taskProgress: 60, taskTitle: task.title };
  }
  if (task.status === 'ready') {
    return { officeState: 'working', taskProgress: 20, taskTitle: task.title };
  }
  return { officeState: 'inactive', taskProgress: 0, taskTitle: null as string | null };
}

function syncOfficeAgentForTask(task: TaskRow) {
  if (!task.agent_id) return;
  const officeAgent = selectOfficeAgentById.get(task.agent_id);
  if (!officeAgent) return;
  const { officeState, taskProgress, taskTitle } = deriveOfficeState(task);
  db.prepare('UPDATE office_agents SET state = ?, current_task = ?, task_progress = ? WHERE id = ?')
    .run(officeState, taskTitle, taskProgress, task.agent_id);
  broadcastToTopics(['office', 'all'], {
    type: 'agent.state',
    agentId: task.agent_id,
    state: officeState,
    task: taskTitle,
    progress: taskProgress,
  });
}

function upsertOfficeReport(task: TaskRow, options?: { forceApproved?: boolean; reviewedBy?: string | null; approvedBy?: string | null }) {
  if (!task.agent_id) return null;
  const officeAgent = selectOfficeAgentById.get(task.agent_id);
  if (!officeAgent) return null;
  const lane = task.lane_id ? selectLaneById.get(task.lane_id) : null;
  const existing = selectLatestOfficeReportByTaskId.get(task.id);
  const now = Date.now();
  const autoApproved = task.agent_id === 'mildred' || Boolean(options?.forceApproved);
  const reviewStatus = autoApproved ? 'approved' : 'pending';
  const reviewedBy = autoApproved ? (options?.reviewedBy ?? 'Mildred') : null;
  const approvedBy = autoApproved ? (options?.approvedBy ?? 'Mildred') : null;

  if (existing) {
    db.prepare(`
      UPDATE office_reports
      SET agent_id = ?,
          agent_name = ?,
          task_title = ?,
          summary = ?,
          lane_name = ?,
          model_used = ?,
          completed_at = ?,
          review_status = CASE WHEN ? = 1 THEN 'approved' ELSE COALESCE(review_status, 'pending') END,
          reviewed_by = CASE WHEN ? = 1 THEN ? ELSE reviewed_by END,
          reviewed_at = CASE WHEN ? = 1 THEN ? ELSE reviewed_at END,
          approved_by = CASE WHEN ? = 1 THEN ? ELSE approved_by END,
          approved_at = CASE WHEN ? = 1 THEN ? ELSE approved_at END
      WHERE id = ?
    `).run(
      task.agent_id, officeAgent.name, task.title, task.completion_summary || task.delivery_notes || task.request_summary || null,
      lane?.name ?? null, task.model_used ?? null, now,
      autoApproved ? 1 : 0, autoApproved ? 1 : 0, reviewedBy, autoApproved ? 1 : 0, now, autoApproved ? 1 : 0, approvedBy, autoApproved ? 1 : 0, now, existing.id,
    );
    return db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE id = ?').get(existing.id) ?? null;
  }

  const reportId = createId('report');
  db.prepare(`
    INSERT INTO office_reports (
      id, task_id, agent_id, agent_name, task_title, summary, lane_name, model_used,
      completed_at, acknowledged, review_status, reviewed_by, reviewed_at, approved_by, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(
    reportId, task.id, task.agent_id, officeAgent.name, task.title,
    task.completion_summary || task.delivery_notes || task.request_summary || null,
    lane?.name ?? null, task.model_used ?? null, now, reviewStatus, reviewedBy, reviewedBy ? now : null, approvedBy, approvedBy ? now : null,
  );
  const report = db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE id = ?').get(reportId) ?? null;
  broadcastToTopics(['office', 'all'], { type: 'report.new', report });
  return report;
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

app.get('/api/projects', (_req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      COALESCE(SUM(CASE WHEN wi.status != 'done' THEN 1 ELSE 0 END), 0) AS open_work_items_count,
      COUNT(wi.id) AS work_items_count
    FROM projects p
    LEFT JOIN work_items wi ON wi.project_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `).all();
  res.json(projects);
});

app.get('/api/projects/:id', async (req, res) => {
  const project = await readProjectDetail(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

app.post('/api/projects/:id/work-items', (req, res) => {
  const project = getProjectOr404(res, req.params.id);
  if (!project) return;
  const { title, description, priority, status, assigned_agent, blocker_reason } = req.body as Partial<WorkItemRow>;
  if (!title?.trim()) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  const id = createId('work');
  const now = Date.now();
  const nextStatus = normalizeWorkItemStatus(status);
  const nextPriority = clampPriority(priority);
  const completedAt = nextStatus === 'done' ? now : null;
  db.prepare(`
    INSERT INTO work_items (id, project_id, title, description, priority, status, assigned_agent, blocker_reason, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    project.id,
    title.trim(),
    description?.trim() || null,
    nextPriority,
    nextStatus,
    assigned_agent?.trim() || null,
    blocker_reason?.trim() || null,
    now,
    now,
    completedAt,
  );
  res.status(201).json(selectWorkItemById.get(id));
});

app.patch('/api/work-items/:id', (req, res) => {
  const existing = getWorkItemOr404(res, req.params.id);
  if (!existing) return;
  const payload = req.body as Partial<WorkItemRow>;
  const nextStatus = Object.prototype.hasOwnProperty.call(payload, 'status') ? normalizeWorkItemStatus(payload.status, existing.status) : existing.status;
  const now = Date.now();
  const completedAt = nextStatus === 'done'
    ? (existing.completed_at ?? now)
    : (Object.prototype.hasOwnProperty.call(payload, 'completed_at') ? payload.completed_at ?? null : null);

  db.prepare(`
    UPDATE work_items
    SET title = ?,
        description = ?,
        priority = ?,
        status = ?,
        assigned_agent = ?,
        blocker_reason = ?,
        updated_at = ?,
        completed_at = ?
    WHERE id = ?
  `).run(
    payload.title?.trim() || existing.title,
    Object.prototype.hasOwnProperty.call(payload, 'description') ? payload.description?.trim() || null : existing.description,
    Object.prototype.hasOwnProperty.call(payload, 'priority') ? clampPriority(payload.priority, existing.priority) : existing.priority,
    nextStatus,
    Object.prototype.hasOwnProperty.call(payload, 'assigned_agent') ? payload.assigned_agent?.trim() || null : existing.assigned_agent,
    Object.prototype.hasOwnProperty.call(payload, 'blocker_reason') ? payload.blocker_reason?.trim() || null : existing.blocker_reason,
    now,
    completedAt,
    existing.id,
  );
  res.json(selectWorkItemById.get(existing.id));
});

app.delete('/api/work-items/:id', (req, res) => {
  const existing = getWorkItemOr404(res, req.params.id);
  if (!existing) return;
  db.prepare('DELETE FROM work_items WHERE id = ?').run(existing.id);
  res.status(204).send();
});

app.post('/api/projects/:id/cron-links', (req, res) => {
  const project = getProjectOr404(res, req.params.id);
  if (!project) return;
  const cronJobId = typeof req.body.cron_job_id === 'string' ? req.body.cron_job_id.trim() : '';
  if (!cronJobId) {
    res.status(400).json({ error: 'cron_job_id is required' });
    return;
  }
  db.prepare('INSERT OR IGNORE INTO project_cron_links (project_id, cron_job_id) VALUES (?, ?)').run(project.id, cronJobId);
  res.status(201).json({ project_id: project.id, cron_job_id: cronJobId });
});

app.delete('/api/projects/:id/cron-links/:cronJobId', (req, res) => {
  const project = getProjectOr404(res, req.params.id);
  if (!project) return;
  db.prepare('DELETE FROM project_cron_links WHERE project_id = ? AND cron_job_id = ?').run(project.id, req.params.cronJobId);
  res.status(204).send();
});

app.post('/api/tasks', (req, res) => {
  const { title, description, status, agent_id, lane_id, deadline, blocker_reason, promise_date, delivery_notes, request_summary, completion_summary, progress_summary, next_step, model_used, source, requester } = req.body as Partial<TaskRow>;
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
      completion_summary, progress_summary, next_step, model_used, source, requester
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    progress_summary?.trim() || null,
    next_step?.trim() || null,
    model_used?.trim() || null,
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
        progress_summary = ?,
        next_step = ?,
        model_used = ?,
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
    Object.prototype.hasOwnProperty.call(payload, 'progress_summary') ? payload.progress_summary?.trim() || null : existing.progress_summary,
    Object.prototype.hasOwnProperty.call(payload, 'next_step') ? payload.next_step?.trim() || null : existing.next_step,
    Object.prototype.hasOwnProperty.call(payload, 'model_used') ? payload.model_used?.trim() || null : existing.model_used,
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
    upsertOfficeReport(updated);
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
  upsertOfficeReport(updated, { forceApproved: true, reviewedBy: decidedBy, approvedBy: decidedBy });
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

function safeExec(command: string, args: string[], cwd: string) {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 10_000 }).trim();
  } catch {
    return null;
  }
}

function readBuildNumber(appJsonPath: string) {
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')) as { expo?: { ios?: { buildNumber?: string } } };
    return appJson.expo?.ios?.buildNumber ?? null;
  } catch {
    return null;
  }
}

function readBuildAttempts(buildLogPath: string) {
  try {
    const text = fs.readFileSync(buildLogPath, 'utf8');
    const matches = Array.from(text.matchAll(/## Build (\d+) — ([^\n]+)\n([\s\S]*?)(?=\n## Build |\n### Expo status|$)/g));
    return matches.slice(-4).map((match) => ({
      build: match[1],
      status: match[2].trim(),
      note: (match[3].match(/- Status: ([^\n]+)/)?.[1] ?? match[3].match(/- EAS error: ([^\n]+)/)?.[1] ?? '').trim(),
    }));
  } catch {
    return [];
  }
}

async function readExpoIncident() {
  const checkedAt = Date.now();
  try {
    const response = await fetch('https://status.expo.dev/');
    const text = await response.text();
    const currentStatusText = text.split('Uptime over the past 90 days')[0] ?? text;
    const allOperational = /All Systems Operational/i.test(currentStatusText);
    const active = !allOperational && /iOS Builds fail to start|Mac workers fail to start|EAS Build.*degraded/i.test(currentStatusText);
    const title = active ? currentStatusText.match(/iOS Builds fail to start/i)?.[0] ?? null : null;
    const summary = active ? currentStatusText.match(/Mac workers fail to start[^<\n]*/i)?.[0] ?? null : null;
    return { active, title, summary, checkedAt };
  } catch {
    return { active: false, title: null, summary: 'Expo status unavailable', checkedAt };
  }
}


function getSelfTapeSupabaseConfig() {
  const selfTapePath = '/Users/mildred/.openclaw/workspace/projects/SelfTapeApp';
  const projectRef = process.env.SELFTAPE_SUPABASE_PROJECT_REF
    ?? readOptionalText(path.join(selfTapePath, 'supabase/.temp/project-ref'));
  const anonKey = process.env.SELFTAPE_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SELFTAPE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SELFTAPE_SUPABASE_URL
    ?? process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? (projectRef ? `https://${projectRef}.supabase.co` : null);
  const authKey = serviceRoleKey ?? anonKey ?? null;
  return { selfTapePath, projectRef, url, authKey, usingServiceRole: Boolean(serviceRoleKey) };
}

function readOptionalText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function emptyDiagnosticSummary() {
  return {
    total: 0,
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
    byBuild: [],
    byFlow: [],
    byType: [],
  };
}

function summarizeDiagnosticEvents(events: DiagnosticEventRow[]) {
  const summary = emptyDiagnosticSummary();
  summary.total = events.length;
  const byBuild = new Map<string, number>();
  const byFlow = new Map<string, number>();
  const byType = new Map<string, { count: number; latestAt: string | null }>();

  for (const event of events) {
    if (event.severity === 'critical') summary.critical += 1;
    else if (event.severity === 'error') summary.error += 1;
    else if (event.severity === 'warning') summary.warning += 1;
    else summary.info += 1;

    const build = event.build_number ?? 'unknown';
    byBuild.set(build, (byBuild.get(build) ?? 0) + 1);
    const flow = event.flow ?? 'unknown';
    byFlow.set(flow, (byFlow.get(flow) ?? 0) + 1);
    const existing = byType.get(event.event_type) ?? { count: 0, latestAt: null };
    existing.count += 1;
    if (!existing.latestAt || event.created_at > existing.latestAt) existing.latestAt = event.created_at;
    byType.set(event.event_type, existing);
  }

  summary.byBuild = Array.from(byBuild.entries())
    .map(([buildNumber, count]) => ({ buildNumber, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  summary.byFlow = Array.from(byFlow.entries())
    .map(([flow, count]) => ({ flow, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  summary.byType = Array.from(byType.entries())
    .map(([eventType, value]) => ({ eventType, ...value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return summary;
}

async function fetchDiagnosticEvents(limit: number): Promise<DiagnosticEventsResponse> {
  const checkedAt = Date.now();
  const config = getSelfTapeSupabaseConfig();
  if (!config.url || !config.authKey) {
    return {
      configured: false,
      source: config.url ?? 'unconfigured',
      checkedAt,
      events: [],
      summary: emptyDiagnosticSummary(),
      error: 'Set SELFTAPE_SUPABASE_SERVICE_ROLE_KEY or SELFTAPE_SUPABASE_ANON_KEY on the Command Center server to read diagnostic events.',
    };
  }

  const endpoint = new URL('/rest/v1/diagnostic_events', config.url);
  endpoint.searchParams.set('select', 'id,created_at,user_id,event_type,severity,flow,screen,project_id,scene_id,take_id,error_code,message,app_platform,app_version,build_number,device_name,os_version,metadata');
  endpoint.searchParams.set('order', 'created_at.desc');
  endpoint.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.authKey,
        Authorization: `Bearer ${config.authKey}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        configured: true,
        source: config.projectRef ?? config.url,
        checkedAt,
        events: [],
        summary: emptyDiagnosticSummary(),
        error: `Supabase diagnostic event query failed: ${response.status} ${body.slice(0, 240)}`,
      };
    }
    const events = await response.json() as DiagnosticEventRow[];
    return {
      configured: true,
      source: config.projectRef ?? config.url,
      checkedAt,
      events,
      summary: summarizeDiagnosticEvents(events),
    };
  } catch (error) {
    return {
      configured: true,
      source: config.projectRef ?? config.url,
      checkedAt,
      events: [],
      summary: emptyDiagnosticSummary(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

app.get('/api/selftape/status', async (_req, res) => {
  const sourcePath = '/Users/mildred/.openclaw/workspace/projects/SelfTapeApp';
  const branch = safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], sourcePath);
  const head = safeExec('git', ['rev-parse', '--short', 'HEAD'], sourcePath);
  const status = safeExec('git', ['status', '--short'], sourcePath);
  const dirty = Boolean(status?.trim());
  const buildNumber = readBuildNumber(path.join(sourcePath, 'app.json'));
  const buildAttempts = readBuildAttempts(path.join(sourcePath, 'BUILD-LOG.md'));
  const easIncident = await readExpoIncident();
  const recommendedAction = easIncident.active
    ? 'Wait for Expo/EAS iOS workers to recover, then attempt one monitored build retry.'
    : dirty
      ? 'Clean or commit the SelfTape working tree before the next build retry.'
      : 'Run one monitored production iOS build retry, then submit to TestFlight only if it completes cleanly.';

  res.json({ branch, head, dirty, buildNumber, easIncident, buildAttempts, recommendedAction, sourcePath });
});

app.get('/api/selftape/diagnostics', async (req, res) => {
  const limitParam = Number(req.query.limit ?? 80);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 250) : 80;
  const diagnostics = await fetchDiagnosticEvents(limit);
  res.json(diagnostics);
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
  broadcastToTopics(['office', 'all'], { type: 'agent.state', agentId: req.params.id, state, task, progress });
  res.json({ success: true });
});

app.post('/api/office/agents/:id/move', (req, res) => {
  const { x, y } = req.body as { x: number; y: number };
  db.prepare('UPDATE office_agents SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, req.params.id);
  broadcastToTopics(['office', 'all'], { type: 'agent.move', agentId: req.params.id, to: { x, y } });
  res.json({ success: true });
});

app.get('/api/office/reports', (req, res) => {
  const includePending = req.query.includePending === '1';
  const reports = db.prepare<OfficeReportRow>(`SELECT * FROM office_reports ${includePending ? '' : "WHERE review_status = 'approved'"} ORDER BY completed_at DESC`).all();
  res.json({ reports });
});

app.get('/api/activity/recent', (_req, res) => {
  res.json({ entries: getRecentActivity(50) });
});

app.post('/api/office/report', (req, res) => {
  const { task_id } = req.body as { task_id?: string };
  if (!task_id) {
    res.status(400).json({ error: 'task_id is required' });
    return;
  }
  const task = getTaskOr404(res, task_id);
  if (!task) return;
  const report = upsertOfficeReport(task);
  res.status(201).json(report);
});


app.post('/api/office/report/:id/approve', (req, res) => {
  const report = db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE id = ?').get(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  const approver = typeof req.body.approved_by === 'string' ? req.body.approved_by : 'Mildred';
  const now = Date.now();
  db.prepare(`
    UPDATE office_reports
    SET review_status = 'approved',
        reviewed_by = ?,
        reviewed_at = ?,
        approved_by = ?,
        approved_at = ?
    WHERE id = ?
  `).run(approver, now, approver, now, report.id);
  const updated = db.prepare<OfficeReportRow>('SELECT * FROM office_reports WHERE id = ?').get(report.id);
  broadcastToTopics(['office', 'all'], { type: 'report.updated', report: updated });
  res.json(updated);
});

app.post('/api/office/report/:id/acknowledge', (req, res) => {
  db.prepare('UPDATE office_reports SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false });
const clientSubs = new Map<WebSocket, Set<string>>();

function clientWantsTopic(ws: WebSocket, topic: string) {
  const topics = clientSubs.get(ws);
  if (!topics || topics.has('all')) return true;
  return topics.has(topic);
}

function broadcastToTopics(topics: string[], message: JsonObject | { type: string; data?: unknown; [key: string]: unknown }) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (topics.some((topic) => clientWantsTopic(client, topic))) {
      client.send(payload);
    }
  });
}

function broadcastUpdate(message: JsonObject | { type: string; data?: unknown }) {
  broadcastToTopics(['gateway', 'all'], message);
}

wss.on('connection', (ws) => {
  clientSubs.set(ws, new Set(['all']));

  const agents = db.prepare<OfficeAgentRow>('SELECT * FROM office_agents WHERE office_enabled = 1').all();
  ws.send(JSON.stringify({ type: 'office.init', agents }));
  ws.send(JSON.stringify({ type: 'activity.recent', entries: getRecentActivity() }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as JsonObject & { topics?: unknown };
      if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
        clientSubs.set(ws, new Set(msg.topics.filter((topic): topic is string => typeof topic === 'string')));
      }
    } catch {
      // ignore malformed client messages
    }
  });

  ws.on('close', () => {
    clientSubs.delete(ws);
  });
});

// ─── OpenClaw Gateway Integration ───────────────────────────────────

function readGatewayToken(): string {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as { gateway?: { auth?: { token?: string } } };
    return config?.gateway?.auth?.token ?? '';
  } catch {
    console.warn('[GatewayIntegration] Could not read gateway token from ~/.openclaw/openclaw.json');
    return '';
  }
}

const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL ?? 'ws://127.0.0.1:18789';
const gatewayToken = process.env.GATEWAY_TOKEN ?? readGatewayToken();

let gateway: GatewayClient | null = null;

function mapVisualStatusToOffice(status: AgentVisualStatus): string {
  switch (status) {
    case 'thinking': return 'working';
    case 'tool_calling': return 'working';
    case 'speaking': return 'working';
    case 'error': return 'blocked';
    case 'idle': return 'idle';
    case 'offline': return 'offline';
    default: return 'idle';
  }
}

function initGateway() {
  if (!gatewayToken) {
    console.warn('[GatewayIntegration] No gateway token — skipping live connection');
    return;
  }

  gateway = new GatewayClient(GATEWAY_WS_URL, gatewayToken);

  // Sync office_agents table from gateway snapshot on connect
  const syncOfficeAgentsFromGateway = () => {
    const snapshot = gateway?.getSnapshot();
    const agents = snapshot?.health?.agents;
    if (!agents) return;

    let nextDeskIdx = 0;
    const defaultPositions = [
      { x: 18, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 12 },
      { x: 18, y: 12 }, { x: 10, y: 4 }, { x: 10, y: 12 },
    ];

    for (const agent of agents) {
      const id = agent.agentId;
      const existing = selectOfficeAgentById.get(id) as OfficeAgentRow | undefined;
      if (existing) continue; // Don't overwrite manually-positioned agents

      const pos = AGENT_DESK_POSITIONS[id] ?? defaultPositions[nextDeskIdx++ % defaultPositions.length];
      const name = AGENT_DISPLAY_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
      const color = AGENT_COLORS[id] ?? '#666666';

      insertOfficeAgent.run(id, name, pos.x, pos.y, 'idle', color);
      console.log(`[GatewaySync] Added office agent: ${name} (${id})`);
    }
  };

  gateway.onStatus((status, error) => {
    const connected = status === 'connected' ? 1 : 0;
    db.prepare('UPDATE status SET gateway_connected = ?, last_update = ? WHERE id = 1').run(connected, Date.now());

    // Broadcast connection status to all frontend clients
    broadcastUpdate({ type: 'gateway_status', data: { status, error: error ?? null } });

    if (status === 'connected') {
      console.log('[GatewayIntegration] ✓ Connected to OpenClaw gateway');
      syncOfficeAgentsFromGateway();
    } else if (status === 'error') {
      console.error(`[GatewayIntegration] Connection error: ${error}`);
    }
  });

  gateway.onAgentEvent((parsed: ParsedAgentEvent) => {
    const now = Date.now();
    const officeState = mapVisualStatusToOffice(parsed.status);

    db.prepare(`
      INSERT INTO agents (id, name, status, last_seen)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        last_seen = excluded.last_seen
    `).run(parsed.agentId, parsed.agentId, parsed.status, now);

    const officeAgent = selectOfficeAgentById.get(parsed.agentId);
    const agentName = officeAgent?.name ?? AGENT_DISPLAY_NAMES[parsed.agentId] ?? parsed.agentId;
    const taskLabel = parsed.tool
      ? `Using ${parsed.tool}`
      : parsed.summary.length > 60
        ? parsed.summary.slice(0, 60) + '...'
        : parsed.summary || null;

    if (officeAgent) {
      db.prepare('UPDATE office_agents SET state = ?, current_task = ? WHERE id = ?')
        .run(officeState, taskLabel, parsed.agentId);

      broadcastToTopics(['office', 'all'], {
        type: 'agent.state',
        agentId: parsed.agentId,
        state: officeState,
        task: taskLabel,
        visualStatus: parsed.status,
        tool: parsed.tool,
        message: parsed.message,
        runId: parsed.runId,
      });
    }

    const activityType: ActivityEntry['eventType'] = parsed.status === 'tool_calling'
      ? 'tool_call'
      : parsed.status === 'error'
        ? 'error'
        : parsed.status;
    const activityEntry: ActivityEntry = {
      id: createId('activity'),
      timestamp: now,
      agentId: parsed.agentId,
      agentName,
      eventType: activityType,
      tool: parsed.tool,
      summary: parsed.summary,
    };
    pushActivityEntry(activityEntry);
    broadcastToTopics(['activity', 'office', 'all'], { type: 'activity.entry', entry: activityEntry });

    broadcastUpdate({
      type: 'agent_event',
      data: {
        agentId: parsed.agentId,
        status: parsed.status,
        officeState,
        tool: parsed.tool,
        message: parsed.message,
        summary: parsed.summary,
        runId: parsed.runId,
        sessionKey: parsed.sessionKey,
        timestamp: now,
      },
    });
  });

  // Forward all gateway events to frontend
  gateway.onEvent((event, payload) => {
    broadcastUpdate({ type: `gateway.${event}`, data: payload });
  });

  gateway.connect();
}

// API endpoint for live agent states from gateway
app.get('/api/gateway/agents', (_req, res) => {
  if (!gateway?.isConnected()) {
    res.json({ connected: false, agents: {} });
    return;
  }
  const states: Record<string, unknown> = {};
  for (const [id, state] of gateway.getAgentStates()) {
    states[id] = { ...state, officeState: mapVisualStatusToOffice(state.status) };
  }
  res.json({ connected: true, agents: states, server: gateway.getServerInfo() });
});

// API endpoint for gateway status
app.get('/api/gateway/status', (_req, res) => {
  res.json({
    connected: gateway?.isConnected() ?? false,
    status: gateway?.getStatus() ?? 'disconnected',
    server: gateway?.getServerInfo() ?? null,
    snapshot: gateway?.getSnapshot() ?? null,
  });
});

// ─── Gateway API Proxy Routes (cron, sessions, site health) ────────────
import { registerGatewayApiRoutes } from './gateway-api.js';
registerGatewayApiRoutes(app, () => gateway);

// ─── Deliverables / Inbox API ─────────────────────────────────────────────────

const insertDeliverable = db.prepare(`
  INSERT INTO deliverables (id, title, description, agent_id, agent_name, file_path, file_name, mime_type, file_size, url, category, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectDeliverables = db.prepare(`SELECT * FROM deliverables ORDER BY created_at DESC LIMIT 100`);
const selectUncollected = db.prepare(`SELECT * FROM deliverables WHERE collected = 0 ORDER BY created_at DESC`);
const markCollected = db.prepare(`UPDATE deliverables SET collected = 1, collected_at = ? WHERE id = ?`);

app.get('/api/inbox', (_req, res) => {
  const items = selectDeliverables.all();
  const uncollected = selectUncollected.all();
  res.json({ items, uncollectedCount: uncollected.length });
});

app.get('/api/inbox/count', (_req, res) => {
  const uncollected = selectUncollected.all();
  res.json({ count: uncollected.length });
});

app.post('/api/inbox', (req, res) => {
  const { title, description, agentId, agentName, fileName, mimeType, fileSize, url, category, filePath } = req.body as Record<string, string | number | undefined>;
  if (!title || !agentId || !agentName) {
    res.status(400).json({ error: 'title, agentId, and agentName are required' });
    return;
  }
  const id = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  insertDeliverable.run(id, title, description ?? null, agentId, agentName, filePath ?? null, fileName ?? null, mimeType ?? null, fileSize ?? null, url ?? null, category ?? 'general', now);
  const item = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id);
  broadcastUpdate({ type: 'inbox.new', data: item });
  res.json({ ok: true, item });
});

app.post('/api/inbox/:id/collect', (req, res) => {
  const { id } = req.params;
  markCollected.run(Date.now(), id);
  broadcastUpdate({ type: 'inbox.collected', data: { id } });
  res.json({ ok: true });
});

// Serve deliverable files
app.get('/api/inbox/:id/download', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id) as { file_path?: string; file_name?: string; mime_type?: string } | undefined;
  if (!item?.file_path) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  if (!fs.existsSync(item.file_path)) {
    res.status(404).json({ error: 'File no longer exists on disk' });
    return;
  }
  res.setHeader('Content-Type', item.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${item.file_name || 'download'}"`);
  fs.createReadStream(item.file_path).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Command Center API running on port ${PORT}`);
  console.log(`Frontend origins: ${FRONTEND_ORIGINS.join(', ')}`);
  console.log(`GitHub: ${octokit ? 'enabled' : 'disabled'}`);
  console.log(`Gateway: ${gatewayToken ? 'token loaded, connecting...' : 'no token, skipping'}`);
  initGateway();
});

export { app, db };
