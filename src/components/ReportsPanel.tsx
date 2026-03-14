interface OfficeReport {
  id: string;
  agent_id: string;
  agent_name: string;
  task_title: string;
  completed_at: number;
  acknowledged: number;
}

export function ReportsPanel({ reports, onAcknowledge, isOpen, onClose }: { reports: OfficeReport[]; onAcknowledge: (reportId: string) => void; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const unread = reports.filter((report) => !report.acknowledged);
  const read = reports.filter((report) => report.acknowledged);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Office visibility</p>
            <h2 className="text-lg font-semibold text-slate-100">Reports inbox</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-rose-300">Unread</h3>
            <div className="space-y-3">
              {unread.length === 0 && <p className="text-sm text-slate-500">No unread reports.</p>}
              {unread.map((report) => (
                <div key={report.id} className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-100">{report.task_title}</p>
                    <span className="text-xs text-slate-400">{new Date(report.completed_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{report.agent_name}</p>
                  <button onClick={() => onAcknowledge(report.id)} className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">Acknowledge</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Read</h3>
            <div className="space-y-3">
              {read.length === 0 && <p className="text-sm text-slate-500">No acknowledged reports yet.</p>}
              {read.map((report) => (
                <div key={report.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-100">{report.task_title}</p>
                    <span className="text-xs text-slate-500">{new Date(report.completed_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{report.agent_name}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
