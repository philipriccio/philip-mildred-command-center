import { useEffect, useRef, useState } from 'react';

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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function eventIcon(eventType: string): string {
  switch (eventType) {
    case 'thinking': return '🧠';
    case 'tool_call': return '🔧';
    case 'speaking': return '💬';
    case 'error': return '❌';
    case 'idle': return '💤';
    default: return '📡';
  }
}

export function ActivityTimeline({ wsUrl }: { wsUrl: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        
        if (msg.type === 'activity.recent' && Array.isArray(msg.entries)) {
          setEntries(msg.entries.slice(-50));
        }
        
        if (msg.type === 'activity.entry' && msg.entry) {
          setEntries(prev => {
            const next = [...prev, msg.entry].slice(-100);
            return next;
          });
        }

        // Also capture agent.state events as activity
        if (msg.type === 'agent.state' && msg.agentId) {
          const entry: ActivityEntry = {
            id: `state-${Date.now()}-${msg.agentId}`,
            timestamp: Date.now(),
            agentId: msg.agentId,
            agentName: msg.agentId,
            eventType: msg.visualStatus || msg.state || 'unknown',
            tool: msg.tool,
            summary: msg.task || msg.message,
          };
          setEntries(prev => [...prev, entry].slice(-100));
        }
      } catch { /* ignore */ }
    };

    // Subscribe to activity + office topics
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', topics: ['activity', 'office', 'all'] }));
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Live Activity</h3>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>
        <span className="text-xs text-slate-500">{entries.length} events</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ maxHeight: '400px' }}>
        {entries.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">
            Waiting for agent activity...
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-800/50"
          >
            <span className="mt-0.5 text-sm">{eventIcon(entry.eventType)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-medium"
                  style={{ color: AGENT_COLORS[entry.agentId] ?? '#9ca3af' }}
                >
                  {entry.agentName}
                </span>
                <span className="text-slate-500">{timeAgo(entry.timestamp)}</span>
              </div>
              {entry.tool && (
                <span className="text-slate-400">
                  <span className="text-blue-400">{entry.tool}</span>
                </span>
              )}
              {entry.summary && (
                <p className="mt-0.5 text-slate-400 line-clamp-2">{entry.summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
