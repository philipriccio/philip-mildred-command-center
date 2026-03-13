import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

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
      imgSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

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
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gateway_connected INTEGER DEFAULT 0,
    last_update INTEGER
  );
`);

// Add missing columns if they exist (migration)
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN deadline INTEGER`);
} catch {}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN blocker_reason TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE agents ADD COLUMN current_task_id TEXT`);
} catch {}

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

// Task CRUD endpoints
app.post('/api/tasks', (req, res) => {
  const { title, description, status, agent_id, deadline } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, status, agent_id, deadline, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, title, description || '', status || 'backlog', agent_id || null, deadline || null, now, now);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_created', data: task });
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, status, agent_id, deadline, blocker_reason } = req.body;
  const now = Date.now();
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        agent_id = ?,
        deadline = ?,
        blocker_reason = ?,
        updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(title, description, status, agent_id, deadline, blocker_reason, now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_updated', data: task });
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  broadcastUpdate({ type: 'task_deleted', data: { id } });
  res.status(204).send();
});

// Assign agent to task
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

// Move task (for drag and drop)
app.post('/api/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const now = Date.now();
  
  db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcastUpdate({ type: 'task_moved', data: task });
  res.json(task);
});

// Create HTTP server
const server = createServer(app);

// WebSocket connection to OpenClaw Gateway
const wss = new WebSocketServer({ server, path: '/gateway' });

function broadcastUpdate(message: unknown) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected to command center');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleGatewayMessage(message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Connect to OpenClaw Gateway
let gatewayWs: WebSocket | null = null;

function connectToGateway() {
  const gatewayUrl = 'ws://localhost:18789';
  
  try {
    gatewayWs = new WebSocket(gatewayUrl);
    
    gatewayWs.on('open', () => {
      console.log('Connected to OpenClaw Gateway');
      db.prepare('UPDATE status SET gateway_connected = 1, last_update = ? WHERE id = 1').run(Date.now());
      
      // Send handshake
      gatewayWs?.send(JSON.stringify({ type: 'register', client: 'command-center' }));
    });

    gatewayWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleGatewayMessage(message);
      } catch (err) {
        console.error('Invalid gateway message:', err);
      }
    });

    gatewayWs.on('close', () => {
      console.log('Disconnected from Gateway');
      gatewayWs = null;
      db.prepare('UPDATE status SET gateway_connected = 0, last_update = ? WHERE id = 1').run(Date.now());
      // Reconnect after 5 seconds
      setTimeout(connectToGateway, 5000);
    });

    gatewayWs.on('error', (err) => {
      console.error('Gateway connection error:', err.message);
    });
  } catch (err) {
    console.error('Failed to connect to gateway:', err);
    setTimeout(connectToGateway, 5000);
  }
}

function handleGatewayMessage(message: unknown) {
  // Handle agent status updates from gateway
  if (typeof message === 'object' && message !== null) {
    const msg = message as { type?: string; data?: { id?: string; name?: string; status?: string; metadata?: Record<string, unknown> } };
    if (msg.type === 'agent_status' || msg.type === 'agent_update') {
      const agent = msg.data;
      if (agent && agent.id) {
        const stmt = db.prepare(`
          INSERT INTO agents (id, name, status, last_seen, metadata)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            status = excluded.status,
            last_seen = excluded.last_seen,
            metadata = excluded.metadata
        `);
        stmt.run(agent.id, agent.name || agent.id, agent.status || 'unknown', Date.now(), JSON.stringify(agent.metadata || {}));
      }
    }
  }
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Command Center API running on port ${PORT}`);
  connectToGateway();
});

export { app, db };
