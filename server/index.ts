import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { execFileSync, spawnSync } from 'child_process';
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
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ENABLE_PUBLIC_DASHBOARD_TUNNEL = process.env.ENABLE_PUBLIC_DASHBOARD_TUNNEL === '1';
const COMMAND_CENTER_AUTH_TOKEN = process.env.COMMAND_CENTER_AUTH_TOKEN ?? '';
const COMMAND_CENTER_AUTH_EMAILS = (process.env.COMMAND_CENTER_AUTH_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const REQUIRE_AUTH = process.env.COMMAND_CENTER_REQUIRE_AUTH === '1' || Boolean(COMMAND_CENTER_AUTH_TOKEN) || COMMAND_CENTER_AUTH_EMAILS.length > 0;
const ENABLE_HIGH_RISK_ACTIONS = process.env.COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS === '1';
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(__dirname, '..', 'uploads');
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

interface SafeDiagnosticEventRow {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  flow: string | null;
  screen: string | null;
  error_code: string | null;
  message: string | null;
  app_platform: string | null;
  app_version: string | null;
  build_number: string | null;
  os_version: string | null;
}

interface DiagnosticEventsResponse {
  configured: boolean;
  source: string;
  checkedAt: number;
  events: SafeDiagnosticEventRow[];
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    byBuild: Array<{ buildNumber: string; count: number }>;
    byFlow: Array<{ flow: string; count: number }>;
    byType: Array<{ eventType: string; count: number; latestAt: string | null }>;
    lastEventAt: string | null;
    readiness: 'no-events' | 'quiet' | 'watch' | 'investigate';
    recommendation: string;
  };
  error?: string;
}


interface ProtectedWorkCategoryRow {
  category: string;
  timeCommitted: string;
  progress: string;
  notes: string;
}

function parseProtectedWorkLog() {
  const logPath = '/Users/mildred/.openclaw/workspace/memory/protected-work-log.md';
  const fallback = {
    week: 'unknown',
    updatedAt: Date.now(),
    source: logPath,
    categories: [] as ProtectedWorkCategoryRow[],
  };
  if (!fs.existsSync(logPath)) return fallback;
  const content = fs.readFileSync(logPath, 'utf8');
  const weekMatch = content.match(/^##\s+Week of\s+(.+)$/m);
  const rows = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.startsWith('| Category'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4)
    .map(([category, timeCommitted, progress, notes]) => ({
      category,
      timeCommitted,
      progress,
      notes,
    }));
  return {
    ...fallback,
    week: weekMatch?.[1]?.trim() ?? 'unknown',
    categories: rows,
  };
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

const LIVE_AGENT_ACTIVITY_TTL_MS = 45_000;
const AGENT_IDLE_TASK_LABELS = new Set(['Run ended', 'Idle', '']);
const liveAgentActivity = new Map<string, { officeState: string; taskLabel: string | null; lastSeen: number }>();

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

function isLocalRequest(req: Request) {
  const host = req.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function extractAuthToken(req: Request) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return req.get('x-command-center-token')?.trim() ?? '';
}

function isAllowedAuthenticatedEmail(email: string | undefined) {
  if (!email || COMMAND_CENTER_AUTH_EMAILS.length === 0) return false;
  return COMMAND_CENTER_AUTH_EMAILS.includes(email.trim().toLowerCase());
}

function extractProxyAuthenticatedEmail(req: Request) {
  return req.get('cf-access-authenticated-user-email')
    ?? req.get('x-authentik-email')
    ?? req.get('x-forwarded-email')
    ?? undefined;
}

function isAuthorizedRequest(req: Request) {
  if (!REQUIRE_AUTH) return true;
  if (process.env.NODE_ENV !== 'production' && isLocalRequest(req)) return true;
  if (Boolean(COMMAND_CENTER_AUTH_TOKEN) && extractAuthToken(req) === COMMAND_CENTER_AUTH_TOKEN) return true;
  return isAllowedAuthenticatedEmail(extractProxyAuthenticatedEmail(req));
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (isAuthorizedRequest(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function requireHighRiskActions(_req: Request, res: Response, next: () => void) {
  if (ENABLE_HIGH_RISK_ACTIONS) {
    next();
    return;
  }
  res.status(403).json({ error: 'High-risk Mission Control actions are disabled' });
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
app.use('/api', requireAuth);
app.use('/api/gateway/send', requireHighRiskActions);
app.use('/api/cron/run', requireHighRiskActions);
app.use('/api/selftape/diagnostics/access-token', requireHighRiskActions);
if (ENABLE_PUBLIC_DASHBOARD_TUNNEL) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/^\/(?!api|ws).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const uploadsDir = UPLOAD_DIR;
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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'data.db');
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

function readProjectDetail(id: string) {
  const project = selectProjectById.get(id);
  if (!project) return null;
  const work_items = db.prepare<WorkItemRow>('SELECT * FROM work_items WHERE project_id = ? ORDER BY priority ASC, updated_at DESC').all(id);
  const cron_job_ids = db.prepare<{ cron_job_id: string }>('SELECT cron_job_id FROM project_cron_links WHERE project_id = ? ORDER BY cron_job_id ASC').all(id).map((row) => row.cron_job_id);
  const cockpit = project.id === 'selftape'
    ? buildSelfTapeCockpit(project, work_items)
    : buildGenericCockpit(project, work_items);
  return {
    ...project,
    work_items,
    cron_job_ids,
    cron_jobs: [],
    cockpit,
  };
}


function readRecentCommits(cwd: string, limit = 5) {
  const output = safeExec('git', ['log', `-${limit}`, '--pretty=format:%h%x09%ct%x09%s'], cwd);
  if (!output) return [];
  return output.split('\n').filter(Boolean).map((line) => {
    const [sha, timestamp, ...messageParts] = line.split('\t');
    return { sha, timestamp: Number(timestamp) * 1000, message: messageParts.join('\t') };
  });
}

function readLastTouched(filePath: string) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function summarizeSelfTapeBuildLog(buildLogPath: string) {
  try {
    const text = fs.readFileSync(buildLogPath, 'utf8');
    const latestBuild = Array.from(text.matchAll(/## Build (\d+) — ([^\n]+)\n([\s\S]*?)(?=\n## Build |\n### |$)/g)).at(-1);
    const latestArtifactProof = Array.from(text.matchAll(/Artifact Proof[^\n]*— May 6, 2026|Build 300[^\n]*/gi)).slice(-4).map((match) => match[0]);
    return {
      latestBuild: latestBuild ? { build: latestBuild[1], title: latestBuild[2].trim() } : null,
      artifactProofSignals: latestArtifactProof,
    };
  } catch {
    return { latestBuild: null, artifactProofSignals: [] as string[] };
  }
}

function buildGenericCockpit(project: ProjectRow, workItems: WorkItemRow[]) {
  const openItems = workItems.filter((item) => item.status !== 'done');
  const blockedItems = openItems.filter((item) => item.status === 'blocked');
  const inProgress = openItems.filter((item) => item.status === 'in_progress');
  const repoState = project.local_path ? {
    branch: safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], project.local_path),
    head: safeExec('git', ['rev-parse', '--short', 'HEAD'], project.local_path),
    dirty: Boolean(safeExec('git', ['status', '--short'], project.local_path)?.trim()),
    recentCommits: readRecentCommits(project.local_path, 3),
  } : null;
  const freshness = repoState ? 'live' : 'mixed';
  return {
    type: 'generic' as const,
    freshness,
    title: `${project.name} cockpit`,
    updatedAt: Date.now(),
    summary: openItems.length > 0
      ? `${openItems.length} open work item${openItems.length === 1 ? '' : 's'} tracked here. ${blockedItems.length} blocked.`
      : 'No open work items are tracked in this project cockpit yet.',
    evidenceLabel: repoState ? 'Live repo + Mission Control work items' : 'Mission Control work items only',
    warnings: repoState?.dirty ? ['Repository has uncommitted changes; do not treat build/deploy state as clean.'] : [],
    sections: [
      {
        title: 'Live source state',
        status: repoState?.dirty ? 'yellow' as const : repoState ? 'green' as const : 'slate' as const,
        body: repoState ? `${repoState.branch ?? 'unknown'} @ ${repoState.head ?? 'unknown'}${repoState.dirty ? ' with local changes' : ' clean'}` : 'No local repo path is configured for live source checks.',
        evidence: repoState?.recentCommits?.[0] ? `Latest commit: ${repoState.recentCommits[0].sha} — ${repoState.recentCommits[0].message}` : undefined,
      },
      {
        title: 'Active work',
        status: inProgress.length > 0 ? 'yellow' as const : 'slate' as const,
        body: inProgress.length > 0 ? inProgress.map((item) => item.title).join('; ') : 'No in-progress work items are tracked here.',
      },
      {
        title: 'Blocked / waiting',
        status: blockedItems.length > 0 ? 'red' as const : 'green' as const,
        body: blockedItems.length > 0 ? blockedItems.map((item) => `${item.title}${item.blocker_reason ? ` — ${item.blocker_reason}` : ''}`).join('; ') : 'No tracked blockers.',
      },
    ],
    links: [project.repo_url ? { label: 'Repo', href: project.repo_url } : null, project.live_url ? { label: 'Live site', href: project.live_url } : null].filter(Boolean),
  };
}


function readJsonFile<T extends JsonValue>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readFirstMarkdownHeading(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    return text.split('\n').find((line) => line.startsWith('## '))?.replace(/^##\s+/, '').trim() ?? null;
  } catch {
    return null;
  }
}

function readSelfTapeParserPacketStatus(sourcePath: string) {
  const statusPath = path.join(sourcePath, 'parser-lab/real-sides/review-batches/packet-002/truth-status-report.json');
  const status = readJsonFile<JsonObject>(statusPath);
  const totals = (status?.totals && typeof status.totals === 'object') ? status.totals as JsonObject : null;
  return {
    statusPath: 'parser-lab/real-sides/review-batches/packet-002/truth-status-report.json',
    reviewPacketPath: 'parser-lab/real-sides/review-batches/packet-002/HUMAN-REVIEW-PACKET.md',
    fillableFormsPath: 'parser-lab/real-sides/review-batches/packet-002/fillable-forms/',
    total: Number(totals?.total ?? 0),
    confirmed: Number(totals?.confirmed ?? 0),
    needsTruth: Number(totals?.needsTruth ?? 0),
    blockedNoText: Number(totals?.blockedNoText ?? 0),
    regressionReady: Number(totals?.regressionReady ?? 0),
    touched: readLastTouched(statusPath),
  };
}

function readSelfTapeWorkstreamState(sourcePath: string, id: string) {
  const base = path.join(sourcePath, 'workstreams', id);
  return {
    currentPacket: readFirstMarkdownHeading(path.join(base, 'CURRENT-PACKET.md')),
    currentTouched: readLastTouched(path.join(base, 'CURRENT-PACKET.md')),
    doneTouched: readLastTouched(path.join(base, 'DONE.md')),
    reportsTouched: readLastTouched(path.join(base, 'REPORTS.md')),
  };
}

function buildSelfTapeCockpit(project: ProjectRow, workItems: WorkItemRow[]) {
  const sourcePath = project.local_path ?? '/Users/mildred/.openclaw/workspace/projects/SelfTapeApp';
  const branch = safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], sourcePath);
  const head = safeExec('git', ['rev-parse', '--short', 'HEAD'], sourcePath);
  const dirty = Boolean(safeExec('git', ['status', '--short'], sourcePath)?.trim());
  const buildNumber = readBuildNumber(path.join(sourcePath, 'app.json'));
  const buildLogPath = path.join(sourcePath, 'BUILD-LOG.md');
  const projectPath = path.join(sourcePath, 'PROJECT.md');
  const buildAttempts = readBuildAttempts(buildLogPath);
  const buildLogSummary = summarizeSelfTapeBuildLog(buildLogPath);
  const latestAttempt = buildAttempts.at(-1);
  const recentCommits = readRecentCommits(sourcePath, 5);
  const buildLogTouched = readLastTouched(buildLogPath);
  const projectTouched = readLastTouched(projectPath);
  const activeItems = workItems.filter((item) => item.status === 'in_progress' || item.status === 'todo');
  const parserPacket = readSelfTapeParserPacketStatus(sourcePath);
  const parserWorkstream = readSelfTapeWorkstreamState(sourcePath, 'parser');
  const aiReaderWorkstream = readSelfTapeWorkstreamState(sourcePath, 'ai-reader');
  const soundWorkstream = readSelfTapeWorkstreamState(sourcePath, 'final-sound-export');
  const warnings = [
    'This page is written for market leadership, not engineering pride. Device truth beats app logs, and product quality only matters if actors know about it.',
    'The three blockers below are not the whole app; they are the current reasons Self-e-Tape is not beta-ready.',
    dirty ? 'SelfTape repo is dirty — no build or release action can be treated as clean.' : null,
  ].filter(Boolean) as string[];

  return {
    type: 'selftape' as const,
    freshness: 'live' as const,
    title: 'Self-e-Tape cockpit',
    updatedAt: Date.now(),
    summary: 'Self-e-Tape is not beta-ready yet. Build 301 failed as an Artifact Proof crash, so the current phase is local crash-proof/RCA work plus the three standing blockers: parser trust, AI reader reliability/timing, and final sound/export quality.',
    evidenceLabel: 'Plain-English beta blockers backed by live repo, BUILD-LOG, and PROJECT.md',
    mission: 'Make Self-e-Tape the most successful self-tape app in the market: the best product for actors, with the strongest revenue, market share, and awareness.',
    betaStatus: {
      label: 'Not beta-ready',
      body: 'The app can prove pieces of the workflow, but actors cannot trust it yet because the script import, AI reader timing/reliability, and final exported sound are not good enough.',
    },
    warnings,
    betaBlockers: [
      {
        id: 'parser',
        title: 'Sides Parser',
        goal: 'Sides import cleanly enough that actors trust the script.',
        currentTruth: 'Not good enough yet. Real audition sides still produce missing, merged, or contaminated lines, so an actor could rehearse or record from the wrong text.',
        whyItBlocksBeta: 'If the script is wrong, the product breaks before recording starts.',
        nextAction: parserPacket.confirmed === 0 ? `Use Packet 002 review forms: ${parserPacket.total} cases selected, ${parserPacket.confirmed} confirmed, ${parserPacket.needsTruth} still need truth, ${parserPacket.blockedNoText} blocked by no text.` : 'Promote confirmed truth into parser regression fixtures, then fix parser against those fixtures.',
        status: parserPacket.confirmed > 0 ? 'in_progress' as const : 'waiting' as const,
        proofLevel: `Local parser lab: ${parserPacket.total} real-side cases selected, ${parserPacket.confirmed} confirmed, ${parserPacket.regressionReady} regression-ready. Human truth required before parser fixes.`,
        reports: [
          { label: 'Parser research ledger', path: 'reports/research/parser/CURRENT-RESEARCH.md', note: 'External/internal research that every parser agent must read first.' },
          { label: 'Parser questions', path: 'reports/research/parser/RESEARCH-QUESTIONS.md', note: 'Open research questions and unknowns.' },
          { label: 'Do not repeat', path: 'reports/research/parser/TRIED-AND-FAILED.md', note: 'Rejected approaches and stale assumptions.' },
          { label: 'Project truth', path: 'PROJECT.md', note: 'Current parser risks and release boundary.' },
          { label: 'Human review packet', path: parserPacket.reviewPacketPath, note: 'Readable Packet 002 review sheets.' },
          { label: 'Truth status report', path: parserPacket.statusPath, note: `${parserPacket.confirmed}/${parserPacket.total} confirmed; ${parserPacket.regressionReady} regression-ready.` },
          { label: 'Fillable P0 forms', path: parserPacket.fillableFormsPath, note: 'First three P0 cases prepared for structured truth capture.' },
        ],
      },
      {
        id: 'ai-reader',
        title: 'AI Reader',
        goal: 'Voice plays reliably, timing feels natural, does not cut off the actor, and does not leave dead air.',
        currentTruth: 'Still not reliable. Build 301 crashed before yielding a proof package; Build 300 preserved a clean reader file but Philip did not hear the AI voice. Scheduling evidence is not the same as heard audio.',
        whyItBlocksBeta: 'The whole promise is a dependable reader. If the reader misses, lags, cuts off, or feels unnatural, actors cannot use it.',
        nextAction: 'No Build 302. Continue local crash-proof/RCA and split proof into playback-only, capture-only, playback+during-capture, and route/session evidence so we know exactly where the reader fails.',
        status: 'blocked' as const,
        proofLevel: 'Device truth required; source/log proof alone is insufficient.',
        reports: [
          { label: 'AI Reader research ledger', path: 'reports/research/ai-reader/CURRENT-RESEARCH.md', note: 'External research and current evidence for reader reliability/timing.' },
          { label: 'AI Reader questions', path: 'reports/research/ai-reader/RESEARCH-QUESTIONS.md', note: 'Open research questions around iPhone audio, AEC, and timing.' },
          { label: 'Do not repeat', path: 'reports/research/ai-reader/TRIED-AND-FAILED.md', note: 'Rejected approaches and stale assumptions.' },
          { label: 'Build 301 failure RCA', path: 'BUILD-301-FAILURE-RCA-2026-05-07.md', note: 'Build 301 crashed three times; exact crash stack unavailable.' },
          { label: 'Non-Xcode evidence plan', path: 'NON-XCODE-DEVICE-EVIDENCE-PLAN.md', note: 'Crash/device evidence without asking Philip to use Xcode.' },
        ],
      },
      {
        id: 'sound-export',
        title: 'Final Sound / Export',
        goal: 'Final takes sound amazing: clean actor, usable reader, no static, bleed, harshness, or weird gaps.',
        currentTruth: 'Horrendous / unproven right now. Build 297 exported media confirmed actor was buried/static-like, Build 300 artifact gates failed downstream, and Build 301 crashed before yielding media.',
        whyItBlocksBeta: 'A self-tape app lives or dies on final submitted media. If the export sounds bad, nothing else matters.',
        nextAction: 'No Build 302. First keep Artifact Proof crash-safe, then fix/prove the first failing audio layer before final mix/export tuning.',
        status: 'blocked' as const,
        proofLevel: 'Received device artifacts proved failure; next proof must isolate the bad layer.',
        reports: [
          { label: 'Sound/export research ledger', path: 'reports/research/final-sound-export/CURRENT-RESEARCH.md', note: 'External research and current evidence for capture/final media quality.' },
          { label: 'Sound/export questions', path: 'reports/research/final-sound-export/RESEARCH-QUESTIONS.md', note: 'Open research questions around capture format, static, and final mix.' },
          { label: 'Do not repeat', path: 'reports/research/final-sound-export/TRIED-AND-FAILED.md', note: 'Rejected approaches and stale assumptions.' },
          { label: 'Build 301 failure RCA', path: 'BUILD-301-FAILURE-RCA-2026-05-07.md', note: 'Build 301 failed before a ZIP/media package was received.' },
          { label: 'Artifact gates', path: 'artifacts/record-audition-audio-gates/latest/', note: 'Verifier and received ZIP analysis live under artifact gates.' },
        ],
      },
    ],
    workstreams: [
      {
        id: 'parser',
        title: 'Sides Parser',
        status: parserPacket.confirmed > 0 ? 'in_progress' as const : 'waiting' as const,
        owner: 'Mildred + Philip truth review',
        currentTruth: `${parserPacket.total} real-side review cases selected; ${parserPacket.confirmed} confirmed; ${parserPacket.needsTruth} need truth; ${parserPacket.blockedNoText} blocked by no text.`,
        nextSafeAction: 'Fill/confirm the first P0 truth forms from the original PDFs, then promote confirmed truth into regression fixtures.',
        proofRequired: 'CONFIRMED_TRUTH annotations plus passing parser regression fixtures. No parser fix from baseline output alone.',
        latestReport: parserWorkstream.currentPacket ?? 'Parser workstream packet not found',
        evidencePaths: [
          { label: 'Human review packet', path: parserPacket.reviewPacketPath },
          { label: 'Truth status report', path: parserPacket.statusPath },
          { label: 'Fillable forms', path: parserPacket.fillableFormsPath },
          { label: 'Parser current packet', path: 'workstreams/parser/CURRENT-PACKET.md' },
        ],
      },
      {
        id: 'ai-reader',
        title: 'AI Reader',
        status: 'blocked' as const,
        owner: 'Mildred / future native-audio packet',
        currentTruth: 'Build 301 crashed before yielding a package; Build 300 preserved a clean reader source but Philip did not hear AI voice in Artifact Proof; scheduling evidence is not audibility proof.',
        nextSafeAction: 'Continue local crash-proof/RCA and source-side phase proof design only; no phone/build ask without explicit diagnostic scope.',
        proofRequired: 'Device proof separating playback-only, capture-only, playback+during-capture, and route/session evidence.',
        latestReport: aiReaderWorkstream.currentPacket ?? 'AI Reader workstream packet not yet active',
        evidencePaths: [
          { label: 'AI reader research', path: 'reports/research/ai-reader/CURRENT-RESEARCH.md' },
          { label: 'Build log', path: 'BUILD-LOG.md' },
        ],
      },
      {
        id: 'sound-export',
        title: 'Final Sound / Export',
        status: 'blocked' as const,
        owner: 'Mildred / future audio-proof packet',
        currentTruth: 'Build 300 received artifacts showed direct AudioEngine capture failure; Build 301 crashed before yielding new artifacts, so the current phase is crash-proof/RCA before more audio claims.',
        nextSafeAction: 'Keep Artifact Proof fail-closed first; then fix first failing capture layer before final mix/export tuning.',
        proofRequired: 'Clean direct capture WAV, clean merged actor track, clean final output from real device artifacts.',
        latestReport: soundWorkstream.currentPacket ?? 'Final sound/export workstream packet not yet active',
        evidencePaths: [
          { label: 'Sound/export research', path: 'reports/research/final-sound-export/CURRENT-RESEARCH.md' },
          { label: 'Artifact gates', path: 'artifacts/record-audition-audio-gates/latest/' },
        ],
      },
    ],
    secondaryAreas: [
      { title: 'Project setup / import flow', status: 'needs_work' as const, note: 'Important, but not the current top blocker.' },
      { title: 'Script review and editing', status: 'needs_work' as const, note: 'Depends heavily on parser trust.' },
      { title: 'Voice selection', status: 'needs_work' as const, note: 'Usable only after reader reliability is proven.' },
      { title: 'Rehearsal mode', status: 'unknown' as const, note: 'Should share the same reader/timing foundation as Record Audition.' },
      { title: 'Review takes / PostTake', status: 'needs_work' as const, note: 'Cannot be trusted until processed media is good.' },
      { title: 'Save/share/export UX', status: 'needs_work' as const, note: 'Needs deterministic, visible export proof; Build 299 exposed email handoff risk.' },
    ],
    reports: [
      { label: 'BUILD-LOG.md', path: 'BUILD-LOG.md', note: 'Chronological build/device/proof history.' },
      { label: 'PROJECT.md', path: 'PROJECT.md', note: 'Current source truth, decisions, and release boundaries.' },
      { label: 'Research ledger', path: 'reports/research/README.md', note: 'Required research preflight for every blocker agent.' },
      { label: 'Artifact gates', path: 'artifacts/record-audition-audio-gates/latest/', note: 'Proof ZIPs, verifier reports, and audio metrics.' },
    ],
    sections: [
      {
        title: 'Current source edge',
        status: dirty ? 'yellow' as const : 'green' as const,
        body: `${branch ?? 'unknown'} @ ${head ?? 'unknown'} · build ${buildNumber ?? 'unknown'} · ${dirty ? 'dirty' : 'clean'}`,
        evidence: recentCommits[0] ? `${recentCommits[0].sha} — ${recentCommits[0].message}` : undefined,
        nextAction: 'Keep source work local until a narrow build is explicitly approved.',
      },
      {
        title: 'Latest proof edge',
        status: 'red' as const,
        body: latestAttempt ? `Latest build log item: Build ${latestAttempt.build} — ${latestAttempt.status}. Build 300 proved ZIP receipt/verification, but not audio quality or AI audibility.` : 'No current build attempt parsed from BUILD-LOG.',
        evidence: buildLogSummary.artifactProofSignals.join(' · ') || buildLogSummary.latestBuild?.title,
        nextAction: 'Use phase-split proof evidence before any further device ask.',
      },
      {
        title: 'Hidden stale database tasks',
        status: 'yellow' as const,
        body: 'Old manually-entered Build 93-era tasks are hidden because they are stale and misleading.',
        evidence: activeItems.length > 0 ? `${activeItems.length} legacy database item${activeItems.length === 1 ? '' : 's'} suppressed from cockpit display.` : 'No legacy task noise currently present.',
        nextAction: 'Replace manual stale tasks with generated work packets from Telegram, agent sessions, build/proof events, and reports.',
      },
      {
        title: 'Freshness',
        status: 'green' as const,
        body: `Checked live now. BUILD-LOG touched ${buildLogTouched ? new Date(buildLogTouched).toLocaleString() : 'unknown'}; PROJECT.md touched ${projectTouched ? new Date(projectTouched).toLocaleString() : 'unknown'}.`,
        evidence: 'Live repo/docs check, not old hardcoded Ops copy.',
      },
    ],
    links: [project.repo_url ? { label: 'Repo', href: project.repo_url } : null, project.live_url ? { label: 'Live site', href: project.live_url } : null].filter(Boolean),
  };
}

app.get('/api/projects', (_req, res) => {
  const projects = db.prepare<ProjectRow & { open_work_items_count: number; work_items_count: number }>(`
    SELECT p.*,
      COALESCE(SUM(CASE WHEN wi.status != 'done' THEN 1 ELSE 0 END), 0) AS open_work_items_count,
      COUNT(wi.id) AS work_items_count
    FROM projects p
    LEFT JOIN work_items wi ON wi.project_id = p.id
    GROUP BY p.id
    ORDER BY
      CASE p.id
        WHEN 'selftape' THEN 0
        WHEN 'command-center' THEN 1
        WHEN 'hawco-crm' THEN 2
        WHEN 'coverageiq' THEN 3
        ELSE 50
      END,
      p.name ASC
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
  const accessToken = process.env.SELFTAPE_SUPABASE_ACCESS_TOKEN
    ?? process.env.SUPABASE_ACCESS_TOKEN
    ?? readKeychainSecret('command-center/selftape/supabase-access-token');
  const url = process.env.SELFTAPE_SUPABASE_URL
    ?? process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? (projectRef ? `https://${projectRef}.supabase.co` : null);
  const directAuthKey = serviceRoleKey ?? anonKey ?? null;
  return { selfTapePath, projectRef, url, directAuthKey, accessToken, usingServiceRole: Boolean(serviceRoleKey) };
}

function readOptionalText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function readKeychainSecret(account: string) {
  if (process.platform !== 'darwin') return null;
  const result = spawnSync('security', ['find-generic-password', '-s', 'openclaw', '-a', account, '-w'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function writeKeychainSecret(account: string, secret: string) {
  if (process.platform !== 'darwin') throw new Error('Keychain storage is only available on macOS');
  const result = spawnSync('security', ['add-generic-password', '-U', '-s', 'openclaw', '-a', account, '-w', secret], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to write secret to macOS Keychain');
  }
}

function maskSecret(secret: string | null) {
  if (!secret) return null;
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

async function resolveSelfTapeRestAuthKey(config: ReturnType<typeof getSelfTapeSupabaseConfig>) {
  if (config.directAuthKey) {
    return { authKey: config.directAuthKey, source: config.usingServiceRole ? 'service-role-env' : 'anon-env', note: null as string | null };
  }
  if (!config.projectRef || !config.accessToken) {
    return { authKey: null, source: 'unconfigured', note: null as string | null };
  }

  try {
    const endpoint = `https://api.supabase.com/v1/projects/${config.projectRef}/api-keys`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!response.ok) {
      const body = await response.text();
      return { authKey: null, source: 'management-token', note: `Supabase Management API key lookup failed: ${response.status} ${body.slice(0, 160)}` };
    }
    const keys = await response.json() as Array<{ name?: string; api_key?: string; key?: string }>;
    const serviceKey = keys.find((key) => /service_role|service role|secret/i.test(key.name ?? ''));
    const anonKey = keys.find((key) => /anon|publishable/i.test(key.name ?? ''));
    const selected = serviceKey ?? anonKey;
    const apiKey = selected?.api_key ?? selected?.key ?? null;
    return {
      authKey: apiKey,
      source: serviceKey ? 'management-token/service-role' : 'management-token/anon',
      note: apiKey ? null : 'Supabase Management API returned no usable REST key.',
    };
  } catch (error) {
    return { authKey: null, source: 'management-token', note: error instanceof Error ? error.message : String(error) };
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
    lastEventAt: null,
    readiness: 'no-events' as const,
    recommendation: 'No diagnostic events are visible yet. This can mean Build 279 has not been tested, telemetry is not configured, or no failures have occurred.',
  };
}

function sanitizeDiagnosticEvent(event: DiagnosticEventRow): SafeDiagnosticEventRow {
  return {
    id: event.id,
    created_at: event.created_at,
    event_type: event.event_type,
    severity: event.severity,
    flow: event.flow,
    screen: event.screen,
    error_code: event.error_code,
    message: event.message,
    app_platform: event.app_platform,
    app_version: event.app_version,
    build_number: event.build_number,
    os_version: event.os_version,
  };
}

function summarizeDiagnosticEvents(events: SafeDiagnosticEventRow[]) {
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

    if (!summary.lastEventAt || event.created_at > summary.lastEventAt) summary.lastEventAt = event.created_at;
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

  if (summary.critical > 0 || summary.error > 0) {
    summary.readiness = 'investigate';
    summary.recommendation = 'Investigate diagnostic failures before treating Build 279 as a trust pass.';
  } else if (summary.warning > 0) {
    summary.readiness = 'watch';
    summary.recommendation = 'Warnings are present. Continue the device script, but review patterns before the next build decision.';
  } else if (summary.total > 0) {
    summary.readiness = 'quiet';
    summary.recommendation = 'Telemetry is arriving and no warning/error events are visible in the current sample.';
  }
  return summary;
}

async function fetchDiagnosticEvents(limit: number): Promise<DiagnosticEventsResponse> {
  const checkedAt = Date.now();
  const config = getSelfTapeSupabaseConfig();
  const resolvedAuth = await resolveSelfTapeRestAuthKey(config);
  if (!config.url || !resolvedAuth.authKey) {
    return {
      configured: false,
      source: config.url ?? 'unconfigured',
      checkedAt,
      events: [],
      summary: emptyDiagnosticSummary(),
      error: resolvedAuth.note ?? 'Set SELFTAPE_SUPABASE_SERVICE_ROLE_KEY, SELFTAPE_SUPABASE_ANON_KEY, or a server-only SELFTAPE_SUPABASE_ACCESS_TOKEN to read diagnostic events.',
    };
  }

  const endpoint = new URL('/rest/v1/diagnostic_events', config.url);
  endpoint.searchParams.set('select', 'id,created_at,user_id,event_type,severity,flow,screen,project_id,scene_id,take_id,error_code,message,app_platform,app_version,build_number,device_name,os_version,metadata');
  endpoint.searchParams.set('order', 'created_at.desc');
  endpoint.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: resolvedAuth.authKey,
        Authorization: `Bearer ${resolvedAuth.authKey}`,
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
    const rawEvents = await response.json() as DiagnosticEventRow[];
    const events = rawEvents.map(sanitizeDiagnosticEvent);
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


app.get('/api/protected-work', (_req, res) => {
  try {
    res.json(parseProtectedWorkLog());
  } catch (error) {
    console.error('Failed to parse protected work log', error);
    res.status(500).json({ error: 'Failed to parse protected work log' });
  }
});

app.get('/api/selftape/status', async (_req, res) => {
  const sourcePath = '/Users/mildred/.openclaw/workspace/projects/SelfTapeApp';
  const branch = safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], sourcePath);
  const head = safeExec('git', ['rev-parse', '--short', 'HEAD'], sourcePath);
  const status = safeExec('git', ['status', '--short'], sourcePath);
  const dirty = Boolean(status?.trim());
  const buildNumber = readBuildNumber(path.join(sourcePath, 'app.json'));
  const buildAttempts = readBuildAttempts(path.join(sourcePath, 'BUILD-LOG.md'));
  const easIncident = await readExpoIncident();
  const latestAttempt = buildAttempts[buildAttempts.length - 1];
  const recommendedAction = easIncident.active
    ? 'Expo/EAS incident active: hold build/deploy actions and monitor.'
    : dirty
      ? 'Clean or commit the SelfTape working tree before any build/release decision.'
      : latestAttempt?.build === '279'
        ? 'Build 279 is submitted. Wait for TestFlight availability, then run the focused device test: first AI cue audible/no Reader playback failed.'
        : 'No current submitted trust-gate build found. Prepare one monitored production iOS build only with explicit approval.';

  const appleProcessing = {
    build: latestAttempt?.build ?? buildNumber ?? 'unknown',
    status: latestAttempt?.status?.toLowerCase().includes('submitted') ? 'processing' : 'unknown',
    testFlightUrl: 'https://appstoreconnect.apple.com/apps/6759764430/testflight/ios',
    submittedAt: null,
  };

  res.json({ branch, head, dirty, buildNumber, appleProcessing, easIncident, buildAttempts, recommendedAction, sourcePath });
});

app.get('/api/selftape/diagnostics', async (req, res) => {
  const limitParam = Number(req.query.limit ?? 80);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 250) : 80;
  const diagnostics = await fetchDiagnosticEvents(limit);
  res.json(diagnostics);
});

app.post('/api/selftape/diagnostics/access-token', (req, res) => {
  const remoteAddress = req.socket.remoteAddress;
  const isLocalRequest = !remoteAddress || remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
  if (!isLocalRequest || process.env.ENABLE_SELFTAPE_TOKEN_WRITE !== '1') {
    res.status(403).json({ ok: false, error: 'Token storage is disabled unless explicitly enabled for localhost.' });
    return;
  }
  const { token } = req.body as { token?: string };
  if (!token || !token.startsWith('sbp_')) {
    res.status(400).json({ ok: false, error: 'Expected a Supabase personal access token.' });
    return;
  }
  try {
    writeKeychainSecret('command-center/selftape/supabase-access-token', token);
    res.json({ ok: true, stored: 'macos-keychain', token: maskSecret(token) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
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
  const now = Date.now();
  const agents = db.prepare<OfficeAgentRow>('SELECT * FROM office_agents WHERE office_enabled = 1').all().map((agent) => {
    const live = liveAgentActivity.get(agent.id);
    if (live && now - live.lastSeen < LIVE_AGENT_ACTIVITY_TTL_MS) {
      return { ...agent, state: live.officeState, current_task: live.taskLabel };
    }

    const gatewayState = gateway?.isConnected() ? gateway.getAgentState(agent.id) : undefined;
    if (gatewayState) {
      const officeState = mapVisualStatusToOffice(gatewayState.status);
      const taskLabel = gatewayState.currentTool
        ? `Using ${gatewayState.currentTool}`
        : gatewayState.lastMessage && officeState !== 'idle'
          ? gatewayState.lastMessage.slice(0, 80)
          : null;
      return { ...agent, state: officeState, current_task: taskLabel };
    }

    const currentTask = AGENT_IDLE_TASK_LABELS.has(agent.current_task ?? '') ? null : agent.current_task;
    return { ...agent, current_task: agent.state === 'idle' ? null : currentTask };
  });
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

wss.on('connection', (ws, req) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : Array.isArray(req.headers['x-command-center-token'])
      ? req.headers['x-command-center-token'][0]
      : req.headers['x-command-center-token'];
  const proxyEmailHeader = req.headers['cf-access-authenticated-user-email']
    ?? req.headers['x-authentik-email']
    ?? req.headers['x-forwarded-email'];
  const proxyEmail = Array.isArray(proxyEmailHeader) ? proxyEmailHeader[0] : proxyEmailHeader;
  const isLocalWs = !REQUIRE_AUTH && process.env.NODE_ENV !== 'production';
  const authorized = isLocalWs
    || (Boolean(COMMAND_CENTER_AUTH_TOKEN) && token === COMMAND_CENTER_AUTH_TOKEN)
    || isAllowedAuthenticatedEmail(proxyEmail);
  if (!authorized) {
    ws.close(1008, 'Unauthorized');
    return;
  }

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
    const rawTaskLabel = parsed.tool
      ? `Using ${parsed.tool}`
      : parsed.summary.length > 60
        ? parsed.summary.slice(0, 60) + '...'
        : parsed.summary || null;
    const taskLabel = officeState === 'idle' || rawTaskLabel === 'Run ended' ? null : rawTaskLabel;

    liveAgentActivity.set(parsed.agentId, { officeState, taskLabel, lastSeen: now });

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
  console.log(`Auth: ${REQUIRE_AUTH ? 'required' : 'disabled/local-dev'}`);
  console.log(`Allowed proxy emails: ${COMMAND_CENTER_AUTH_EMAILS.length}`);
  console.log(`High-risk actions: ${ENABLE_HIGH_RISK_ACTIONS ? 'enabled' : 'disabled'}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Upload dir: ${UPLOAD_DIR}`);
  console.log(`GitHub: ${octokit ? 'enabled' : 'disabled'}`);
  console.log(`Gateway: ${gatewayToken ? 'token loaded, connecting...' : 'no token, skipping'}`);
  initGateway();
});

export { app, db };
