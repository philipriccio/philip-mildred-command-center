import { useEffect, useState } from 'react';

interface SiteStatus {
  url: string;
  name: string;
  status: number | null;
  responseTimeMs: number | null;
  error: string | null;
  ok: boolean;
}

const SITES = [
  { name: 'Company Theatre', url: 'https://companytheatre.ca' },
  { name: 'Jackpot Twins', url: 'https://jackpottwins.ca' },
  { name: 'Self-e-Tape', url: 'https://selfetape.com' },
  { name: 'CT CRM', url: 'https://crm.companytheatre.ca', expectAuth: true },
  { name: 'Hawco CRM', url: 'https://hawco.companytheatre.ca', expectRedirect: true },
  { name: 'CoverageIQ', url: 'https://coverageiq.companytheatre.ca' },
];

export function SiteHealthPanel({ apiBase }: { apiBase: string }) {
  const [sites, setSites] = useState<SiteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${apiBase}/api/health/sites`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSites(data.sites ?? []);
      setLastCheck(Date.now());
    } catch {
      // If endpoint doesn't exist yet, do client-side checks as fallback
      const results: SiteStatus[] = [];
      for (const site of SITES) {
        const start = Date.now();
        try {
          const r = await fetch(site.url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
          results.push({
            url: site.url,
            name: site.name,
            status: r.status || 0,
            responseTimeMs: Date.now() - start,
            error: null,
            ok: true, // no-cors gives opaque response, assume reachable
          });
        } catch (e) {
          results.push({
            url: site.url,
            name: site.name,
            status: null,
            responseTimeMs: Date.now() - start,
            error: String(e),
            ok: false,
          });
        }
      }
      setSites(results);
      setLastCheck(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 120_000); // every 2 min
    return () => clearInterval(interval);
  }, [apiBase]);

  const allOk = sites.length > 0 && sites.every(s => s.ok);
  const downCount = sites.filter(s => !s.ok).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Site Health</h2>
        <div className="flex items-center gap-2">
          {lastCheck && (
            <span className="text-xs text-slate-500">
              {new Date(lastCheck).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchHealth(); }}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Check
          </button>
        </div>
      </div>

      {/* Overall status */}
      <div className={`rounded-lg p-3 border ${
        allOk 
          ? 'bg-green-500/10 border-green-500/20' 
          : downCount > 0 
            ? 'bg-red-500/10 border-red-500/20' 
            : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        <div className={`text-sm font-medium ${allOk ? 'text-green-300' : 'text-red-300'}`}>
          {loading ? 'Checking...' : allOk ? '✓ All sites healthy' : `⚠ ${downCount} site${downCount !== 1 ? 's' : ''} down`}
        </div>
      </div>

      {/* Site list */}
      <div className="space-y-1">
        {sites.map(site => (
          <div
            key={site.url}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/30 transition"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${site.ok ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm text-slate-200">{site.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {site.status !== null && site.status > 0 && (
                <span className={site.status >= 400 && site.status < 500 ? 'text-amber-400' : site.status >= 500 ? 'text-red-400' : ''}>
                  {site.status}
                </span>
              )}
              {site.responseTimeMs !== null && (
                <span className={site.responseTimeMs > 3000 ? 'text-amber-400' : ''}>
                  {site.responseTimeMs}ms
                </span>
              )}
              {site.error && !site.ok && (
                <span className="text-red-400 truncate max-w-[120px]" title={site.error}>
                  Down
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
