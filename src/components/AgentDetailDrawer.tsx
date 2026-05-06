import { useCallback, useEffect, useState } from 'react';

interface AgentDetail {
  id: string;
  name: string;
  status: string;
  state: string;
  currentTask: string | null;
  lastSeen: number | null;
  sessions: SessionInfo[];
  recentActivity: ActivityEntry[];
}

interface SessionInfo {
  key: string;
  kind: string;
  lastMessageAt?: number;
  lastMessage?: string;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  eventType: string;
  tool?: string | null;
  summary?: string | null;
}

const AGENT_COLORS: Record<string, string> = {
  main: '#14b8a6',
  dev: '#6b7280',
  janet: '#d97706',
  kimi: '#3b82f6',
  'gpt-mini': '#22c55e',
};

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function statusDot(state: string): string {
  switch (state) {
    case 'working': return 'bg-amber-400 animate-pulse';
    case 'blocked': return 'bg-red-400';
    case 'idle': return 'bg-green-400';
    case 'offline': return 'bg-slate-500';
    default: return 'bg-slate-400';
  }
}

export function AgentDetailDrawer({
  agentId,
  apiBase,
  onClose,
}: {
  agentId: string;
  apiBase: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [agentRes, sessionsRes] = await Promise.all([
        fetch(`${apiBase}/api/gateway/agents`),
        fetch(`${apiBase}/api/sessions?limit=10&messageLimit=1`),
      ]);

      const agentData = await agentRes.json();
      const sessionsData = await sessionsRes.json();

      const agentState = agentData.agents?.[agentId];
      const agentSessions = (sessionsData.sessions ?? [])
        .filter((s: { key?: string }) => s.key?.includes(`:${agentId}:`))
        .slice(0, 5);

      // Get office agent info from the office_agents table
      const officeRes = await fetch(`${apiBase}/api/office/agents`);
      const officeAgentsPayload = await officeRes.json();
      const officeAgents = Array.isArray(officeAgentsPayload)
        ? officeAgentsPayload
        : Array.isArray(officeAgentsPayload?.agents)
          ? officeAgentsPayload.agents
          : [];
      const officeAgent = officeAgents.find((a: { id: string }) => a.id === agentId) ?? null;

      setDetail({
        id: agentId,
        name: officeAgent?.name ?? agentId,
        status: agentState?.status ?? 'unknown',
        state: officeAgent?.state ?? agentState?.officeState ?? 'idle',
        currentTask: officeAgent?.current_task ?? agentState?.task ?? null,
        lastSeen: agentState?.lastSeen ?? officeAgent?.last_seen ?? null,
        sessions: agentSessions.map((s: Record<string, unknown>) => ({
          key: s.key as string,
          kind: s.kind as string,
          lastMessageAt: s.lastMessageAt as number | undefined,
          lastMessage: (s.messages as Array<{ content?: string }> | undefined)?.[0]?.content?.slice(0, 120),
        })),
        recentActivity: [],
      });
    } catch (err) {
      console.error('Failed to fetch agent detail:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, apiBase]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const color = AGENT_COLORS[agentId] ?? '#9ca3af';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${statusDot(detail?.state ?? 'idle')}`} />
            <h2 className="text-lg font-semibold" style={{ color }}>{detail?.name ?? agentId}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          </div>
        ) : detail ? (
          <div className="space-y-6 p-6">
            {/* Status Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">State</p>
                  <p className="font-medium text-slate-200 capitalize">{detail.state}</p>
                </div>
                <div>
                  <p className="text-slate-500">Last Active</p>
                  <p className="font-medium text-slate-200">{timeAgo(detail.lastSeen)}</p>
                </div>
              </div>
              {detail.currentTask && (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-500">Current Task</p>
                  <p className="mt-1 text-sm text-slate-300">{detail.currentTask}</p>
                </div>
              )}
            </div>

            {/* Sessions */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Recent Sessions</h3>
              {detail.sessions.length === 0 ? (
                <p className="text-sm text-slate-500">No active sessions</p>
              ) : (
                <div className="space-y-2">
                  {detail.sessions.map((session) => (
                    <div key={session.key} className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono truncate max-w-[200px]">{session.key.split(':').slice(-2).join(':')}</span>
                        <span className="text-slate-500">{session.kind}</span>
                      </div>
                      {session.lastMessage && (
                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{session.lastMessage}</p>
                      )}
                      {session.lastMessageAt && (
                        <p className="mt-1 text-[10px] text-slate-500">{timeAgo(session.lastMessageAt)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Check Status"
                  onClick={() => sendQuickMessage(apiBase, agentId, '/status')}
                />
                <ActionButton
                  label="What are you working on?"
                  onClick={() => sendQuickMessage(apiBase, agentId, 'What are you currently working on? Give me a brief status.')}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-slate-500">
            Could not load agent details
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <button
      onClick={() => {
        onClick();
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      }}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        sent
          ? 'border-green-600 bg-green-900/30 text-green-300'
          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
      disabled={sent}
    >
      {sent ? '✓ Sent' : label}
    </button>
  );
}

async function sendQuickMessage(apiBase: string, agentId: string, message: string) {
  try {
    await fetch(`${apiBase}/api/gateway/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, message }),
    });
  } catch (err) {
    console.error('Failed to send quick message:', err);
  }
}
