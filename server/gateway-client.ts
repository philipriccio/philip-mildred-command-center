/**
 * OpenClaw Gateway WebSocket Client for Command Center
 * 
 * Implements the OpenClaw gateway protocol v3:
 * 1. Connect → server sends connect.challenge with nonce
 * 2. Client sends req/connect with auth token
 * 3. Server responds with hello-ok containing snapshot
 * 4. Server streams events (agent lifecycle, tool calls, assistant messages, errors)
 * 
 * Based on protocol analysis from OpenClaw Office and live gateway testing.
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';

// ─── Protocol Types ───────────────────────────────────────────────

interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface GatewayResponseOk<T = unknown> {
  type: 'res';
  id: string;
  ok: true;
  payload: T;
}

interface GatewayResponseError {
  type: 'res';
  id: string;
  ok: false;
  error: { code: string; message: string; retryable?: boolean };
}

type GatewayResponse<T = unknown> = GatewayResponseOk<T> | GatewayResponseError;

interface GatewayEvent<T = unknown> {
  type: 'event';
  event: string;
  payload: T;
}

type GatewayFrame = GatewayRequest | GatewayResponse | GatewayEvent;

interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server: { version: string; connId?: string };
  features?: Record<string, unknown>;
  auth?: { deviceToken?: string; role?: string; scopes?: string[] };
  snapshot?: {
    presence?: unknown;
    health?: HealthSnapshot;
    sessionDefaults?: unknown;
    uptimeMs?: number;
  };
}

interface HealthSnapshot {
  ok: boolean;
  ts: number;
  agents?: HealthAgentInfo[];
  defaultAgentId?: string;
}

interface HealthAgentInfo {
  agentId: string;
  isDefault?: boolean;
  heartbeat?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
}

// ─── Agent Event Types ────────────────────────────────────────────

type AgentStream = 'lifecycle' | 'tool' | 'assistant' | 'error';

interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: AgentStream;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
}

export type AgentVisualStatus =
  | 'idle'
  | 'thinking'
  | 'tool_calling'
  | 'speaking'
  | 'error'
  | 'offline';

export interface AgentState {
  id: string;
  status: AgentVisualStatus;
  currentTool: string | null;
  lastMessage: string | null;
  lastActiveAt: number;
  runId: string | null;
  sessionKey: string | null;
  toolCallCount: number;
}

export interface ParsedAgentEvent {
  agentId: string;
  runId: string;
  sessionKey?: string;
  status: AgentVisualStatus;
  tool: string | null;
  message: string | null;
  summary: string;
}

// ─── Connection State ─────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type EventCallback = (event: string, payload: unknown) => void;
type StatusCallback = (status: ConnectionStatus, error?: string) => void;
type AgentEventCallback = (parsed: ParsedAgentEvent) => void;
type ResponseCallback = (frame: GatewayResponse) => void;

// ─── Client ───────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const JITTER_MS = 1000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shutdownReceived = false;

  private snapshot: HelloOk['snapshot'] | null = null;
  private serverInfo: HelloOk['server'] | null = null;

  // Agent state tracking
  private agents = new Map<string, AgentState>();
  // runId → agentId mapping
  private runIdMap = new Map<string, string>();

  // Callbacks
  private statusCallbacks = new Set<StatusCallback>();
  private eventCallbacks = new Set<EventCallback>();
  private agentEventCallbacks = new Set<AgentEventCallback>();
  private responseHandlers = new Map<string, ResponseCallback>();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  // ─── Public API ───────────────────────────────────────────────

  connect(): void {
    this.shutdownReceived = false;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.shutdownReceived = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSnapshot(): HelloOk['snapshot'] | null {
    return this.snapshot;
  }

  getServerInfo(): HelloOk['server'] | null {
    return this.serverInfo;
  }

  getAgentStates(): Map<string, AgentState> {
    return new Map(this.agents);
  }

  getAgentState(id: string): AgentState | undefined {
    return this.agents.get(id);
  }

  onStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  onEvent(cb: EventCallback): () => void {
    this.eventCallbacks.add(cb);
    return () => this.eventCallbacks.delete(cb);
  }

  onAgentEvent(cb: AgentEventCallback): () => void {
    this.agentEventCallbacks.add(cb);
    return () => this.agentEventCallbacks.delete(cb);
  }

  /** Send an RPC request and get a typed response */
  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = randomUUID();
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        this.responseHandlers.delete(id);
      };

      this.responseHandlers.set(id, (frame) => {
        cleanup();
        if (frame.ok) {
          resolve(frame.payload as T);
        } else {
          reject(new Error(`RPC ${method}: ${frame.error.message}`));
        }
      });

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`RPC ${method} timed out`));
      }, timeoutMs);

      this.send({ type: 'req', id, method, params });
    });
  }

  // ─── Connection Logic ─────────────────────────────────────────

  private doConnect(): void {
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    try {
      // Must set origin header — gateway validates it for control-ui connections
      this.ws = new WebSocket(this.url, { origin: 'http://localhost:18789' });
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      // Wait for connect.challenge from server
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      if (!this.shutdownReceived) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      console.error('[GatewayClient] WebSocket error:', err.message);
      // close event will follow
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(data.toString()) as GatewayFrame;
    } catch {
      return;
    }

    if (frame.type === 'event') {
      this.handleEvent(frame as GatewayEvent);
    } else if (frame.type === 'res') {
      this.handleResponse(frame as GatewayResponse);
    }
  }

  private handleEvent(frame: GatewayEvent): void {
    // Challenge-response auth
    if (frame.event === 'connect.challenge') {
      const payload = frame.payload as { nonce?: string } | null;
      const nonce = payload?.nonce ?? '';
      this.sendConnectRequest(nonce);
      return;
    }

    // Shutdown
    if (frame.event === 'shutdown') {
      this.shutdownReceived = true;
      this.clearReconnectTimer();
      this.setStatus('disconnected');
      return;
    }

    // Agent events — gateway sends 'agent' not 'agent.event'
    if (frame.event === 'agent' || frame.event === 'agent.event') {
      const evtPayload = frame.payload as AgentEventPayload;
      console.log(`[GatewayClient] agent event stream=${evtPayload.stream} runId=${evtPayload.runId?.slice(0,8)} session=${evtPayload.sessionKey?.slice(0,30)}`);
      this.processAgentEvent(evtPayload);
    }

    // Notify listeners
    for (const cb of this.eventCallbacks) {
      cb(frame.event, frame.payload);
    }
  }

  private handleResponse(frame: GatewayResponse): void {
    // Check for pending RPC handlers first
    const handler = this.responseHandlers.get(frame.id);
    if (handler) {
      this.responseHandlers.delete(frame.id);
      handler(frame);
      return;
    }

    // Connect response (might not match a tracked id)
    if (frame.ok) {
      const payload = frame.payload as Record<string, unknown>;
      if (payload?.type === 'hello-ok') {
        this.handleConnectSuccess(payload as unknown as HelloOk);
        return;
      }
    }

    if (!frame.ok) {
      console.error('[GatewayClient] Unhandled error response:', frame.error);
      this.setStatus('error', frame.error.message);
    }
  }

  private sendConnectRequest(): void {
    const id = randomUUID();

    // Track the connect response
    this.responseHandlers.set(id, (frame) => {
      if (frame.ok) {
        const payload = frame.payload as Record<string, unknown>;
        if (payload?.type === 'hello-ok') {
          this.handleConnectSuccess(payload as unknown as HelloOk);
        }
      } else {
        console.error('[GatewayClient] Connect failed:', frame.error);
        this.setStatus('error', frame.error.message);
      }
    });

    this.send({
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        role: 'operator',
        client: {
          id: 'openclaw-control-ui',
          version: '0.1.0',
          platform: 'node',
          mode: 'ui',
        },
        caps: ['tool-events'],
        scopes: ['operator.admin', 'operator.read'],
        auth: { token: this.token },
      },
    });
  }

  private handleConnectSuccess(payload: HelloOk): void {
    this.snapshot = payload.snapshot ?? null;
    this.serverInfo = payload.server ?? null;
    this.reconnectAttempt = 0;
    this.setStatus('connected');

    console.log(`[GatewayClient] Connected to gateway v${payload.server?.version ?? '?'} (protocol ${payload.protocol})`);

    // Initialize agent states from health snapshot
    if (payload.snapshot?.health?.agents) {
      for (const agent of payload.snapshot.health.agents) {
        if (!this.agents.has(agent.agentId)) {
          this.agents.set(agent.agentId, {
            id: agent.agentId,
            status: 'idle',
            currentTool: null,
            lastMessage: null,
            lastActiveAt: Date.now(),
            runId: null,
            sessionKey: null,
            toolCallCount: 0,
          });
        }
      }
    }
  }

  // ─── Agent Event Processing ───────────────────────────────────

  private processAgentEvent(event: AgentEventPayload): void {
    // Resolve agentId from runId
    const agentId = this.resolveAgentId(event);
    if (!agentId) return;

    const parsed = this.parseEvent(agentId, event);

    // Update internal agent state
    let state = this.agents.get(agentId);
    if (!state) {
      state = {
        id: agentId,
        status: 'idle',
        currentTool: null,
        lastMessage: null,
        lastActiveAt: Date.now(),
        runId: null,
        sessionKey: null,
        toolCallCount: 0,
      };
      this.agents.set(agentId, state);
    }

    state.status = parsed.status;
    state.lastActiveAt = event.ts;
    state.runId = event.runId;
    if (event.sessionKey) state.sessionKey = event.sessionKey;

    if (parsed.tool !== undefined) state.currentTool = parsed.tool;
    if (parsed.message) state.lastMessage = parsed.message;
    if (parsed.status === 'tool_calling') state.toolCallCount++;
    if (parsed.status === 'idle') {
      state.currentTool = null;
      state.runId = null;
    }

    // Notify listeners
    for (const cb of this.agentEventCallbacks) {
      cb(parsed);
    }
  }

  private resolveAgentId(event: AgentEventPayload): string | null {
    // Check if we already know this runId
    const known = this.runIdMap.get(event.runId);
    if (known) return known;

    // Try to extract from sessionKey (format: "agent:<id>:...")
    if (event.sessionKey) {
      const match = event.sessionKey.match(/^agent:([^:]+)/);
      if (match) {
        const agentId = match[1];
        this.runIdMap.set(event.runId, agentId);
        return agentId;
      }
    }

    // For lifecycle start events, try to determine from the data
    if (event.stream === 'lifecycle' && event.data.phase === 'start') {
      const agentId = (event.data.agentId as string) ?? null;
      if (agentId) {
        this.runIdMap.set(event.runId, agentId);
        return agentId;
      }
    }

    return null;
  }

  private parseEvent(agentId: string, event: AgentEventPayload): ParsedAgentEvent {
    const base: ParsedAgentEvent = {
      agentId,
      runId: event.runId,
      sessionKey: event.sessionKey,
      status: 'idle',
      tool: null,
      message: null,
      summary: '',
    };

    switch (event.stream) {
      case 'lifecycle': {
        const phase = event.data.phase as string | undefined;
        if (phase === 'start' || phase === 'thinking') {
          base.status = 'thinking';
          base.summary = phase === 'start' ? 'Started running' : 'Thinking...';
        } else if (phase === 'end') {
          base.status = 'idle';
          base.summary = 'Run ended';
        } else if (phase === 'fallback') {
          base.status = 'error';
          base.summary = 'Fallback triggered';
        } else {
          base.status = 'thinking';
          base.summary = `Lifecycle: ${phase ?? 'unknown'}`;
        }
        break;
      }

      case 'tool': {
        const phase = event.data.phase as string | undefined;
        const name = (event.data.name as string) ?? 'unknown';
        if (phase === 'start') {
          base.status = 'tool_calling';
          base.tool = name;
          base.summary = `Calling ${name}`;
        } else {
          base.status = 'thinking';
          base.tool = null;
          base.summary = `${name} complete`;
        }
        break;
      }

      case 'assistant': {
        const text = (event.data.text as string) ?? '';
        base.status = 'speaking';
        base.message = text;
        base.summary = text.length > 60 ? `${text.slice(0, 60)}...` : text;
        break;
      }

      case 'error': {
        const message = (event.data.message as string) ?? 'Unknown error';
        base.status = 'error';
        base.summary = message;
        break;
      }
    }

    return base;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this.status = status;
    for (const cb of this.statusCallbacks) {
      cb(status, error);
    }
  }

  private scheduleReconnect(): void {
    if (this.shutdownReceived) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt), MAX_DELAY_MS)
      + Math.random() * JITTER_MS;

    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
