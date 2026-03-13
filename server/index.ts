import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Database from 'better-sqlite3';
import path from 'path';

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

app.use(express.json());

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
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    agent_id TEXT,
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

// Initialize status row
db.exec(`INSERT OR IGNORE INTO status (id, gateway_connected, last_update) VALUES (1, 0, 0)`);

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

// Create HTTP server
const server = createServer(app);

// WebSocket connection to OpenClaw Gateway
const wss = new WebSocketServer({ server, path: '/gateway' });

let gatewayWs: WebSocket | null = null;

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
function connectToGateway() {
  const gatewayUrl = 'ws://localhost:18789';
  
  try {
    const gateway = new WebSocket(gatewayUrl);
    
    gateway.on('open', () => {
      console.log('Connected to OpenClaw Gateway');
      gatewayWs = gateway;
      db.prepare('UPDATE status SET gateway_connected = 1, last_update = ? WHERE id = 1').run(Date.now());
      
      // Send handshake
      gateway.send(JSON.stringify({ type: 'register', client: 'command-center' }));
    });

    gateway.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleGatewayMessage(message);
      } catch (err) {
        console.error('Invalid gateway message:', err);
      }
    });

    gateway.on('close', () => {
      console.log('Disconnected from Gateway');
      gatewayWs = null;
      db.prepare('UPDATE status SET gateway_connected = 0, last_update = ? WHERE id = 1').run(Date.now());
      // Reconnect after 5 seconds
      setTimeout(connectToGateway, 5000);
    });

    gateway.on('error', (err) => {
      console.error('Gateway connection error:', err.message);
    });
  } catch (err) {
    console.error('Failed to connect to gateway:', err);
    setTimeout(connectToGateway, 5000);
  }
}

function handleGatewayMessage(message: any) {
  // Handle agent status updates from gateway
  if (message.type === 'agent_status' || message.type === 'agent_update') {
    const agent = message.data;
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
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
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
