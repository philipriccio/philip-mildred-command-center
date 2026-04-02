import { useEffect, useState } from 'react';

interface GatewaySession {
  key: string;
  kind: string;
  agentId?: string;
  model?: string;
  updatedAt?: number;
  totalTokens?: number;
  contextTokens?: number;
  lastMessages?: Array<{
    role: string;
    text?: string;
    ts?: number;
  }>;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function sessionLabel(session: GatewaySession): string {
  const key = session.key;
  // Extract readable parts from session key
  if (key.includes(':subagent:')) {
    const parts = key.split(':');
    const agent = parts[1] ?? 'unknown';
    return `${agent} (subagent)`;
  }
  if (key.includes(':telegram:')) {
    const parts = key.split(':');
    const agent = parts[1] ?? 'unknown';
    return `${agent} → telegram`;
  }
  if (key.includes(':cron:')) {
    return 'Cron job';
  }
  return key.length > 40 ? key.slice(0, 40) + '...' : key;
}

function kindBadge(kind: string): string {
  switch (kind) {
    case 'dm': return 'bg-blue-500/20 text-blue-300';
    case 'subagent': return 'bg-purple-500/20 text-purple-300';
    case 'cron': return 'bg-amber-500/20 text-amber-300';
    case 'group': return 'bg-green-500/20 text-green-300';
    default: return 'bg-slate-600/20 text-slate-300';
  }
}

export function SessionsPanel({ apiBase }: { apiBase: string }) {
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent'>('recent');

  const fetchSessions = async () => {
    try {
      const params = filter === 'recent' ? '?activeMinutes=60' : '';
      const res = await fetch(`${apiBase}/api/sessions${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15_000);
    return () => clearInterval(interval);
  }, [apiBase, filter]);

  const activeSessions = sessions.filter(s => 
    s.updatedAt && (Date.now() - s.updatedAt) < 300_000 // active in last 5 min
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Sessions</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('recent')}
            className={`text-xs px-2 py-1 rounded ${filter === 'recent' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Recent
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-1 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            All
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
          <span className="text-lg font-bold text-white">{sessions.length}</span>
          <span className="text-xs text-slate-400 ml-1">total</span>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
          <span className="text-lg font-bold text-cyan-400">{activeSessions.length}</span>
          <span className="text-xs text-slate-400 ml-1">active</span>
        </div>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading sessions...</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Session list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {sessions
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          .map(session => {
            const isActive = session.updatedAt && (Date.now() - session.updatedAt) < 300_000;
            return (
              <div
                key={session.key}
                className={`py-2 px-3 rounded-lg transition ${isActive ? 'bg-slate-800/40 border border-cyan-500/20' : 'hover:bg-slate-800/20'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-sm text-slate-200 truncate">
                      {sessionLabel(session)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${kindBadge(session.kind)}`}>
                      {session.kind}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                    {session.totalTokens != null && session.totalTokens > 0 && (
                      <span>{formatTokens(session.totalTokens)} tok</span>
                    )}
                    {session.updatedAt && (
                      <span>{timeAgo(session.updatedAt)}</span>
                    )}
                  </div>
                </div>
                {session.model && (
                  <div className="text-[11px] text-slate-500 mt-0.5 pl-4 truncate">
                    {session.model}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
