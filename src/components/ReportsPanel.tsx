
interface Report {
  id: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  completedAt: number;
  acknowledged: boolean;
}

interface ReportsPanelProps {
  reports: Report[];
  onAcknowledge: (reportId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportsPanel({ reports, onAcknowledge, isOpen, onClose }: ReportsPanelProps) {
  const unacknowledged = reports.filter(r => !r.acknowledged);
  const acknowledged = reports.filter(r => r.acknowledged);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-800 border-l border-slate-700 shadow-xl z-50 transform transition-transform">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold">📥 Reports Inbox</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
      </div>

      <div className="p-4 overflow-y-auto h-full pb-20">
        {/* Unacknowledged Reports */}
        {unacknowledged.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-red-400 mb-3">
              🔴 Unread ({unacknowledged.length})
            </h3>
            <div className="space-y-3">
              {unacknowledged.map(report => (
                <div key={report.id} className="bg-slate-700 rounded-lg p-3 border-l-4 border-red-500">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ 
                      color: report.agentName === 'mildred' ? '#008080' : 
                             report.agentName === 'dev' ? '#808080' :
                             report.agentName === 'content' ? '#800080' : '#8B4513'
                    }}>
                      {report.agentName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(report.completedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-white mb-2">{report.taskTitle}</p>
                  <button 
                    onClick={() => onAcknowledge(report.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1 rounded"
                  >
                    ✓ Acknowledge
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acknowledged Reports */}
        {acknowledged.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">
              ✓ Read ({acknowledged.length})
            </h3>
            <div className="space-y-2">
              {acknowledged.slice(0, 10).map(report => (
                <div key={report.id} className="bg-slate-700/50 rounded-lg p-2 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ 
                      color: report.agentName === 'mildred' ? '#008080' : 
                             report.agentName === 'dev' ? '#808080' :
                             report.agentName === 'content' ? '#800080' : '#8B4513'
                    }}>
                      {report.agentName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(report.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{report.taskTitle}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reports.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            <p>No reports yet</p>
            <p className="text-sm">Completed tasks will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPanel;
