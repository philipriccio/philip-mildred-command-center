import { useEffect, useState } from 'react';

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    tz?: string;
    everyMs?: number;
    at?: string;
  };
  sessionTarget: string;
  payload: {
    kind: string;
    message?: string;
    text?: string;
  };
  delivery?: {
    mode: string;
    to?: string;
    channel?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
    lastErrorReason?: string;
    lastDelivered?: boolean;
    lastDeliveryStatus?: string;
  };
}

function formatSchedule(s: CronJob['schedule']): string {
  if (s.kind === 'cron') return `${s.expr}${s.tz ? ` (${s.tz})` : ''}`;
  if (s.kind === 'every') return `Every ${Math.round((s.everyMs ?? 0) / 60000)}m`;
  if (s.kind === 'at') return `At ${s.at}`;
  return s.kind;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function timeUntil(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60_000) return 'soon';
  if (diff < 3600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `in ${Math.floor(diff / 3600_000)}h`;
  return `in ${Math.floor(diff / 86400_000)}d`;
}

function statusBadge(status: string | undefined): { color: string; label: string } {
  if (!status) return { color: 'bg-slate-600', label: 'unknown' };
  if (status === 'ok') return { color: 'bg-green-500/20 text-green-300', label: '✓ ok' };
  if (status === 'error') return { color: 'bg-red-500/20 text-red-300', label: '✗ error' };
  return { color: 'bg-amber-500/20 text-amber-300', label: status };
}

export function CronPanel({ apiBase }: { apiBase: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/cron/jobs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30_000);
    return () => clearInterval(interval);
  }, [apiBase]);

  const enabledJobs = jobs.filter(j => j.enabled);
  const failedJobs = enabledJobs.filter(j => j.state?.lastStatus === 'error');
  const okJobs = enabledJobs.filter(j => j.state?.lastStatus === 'ok');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Cron Jobs</h2>
        <button
          onClick={() => { setLoading(true); fetchJobs(); }}
          className="text-xs text-slate-400 hover:text-white transition"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-2xl font-bold text-white">{enabledJobs.length}</div>
          <div className="text-xs text-slate-400">Active Jobs</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className={`text-2xl font-bold ${failedJobs.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {failedJobs.length}
          </div>
          <div className="text-xs text-slate-400">Failed</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-2xl font-bold text-green-400">{okJobs.length}</div>
          <div className="text-xs text-slate-400">Healthy</div>
        </div>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading cron jobs...</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Job list */}
      <div className="space-y-2">
        {enabledJobs
          .sort((a, b) => {
            // Failed first, then by next run
            const aFailed = a.state?.lastStatus === 'error' ? 0 : 1;
            const bFailed = b.state?.lastStatus === 'error' ? 0 : 1;
            if (aFailed !== bFailed) return aFailed - bFailed;
            return (a.state?.nextRunAtMs ?? Infinity) - (b.state?.nextRunAtMs ?? Infinity);
          })
          .map(job => {
            const badge = statusBadge(job.state?.lastStatus);
            return (
              <div
                key={job.id}
                className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white truncate">
                    {job.name || job.id.slice(0, 8)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-mono">{formatSchedule(job.schedule)}</span>
                  {job.state?.lastRunAtMs && (
                    <span>Last: {timeAgo(job.state.lastRunAtMs)}</span>
                  )}
                  {job.state?.nextRunAtMs && (
                    <span>Next: {timeUntil(job.state.nextRunAtMs)}</span>
                  )}
                  {job.state?.lastDurationMs && (
                    <span>{Math.round(job.state.lastDurationMs / 1000)}s</span>
                  )}
                </div>
                {job.state?.lastError && (
                  <div className="mt-1 text-xs text-red-400/80 truncate">
                    {job.state.lastError}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Disabled jobs summary */}
      {jobs.filter(j => !j.enabled).length > 0 && (
        <div className="text-xs text-slate-500">
          + {jobs.filter(j => !j.enabled).length} disabled jobs
        </div>
      )}
    </div>
  );
}
