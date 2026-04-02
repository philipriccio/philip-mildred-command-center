import { useEffect, useState } from 'react';

interface CostSummary {
  totals: {
    tokens: number;
    estimated: number;
    actual: number;
  };
}

export function CostTracker({ apiBase }: { apiBase: string }) {
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);

  useEffect(() => {
    const fetchCostSummary = async () => {
      try {
        const res = await fetch(`${apiBase}/api/task-costs/summary`);
        if (!res.ok) throw new Error('Failed to fetch cost summary');
        const data = await res.json();
        setCostSummary(data);
      } catch (error) {
        console.error('Error fetching cost summary:', error);
      }
    };

    fetchCostSummary();
    const interval = setInterval(fetchCostSummary, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [apiBase]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-slate-200">
      <h3 className="text-lg font-semibold">Cost Summary</h3>
      {costSummary ? (
        <div>
          <p><strong>Estimated Tokens:</strong> {costSummary.totals.estimated}</p>
          <p><strong>Actual Cost:</strong> ${costSummary.totals.actual.toFixed(2)}</p>
        </div>
      ) : (
        <p>Loading cost data...</p>
      )}
    </div>
  );
}