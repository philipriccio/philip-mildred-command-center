interface OfficeReport {
  id: string;
  task_id: string | null;
  agent_id: string;
  agent_name: string;
  task_title: string;
  summary: string | null;
  lane_name: string | null;
  model_used: string | null;
  completed_at: number;
  acknowledged: number;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: number | null;
  approved_by: string | null;
  approved_at: number | null;
}

export function ReportsPanel({
  reports,
  pendingReports,
  onAcknowledge,
  onApprove,
  isOpen,
  onClose,
}: {
  reports: OfficeReport[];
  pendingReports: OfficeReport[];
  onAcknowledge: (reportId: string) => void;
  onApprove: (reportId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const unread = reports.filter((report) => !report.acknowledged);
  const acknowledged = reports.filter((report) => report.acknowledged);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Trusted completion archive</p>
            <h2 className="text-lg font-semibold text-slate-100">Reports Tray</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-amber-200">Awaiting Mildred review</h3>
              <span className="text-xs text-slate-500">{pendingReports.length}</span>
            </div>
            <div className="space-y-3">
              {pendingReports.length === 0 && <p className="text-sm text-slate-500">Nothing is waiting for review.</p>}
              {pendingReports.map((report) => (
                <article key={report.id} className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">{report.task_title}</p>
                      <p className="mt-1 text-sm text-slate-300">{report.summary || 'Waiting for Mildred review before this becomes trusted completed work.'}</p>
                    </div>
                    <span className="text-xs text-amber-100">Pending</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{report.agent_name}</span>
                    <span>{report.lane_name || 'No lane'}</span>
                    <span>{report.model_used || 'Model not recorded'}</span>
                  </div>
                  <button onClick={() => onApprove(report.id)} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                    Mark reviewed and approved by Mildred
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-200">Approved reports</h3>
              <span className="text-xs text-slate-500">{reports.length}</span>
            </div>
            <div className="space-y-3">
              {reports.length === 0 && <p className="text-sm text-slate-500">Approved reports will appear here after review.</p>}
              {unread.map((report) => (
                <ReportCard key={report.id} report={report} emphasize onAcknowledge={onAcknowledge} />
              ))}
              {acknowledged.map((report) => (
                <ReportCard key={report.id} report={report} onAcknowledge={onAcknowledge} />
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ReportCard({ report, emphasize = false, onAcknowledge }: { report: OfficeReport; emphasize?: boolean; onAcknowledge: (reportId: string) => void }) {
  return (
    <article className={`rounded-2xl border p-4 ${emphasize ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">{report.task_title}</p>
          <p className="mt-1 text-sm text-slate-300">{report.summary || 'No plain-English summary recorded yet.'}</p>
        </div>
        <span className="text-xs text-slate-400">{new Date(report.completed_at).toLocaleDateString()}</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <span>Agent: {report.agent_name}</span>
        <span>Lane: {report.lane_name || 'No lane'}</span>
        <span>Model: {report.model_used || 'Not recorded'}</span>
        <span>Approved: {report.approved_by || 'Mildred'} • {report.approved_at ? new Date(report.approved_at).toLocaleString() : 'just now'}</span>
      </div>
      {!report.acknowledged && (
        <button onClick={() => onAcknowledge(report.id)} className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20">
          Mark as seen
        </button>
      )}
    </article>
  );
}
