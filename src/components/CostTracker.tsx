import { useEffect, useState } from 'react';

interface SessionUsage {
  sessionKey: string;
  agentId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  lastActiveAt?: number;
}

interface AgentCostRow {
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  sessionCount: number;
}

interface CostSummary {
  totals: {
    tokens: number;
    estimated: number;
    actual: number;
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CostTracker({ apiBase }: { apiBase: string }) {
  const [rows, setRows] = useState<AgentCostRow[]>([]);
  const [fallbackSummary, setFallbackSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try gateway sessions usage first
        const sessRes = await fetch(`${apiBase}/api/sessions/usage`);
        if (sessRes.ok) {
          const data = await sessRes.json() as { sessions?: SessionUsage[] };
          if (data.sessions && data.sessions.length > 0) {
            // Aggregate by agent + model
            const map = new Map<string, AgentCostRow>();
            for (const s of data.sessions) {
              const agentId = s.agentId || extractAgentId(s.sessionKey);
              const model = s.model || 'unknown';
              const key = `${agentId}::${model}`;
              const existing = map.get(key);
              if (existing) {
                existing.inputTokens += s.inputTokens || 0;
                existing.outputTokens += s.outputTokens || 0;
                existing.totalTokens += s.totalTokens || 0;
                existing.cost += s.cost || 0;
                existing.sessionCount += 1;
              } else {
                map.set(key, {
                  agentId,
                  model,
                  inputTokens: s.inputTokens || 0,
                  outputTokens: s.outputTokens || 0,
                  totalTokens: s.totalTokens || 0,
                  cost: s.cost || 0,
                  sessionCount: 1,
                });
              }
            }
            setRows(Array.from(map.values()).sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens));
            setLoading(false);
            setError(null);
            return;
          }
        }

        // Fall back to task-costs summary
        const costRes = await fetch(`${apiBase}/api/task-costs/summary`);
        if (costRes.ok) {
          const data = await costRes.json() as CostSummary;
          setFallbackSummary(data);
        }
        setLoading(false);
      } catch (err) {
        setError(String(err));
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [apiBase]);

  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
  const totalTokens = rows.reduce((sum, r) => sum + r.totalTokens, 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">Cost & Usage</h3>
        {!loading && rows.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{formatTokens(totalTokens)} tokens</span>
            <span className="font-medium text-emerald-300">${totalCost.toFixed(2)}</span>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading usage data…</p>}

      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${row.agentId}::${row.model}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <AgentDot agentId={row.agentId} />
                <div>
                  <p className="text-sm font-medium capitalize text-slate-200">{row.agentId}</p>
                  <p className="text-xs text-slate-500">{row.model} · {row.sessionCount} session{row.sessionCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200">${row.cost.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{formatTokens(row.totalTokens)} tok</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && fallbackSummary && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <span className="text-sm text-slate-300">Total</span>
          <div className="text-right">
            <p className="text-sm font-medium text-emerald-300">${fallbackSummary.totals.actual.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{formatTokens(fallbackSummary.totals.tokens)} tokens</p>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && !fallbackSummary && !error && (
        <p className="text-sm text-slate-500">No usage data available yet.</p>
      )}
    </div>
  );
}

function AgentDot({ agentId }: { agentId: string }) {
  const colors: Record<string, string> = {
    main: '#008080',
    dev: '#808080',
    janet: '#8B4513',
    kimi: '#2E86C1',
    'gpt-mini': '#27AE60',
  };
  const color = colors[agentId] || '#6B7280';
  return <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />;
}

function extractAgentId(sessionKey: string): string {
  // agent:main:telegram:... → main
  const parts = sessionKey.split(':');
  return parts[1] || 'unknown';
}
