import express from 'express';
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
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// File upload setup
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'text/plain', 'text/log', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// SQLite database setup
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Create tables
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
    deadline INTEGER,
    blocker_reason TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    promise_date TEXT,
    delivery_notes TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
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

`);

// Add missing columns if they exist (migration)
try { db.exec(`ALTER TABLE tasks ADD COLUMN deadline INTEGER`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN blocker_reason TEXT`); } catch {}
try { db.exec(`ALTER TABLE agents ADD COLUMN current_task_id TEXT`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN promise_date TEXT`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN delivery_notes TEXT`); } catch {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN lane_id TEXT`); } catch {}

// Initialize status row
db.exec(`INSERT OR IGNORE INTO status (id, gateway_connected, last_update) VALUES (1, 0, 0)`);

// Seed default agents
const defaultAgents = [
  { id: 'mildred', name: 'Mildred (Main Agent)' },
  { id: 'dev', name: 'Dev (Coding Agent)' },
  { id: 'content-agent', name: 'Content Agent (Future)' },
  { id: 'research-agent', name: 'Research Agent (Future)' },
];

const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agents (id, name, status, last_seen)
  VALUES (?, ?, 'idle', NULL)
`);
defaultAgents.forEach(agent => insertAgent.run(agent.id, agent.name));

// Seed default lanes
const defaultLanes = [
  { id: 'hawco', name: 'Hawco Development', color: '#3b82f6', description: 'Hawco CRM and development projects' },
  { id: 'company-theatre', name: 'Company Theatre', color: '#f59e0b', description: 'Company Theatre website and CRM' },
  { id: 'selfe-tape', name: 'Self-e-Tape', color: '#10b981', description: 'Self-e-Tape app development' },
  { id: 'personal', name: 'Personal', color: '#a855f7', description: 'Personal projects and tasks' },
];

const insertLane = db.prepare(`
  INSERT OR IGNORE INTO lanes (id, name, color, description)
  VALUES (?, ?, ?, ?)
`);
defaultLanes.forEach(lane => insertLane.run(lane.id, lane.name, lane.color, lane.description));


// Seed default office agents
const officeDefaultAgents = [
  { id: 'mildred', name: 'Mildred', position_x: 18, position_y: 4, state: 'idle', color: '#008080' },
  { id: 'dev', name: 'Dev', position_x: 3, position_y: 4, state: 'idle', color: '#808080' },
  { id: 'content', name: 'Content', position_x: 3, position_y: 12, state: 'idle', color: '#800080' },
  { id: 'research', name: 'Research', position_x: 18, position_y: 12, state: 'idle', color: '#8B4513' },
];

const insertOfficeAgent = db.prepare(`
  INSERT OR IGNORE INTO office_agents (id, name, position_x, position_y, state, color, office_enabled)
  VALUES (?, ?, ?, ?, ?, ?, 1)
`);
officeDefaultAgents.forEach(agent => insertOfficeAgent.run(agent.id, agent.name, agent.position_x, agent.position_y, agent.state, agent.color));

// GitHub Octokit (read-only, uses token from env)
const octokit = process.env.GITHUB_TOKEN ? new Octokit({ auth: process.env.GITHUB_TOKEN }) : null;

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/agents', (_req, res) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY name').all();
  res.json(agents);
});

app.get('/api/tasks', (_req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks);
});

app.get('/api/status', (_req, res) => {
  const status = db.prepare('SELECT * FROM status WHERE id = 1').get();
  res.json(status);
});

// Task CRUD
app.post('/api/tasks', (req, res) => {
  const { title, description, status, agent_id, deadline, promise_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO tasks (id, title, description, status, agent_id, deadline, promise_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || '', status || 'backlog', agent_id || null, deadline || null, promise_date || null, now, now);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_created', data: task });
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, status, agent_id, deadline, blocker_reason, promise_date, delivery_notes } = req.body;
  const now = Date.now();
  
  db.prepare(`
    UPDATE tasks 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        agent_id = ?,
        deadline = ?,
        blocker_reason = ?,
        promise_date = ?,
        delivery_notes = ?,
        updated_at = ?
    WHERE id = ?
  `).run(title, description, status, agent_id, deadline, blocker_reason, promise_date, delivery_notes, now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_updated', data: task });
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const evidence = db.prepare('SELECT filename FROM evidence WHERE task_id = ?').all(id);
  evidence.forEach((e: any) => { try { fs.unlinkSync(path.join(uploadsDir, e.filename)); } catch {} });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  broadcastUpdate({ type: 'task_deleted', data: { id } });
  res.status(204).send();
});

app.post('/api/tasks/:id/assign', (req, res) => {
  const { id } = req.params;
  const { agent_id } = req.body;
  const now = Date.now();
  db.prepare('UPDATE tasks SET agent_id = ?, updated_at = ? WHERE id = ?').run(agent_id, now, id);
  db.prepare('UPDATE agents SET current_task_id = ? WHERE id = ?').run(id, agent_id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_assigned', data: task });
  res.json(task);
});

app.post('/api/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const now = Date.now();
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_moved', data: task });
  res.json(task);
});

// ========== Evidence ==========
app.get('/api/tasks/:id/evidence', (req, res) => {
  const evidence = db.prepare('SELECT * FROM evidence WHERE task_id = ? ORDER BY uploaded_at DESC').all(req.params.id);
  res.json(evidence);
});

app.post('/api/tasks/:id/evidence', upload.single('file'), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const evidenceId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO evidence (id, task_id, filename, original_name, mime_type, size, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, Date.now());
  
  const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  broadcastUpdate({ type: 'evidence_uploaded', data: evidence });
  res.status(201).json(evidence);
});

app.get('/api/evidence/:id/download', (req, res) => {
  const evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(req.params.id);
  if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
  const filePath = path.join(uploadsDir, (evidence as any).filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', (evidence as any).mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${(evidence as any).original_name}"`);
  res.sendFile(filePath);
});

app.delete('/api/evidence/:id', (req, res) => {
  const evidence = db.prepare('SELECT filename FROM evidence WHERE id = ?').get(req.params.id) as any;
  if (evidence) { try { fs.unlinkSync(path.join(uploadsDir, evidence.filename)); } catch {} }
  db.prepare('DELETE FROM evidence WHERE id = ?').run(req.params.id);
  broadcastUpdate({ type: 'evidence_deleted', data: { id: req.params.id } });
  res.status(204).send();
});

// ========== Approvals ==========
app.get('/api/tasks/:id/approvals', (req, res) => {
  const approvals = db.prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY decided_at DESC').all(req.params.id);
  res.json(approvals);
});

app.post('/api/tasks/:id/approve', (req, res) => {
  const { id } = req.params;
  const { notes, decided_by } = req.body;
  const now = Date.now();
  const approvalId = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  db.prepare(`INSERT INTO approvals (id, task_id, decision, notes, decided_by, decided_at) VALUES (?, ?, 'approve', ?, ?, ?)`)
    .run(approvalId, id, notes || null, decided_by || 'philip', now);
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('complete', now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  broadcastUpdate({ type: 'task_approved', data: { task, approval } });
  res.json(approval);
});

app.post('/api/tasks/:id/request-changes', (req, res) => {
  const { id } = req.params;
  const { notes, decided_by } = req.body;
  const now = Date.now();
  const approvalId = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  db.prepare(`INSERT INTO approvals (id, task_id, decision, notes, decided_by, decided_at) VALUES (?, ?, 'request_changes', ?, ?, ?)`)
    .run(approvalId, id, notes || null, decided_by || 'philip', now);
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('in_progress', now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  broadcastUpdate({ type: 'changes_requested', data: { task, approval } });
  res.json(approval);
});

app.post('/api/tasks/:id/send-back', (req, res) => {
  const { id } = req.params;
  const { notes, decided_by } = req.body;
  const now = Date.now();
  const approvalId = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  db.prepare(`INSERT INTO approvals (id, task_id, decision, notes, decided_by, decided_at) VALUES (?, ?, 'send_back', ?, ?, ?)`)
    .run(approvalId, id, notes || null, decided_by || 'philip', now);
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('backlog', now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  broadcastUpdate({ type: 'task_sent_back', data: { task, approval } });
  res.json(approval);
});

// ========== PR Tracking ==========
app.get('/api/tasks/:id/pr', (req, res) => {
  const prs = db.prepare('SELECT * FROM pr_tracking WHERE task_id = ? ORDER BY last_checked DESC').all(req.params.id);
  res.json(prs);
});

app.post('/api/tasks/:id/pr', async (req, res) => {
  const { id } = req.params;
  const { pr_url, pr_number, owner, repo } = req.body;
  let prNum = pr_number;
  if (!prNum && pr_url) {
    const match = pr_url.match(/\/pull\/(\d+)/);
    if (match) prNum = parseInt(match[1], 10);
  }
  if (!prNum) return res.status(400).json({ error: 'PR number or URL required' });
  
  const now = Date.now();
  let prStatus = 'open', ciStatus = 'unknown';
  
  if (octokit && owner && repo) {
    try {
      const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNum });
      prStatus = pr.merged_at ? 'merged' : pr.state;
      try {
        const { data: checks } = await octokit.rest.checks.listForRef({ owner, repo, ref: pr.head.sha });
        const conclusion = checks.check_runs[0]?.conclusion;
        if (conclusion === 'success') ciStatus = 'passing';
        else if (conclusion === 'failure') ciStatus = 'failing';
        else ciStatus = 'pending';
      } catch { ciStatus = 'unknown'; }
    } catch {}
  }
  
  const prId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`INSERT INTO pr_tracking (id, task_id, pr_number, pr_url, status, ci_status, last_checked) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(prId, id, prNum, pr_url, prStatus, ciStatus, now);
  
  const pr = db.prepare('SELECT * FROM pr_tracking WHERE id = ?').get(prId);
  broadcastUpdate({ type: 'pr_linked', data: pr });
  res.status(201).json(pr);
});

app.post('/api/tasks/:id/pr/refresh', async (req, res) => {
  const { id } = req.params;
  const { owner, repo } = req.body;
  const now = Date.now();
  const prs = db.prepare('SELECT * FROM pr_tracking WHERE task_id = ?').all(id) as any[];
  
  if (!octokit || !owner || !repo) return res.json(prs);
  
  const updated = await Promise.all(prs.map(async (pr) => {
    try {
      const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pr.pr_number });
      const status = data.merged_at ? 'merged' : data.state;
      let ciStatus = 'unknown';
      try {
        const { data: checks } = await octokit.rest.checks.listForRef({ owner, repo, ref: data.head.sha });
        ciStatus = checks.check_runs[0]?.conclusion === 'success' ? 'passing' : checks.check_runs[0]?.conclusion === 'failure' ? 'failing' : 'pending';
      } catch {}
      db.prepare('UPDATE pr_tracking SET status = ?, ci_status = ?, last_checked = ? WHERE id = ?').run(status, ciStatus, now, pr.id);
      return { ...pr, status, ci_status: ciStatus, last_checked: now };
    } catch { return pr; }
  }));
  
  broadcastUpdate({ type: 'pr_refreshed', data: updated });
  res.json(updated);
});

app.delete('/api/pr/:id', (req, res) => {
  db.prepare('DELETE FROM pr_tracking WHERE id = ?').run(req.params.id);
  broadcastUpdate({ type: 'pr_unlinked', data: { id: req.params.id } });
  res.status(204).send();
});

// History
app.get('/api/tasks/:id/history', (req, res) => {
  const { id } = req.params;
  res.json({
    approvals: db.prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY decided_at DESC').all(id),
    prs: db.prepare('SELECT * FROM pr_tracking WHERE task_id = ? ORDER BY last_checked DESC').all(id),
    evidence: db.prepare('SELECT * FROM evidence WHERE task_id = ? ORDER BY uploaded_at DESC').all(id),
  });
});

// ========== Lanes ==========
app.get('/api/lanes', (_req, res) => {
  const lanes = db.prepare('SELECT * FROM lanes ORDER BY name').all();
  res.json(lanes);
});

app.post('/api/lanes', (req, res) => {
  const { id, name, color, description } = req.body;
  if (!id || !name || !color) return res.status(400).json({ error: 'id, name, and color are required' });
  
  const now = Date.now();
  db.prepare(`INSERT INTO lanes (id, name, color, description, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name, color, description || '', now);
  
  const lane = db.prepare('SELECT * FROM lanes WHERE id = ?').get(id);
  broadcastUpdate({ type: 'lane_created', data: lane });
  res.status(201).json(lane);
});

app.put('/api/lanes/:id', (req, res) => {
  const { id } = req.params;
  const { name, color, description } = req.body;
  
  db.prepare(`UPDATE lanes SET name = COALESCE(?, name), color = COALESCE(?, color), description = COALESCE(?, description) WHERE id = ?`)
    .run(name, color, description, id);
  
  const lane = db.prepare('SELECT * FROM lanes WHERE id = ?').get(id);
  broadcastUpdate({ type: 'lane_updated', data: lane });
  res.json(lane);
});

app.delete('/api/lanes/:id', (req, res) => {
  const { id } = req.params;
  // Unassign tasks from this lane
  db.prepare('UPDATE tasks SET lane_id = NULL WHERE lane_id = ?').run(id);
  db.prepare('DELETE FROM lanes WHERE id = ?').run(id);
  broadcastUpdate({ type: 'lane_deleted', data: { id } });
  res.status(204).send();
});

// ========== Task Costs ==========
app.get('/api/task-costs', (_req, res) => {
  const costs = db.prepare('SELECT tc.*, t.title as task_title FROM task_costs tc LEFT JOIN tasks t ON tc.task_id = t.id ORDER BY tc.recorded_at DESC').all();
  res.json(costs);
});

app.get('/api/task-costs/summary', (req, res) => {
  const { lane_id, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      tc.*, 
      t.title as task_title, 
      t.lane_id,
      l.name as lane_name,
      l.color as lane_color
    FROM task_costs tc 
    LEFT JOIN tasks t ON tc.task_id = t.id 
    LEFT JOIN lanes l ON t.lane_id = l.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (lane_id) {
    query += ' AND t.lane_id = ?';
    params.push(lane_id);
  }
  if (start_date) {
    query += ' AND tc.recorded_at >= ?';
    params.push(parseInt(start_date as string));
  }
  if (end_date) {
    query += ' AND tc.recorded_at <= ?';
    params.push(parseInt(end_date as string));
  }
  
  query += ' ORDER BY tc.recorded_at DESC';
  
  const costs = db.prepare(query).all(...params);
  
  // Calculate totals
  const totals = costs.reduce((acc: any, c: any) => {
    acc.tokens += c.tokens_used || 0;
    acc.estimated += c.estimated_cost || 0;
    acc.actual += c.actual_cost || 0;
    return acc;
  }, { tokens: 0, estimated: 0, actual: 0 });
  
  res.json({ costs, totals });
});

app.post('/api/task-costs', (req, res) => {
  const { task_id, tokens_used, estimated_cost, actual_cost } = req.body;
  if (!task_id) return res.status(400).json({ error: 'task_id is required' });
  
  const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO task_costs (id, task_id, tokens_used, estimated_cost, actual_cost, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, task_id, tokens_used || 0, estimated_cost || 0, actual_cost || 0, now);
  
  const cost = db.prepare('SELECT * FROM task_costs WHERE id = ?').get(id);
  broadcastUpdate({ type: 'cost_recorded', data: cost });
  res.status(201).json(cost);
});

// ========== Weekly Summaries ==========
app.get('/api/weekly-summaries', (req, res) => {
  const { week_start } = req.query;
  if (week_start) {
    const summary = db.prepare('SELECT * FROM weekly_summaries WHERE week_start = ?').get(week_start);
    return res.json(summary || null);
  }
  const summaries = db.prepare('SELECT * FROM weekly_summaries ORDER BY week_start DESC LIMIT 10').all();
  res.json(summaries);
});

app.post('/api/weekly-summaries/generate', (req, res) => {
  const { week_start, week_end } = req.body;
  const start = week_start ? parseInt(week_start) : Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) * 7 * 24 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000;
  const end = week_end ? parseInt(week_end) : start + 7 * 24 * 60 * 60 * 1000;
  
  // Get tasks for the week
  const tasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE created_at >= ? AND created_at < ?
    OR updated_at >= ? AND updated_at < ?
  `).all(start, end, start, end);
  
  const completed = tasks.filter((t: any) => t.status === 'complete').length;
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const blocked = tasks.filter((t: any) => t.blocker_reason).length;
  
  // Get costs for the week
  const costs = db.prepare(`
    SELECT SUM(tokens_used) as tokens, SUM(actual_cost) as total_cost 
    FROM task_costs 
    WHERE recorded_at >= ? AND recorded_at < ?
  `).get(start, end) as any;
  
  // Get upcoming deadlines
  const upcoming = db.prepare(`
    SELECT * FROM tasks 
    WHERE deadline IS NOT NULL AND deadline > ? AND deadline <= ?
    AND status NOT IN ('complete')
    ORDER BY deadline ASC
  `).all(end, end + 7 * 24 * 60 * 60 * 1000);
  
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
    deadline_tasks: upcoming.map((t: any) => ({ id: t.id, title: t.title, deadline: t.deadline, status: t.status }))
  };
  
  const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO weekly_summaries (id, week_start, week_end, summary_json, generated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, start, end, JSON.stringify(summary), Date.now());
  
  const saved = db.prepare('SELECT * FROM weekly_summaries WHERE id = ?').get(id);
  broadcastUpdate({ type: 'weekly_summary_generated', data: saved });
  res.status(201).json(saved);
});

// ========== Dashboard Stats ==========
app.get('/api/dashboard/stats', (_req, res) => {
  const now = Date.now();
  const in48h = now + 48 * 60 * 60 * 1000;
  const in24h = now + 24 * 60 * 60 * 1000;
  
  // Get all tasks
  const allTasks = db.prepare('SELECT * FROM tasks').all() as any[];
  
  // Count by status
  const byStatus = {
    backlog: allTasks.filter(t => t.status === 'backlog').length,
    ready: allTasks.filter(t => t.status === 'ready').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    verification: allTasks.filter(t => t.status === 'verification').length,
    complete: allTasks.filter(t => t.status === 'complete').length,
  };
  
  // Count overdue and due soon
  const overdue = allTasks.filter(t => t.deadline && t.deadline < now && t.status !== 'complete').length;
  const dueSoon = allTasks.filter(t => t.deadline && t.deadline >= now && t.deadline <= in48h && t.status !== 'complete').length;
  const dueVerySoon = allTasks.filter(t => t.deadline && t.deadline >= now && t.deadline <= in24h && t.status !== 'complete').length;
  const blocked = allTasks.filter(t => t.blocker_reason).length;
  
  // Get active agents
  const activeAgents = db.prepare("SELECT * FROM agents WHERE status != 'idle'").all().length;
  
  // Get lane stats
  const lanes = db.prepare('SELECT * FROM lanes').all() as any[];
  const laneStats = lanes.map(lane => {
    const laneTasks = allTasks.filter(t => t.lane_id === lane.id);
    const completed = laneTasks.filter(t => t.status === 'complete').length;
    return {
      id: lane.id,
      name: lane.name,
      color: lane.color,
      total: laneTasks.length,
      completed,
      completionRate: laneTasks.length > 0 ? Math.round((completed / laneTasks.length) * 100) : 0
    };
  });
  
  // Get recent activity (last 10 tasks updated)
  const recentActivity = db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC LIMIT 10').all();
  
  res.json({
    totalTasks: allTasks.length,
    byStatus,
    overdue,
    dueSoon,
    dueVerySoon,
    blocked,
    activeAgents,
    laneStats,
    recentActivity
  });
});

// Server setup
const server = createServer(app);

// ============ OFFICE API ROUTES ============

// Get all office agents
app.get('/api/office/agents', (_req, res) => {
  const agents = db.prepare('SELECT * FROM office_agents WHERE office_enabled = 1').all();
  res.json({ agents });
});

// Get office agent by ID
app.get('/api/office/agents/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM office_agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

// Update agent state
app.post('/api/office/agents/:id/state', (req, res) => {
  const { state, task, progress } = req.body;
  db.prepare('UPDATE office_agents SET state = ?, current_task = ?, task_progress = ? WHERE id = ?')
    .run(state, task || null, progress || 0, req.params.id);
  
  // Broadcast to office WS
  officeWss?.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'agent.state', agentId: req.params.id, state, task, progress }));
    }
  });
  
  res.json({ success: true });
});

// Move agent to position
app.post('/api/office/agents/:id/move', (req, res) => {
  const { x, y } = req.body;
  db.prepare('UPDATE office_agents SET position_x = ?, position_y = ? WHERE id = ?')
    .run(x, y, req.params.id);
  
  // Broadcast to office WS
  officeWss?.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'agent.move', agentId: req.params.id, to: { x, y } }));
    }
  });
  
  res.json({ success: true });
});

// Get all reports
app.get('/api/office/reports', (_req, res) => {
  const reports = db.prepare('SELECT * FROM office_reports ORDER BY completed_at DESC').all();
  res.json({ reports });
});

// Create a new report (when task completes)
app.post('/api/office/report', (req, res) => {
  const { agent_id, agent_name, task_title } = req.body;
  const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  db.prepare(`
    INSERT INTO office_reports (id, agent_id, agent_name, task_title, completed_at, acknowledged)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, agent_id, agent_name, task_title, Date.now());
  
  const report = db.prepare('SELECT * FROM office_reports WHERE id = ?').get(id);
  
  // Broadcast to office WS
  officeWss?.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'report.new', reportId: id, agentId: agent_id, agentName: agent_name, taskTitle: task_title }));
    }
  });
  
  res.status(201).json(report);
});

// Acknowledge a report
app.post('/api/office/report/:id/acknowledge', (req, res) => {
  db.prepare('UPDATE office_reports SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Office WebSocket server
const officeWss = new WebSocketServer({ server, path: '/ws/office' });

officeWss.on('connection', (ws) => {
  console.log('Office client connected');
  
  // Send current state
  const agents = db.prepare('SELECT * FROM office_agents WHERE office_enabled = 1').all();
  ws.send(JSON.stringify({ type: 'office.init', agents }));
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'agent.enter') {
        const agent = db.prepare('SELECT * FROM office_agents WHERE id = ?').get(msg.agentId);
        if (agent) {
          db.prepare('UPDATE office_agents SET state = ? WHERE id = ?').run('entering', msg.agentId);
          officeWss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'agent.state', agentId: msg.agentId, state: 'entering' }));
            }
          });
        }
      }
      
      if (msg.type === 'agent.leave') {
        db.prepare('UPDATE office_agents SET state = ? WHERE id = ?').run('offline', msg.agentId);
        officeWss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'agent.leave', agentId: msg.agentId }));
          }
        });
      }
      
    } catch {}
  });
  
  ws.on('close', () => console.log('Office client disconnected'));
});

// Gateway WebSocket setup

const wss = new WebSocketServer({ server, path: '/gateway' });

function broadcastUpdate(message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', (data) => { try { handleGatewayMessage(JSON.parse(data.toString())); } catch {} });
  ws.on('close', () => console.log('Client disconnected'));
});

let gatewayWs: WebSocket | null = null;

function connectToGateway() {
  try {
    gatewayWs = new WebSocket('ws://localhost:18789');
    gatewayWs.on('open', () => {
      console.log('Connected to Gateway');
      db.prepare('UPDATE status SET gateway_connected = 1, last_update = ? WHERE id = 1').run(Date.now());
      gatewayWs?.send(JSON.stringify({ type: 'register', client: 'command-center' }));
    });
    gatewayWs.on('message', (data) => { try { handleGatewayMessage(JSON.parse(data.toString())); } catch {} });
    gatewayWs.on('close', () => { gatewayWs = null; db.prepare('UPDATE status SET gateway_connected = 0 WHERE id = 1').run(); setTimeout(connectToGateway, 5000); });
    gatewayWs.on('error', (err) => console.error('Gateway error:', err.message));
  } catch { setTimeout(connectToGateway, 5000); }
}

function handleGatewayMessage(message: any) {
  if (typeof message === 'object' && message !== null) {
    const msg = message as { type?: string; data?: { id?: string; name?: string; status?: string } };
    if (msg.type === 'agent_status' || msg.type === 'agent_update') {
      const a = msg.data;
      if (a?.id) db.prepare(`INSERT INTO agents (id, name, status, last_seen) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, last_seen=excluded.last_seen`)
        .run(a.id, a.name || a.id, a.status || 'unknown', Date.now());
    }
  }
  wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(message)); });
}

server.listen(PORT, () => {
  console.log(`Command Center API running on port ${PORT}`);
  console.log(`GitHub: ${octokit ? 'enabled' : 'disabled'}`);
  connectToGateway();
});

export { app, db };
