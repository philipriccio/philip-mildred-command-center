import { useEffect, useState } from 'react';
import { OfficeCanvas } from './OfficeCanvas';
import { ReportsPanel } from './ReportsPanel';

interface OfficeAgent {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  state: string;
  current_task: string | null;
  task_progress: number;
  color: string;
  office_enabled: number;
}

interface OfficeReport {
  id: string;
  agent_id: string;
  agent_name: string;
  task_title: string;
  completed_at: number;
  acknowledged: number;
}

export function OfficePage({ apiBase, wsUrl }: { apiBase: string; wsUrl: string }) {
  const [reports, setReports] = useState<OfficeReport[]>([]);
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [connected, setConnected] = useState(false);
  const [showReports, setShowReports] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/office/agents`).then((res) => res.json()).then((data) => setAgents(data.agents || [])).catch(console.error);
    fetch(`${apiBase}/api/office/reports`).then((res) => res.json()).then((data) => setReports(data.reports || [])).catch(console.error);

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string; agents?: OfficeAgent[]; reportId?: string; agentId?: string; agentName?: string; taskTitle?: string; state?: string; task?: string; progress?: number; to?: { x: number; y: number } };
        if (message.type === 'office.init' && message.agents) {
          setAgents(message.agents);
        }
        if (message.type === 'agent.state' && message.agentId) {
          setAgents((prev) => prev.map((agent) => agent.id === message.agentId ? { ...agent, state: message.state || agent.state, current_task: message.task || agent.current_task, task_progress: message.progress ?? agent.task_progress } : agent));
        }
        if (message.type === 'agent.move' && message.agentId && message.to) {
          setAgents((prev) => prev.map((agent) => agent.id === message.agentId ? { ...agent, position_x: message.to!.x, position_y: message.to!.y } : agent));
        }
        if (message.type === 'report.new' && message.reportId && message.agentId && message.agentName && message.taskTitle) {
          setReports((prev) => [{ id: message.reportId!, agent_id: message.agentId!, agent_name: message.agentName!, task_title: message.taskTitle!, completed_at: Date.now(), acknowledged: 0 }, ...prev]);
        }
      } catch (error) {
        console.error('Office websocket error', error);
      }
    };

    return () => ws.close();
  }, [apiBase, wsUrl]);

  const acknowledgeReport = async (reportId: string) => {
    await fetch(`${apiBase}/api/office/report/${reportId}/acknowledge`, { method: 'POST' });
    setReports((prev) => prev.map((report) => report.id === reportId ? { ...report, acknowledged: 1 } : report));
  };

  const unreadCount = reports.filter((report) => !report.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/80 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Visibility-only office view</p>
          <h2 className="text-xl font-semibold text-slate-100">Office</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            {connected ? 'Office realtime connected' : 'Office realtime disconnected'}
          </div>
          <button onClick={() => setShowReports((prev) => !prev)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700">
            Reports {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
        <OfficeCanvas agents={agents} />
      </div>
      <ReportsPanel reports={reports} isOpen={showReports} onClose={() => setShowReports(false)} onAcknowledge={acknowledgeReport} />
    </div>
  );
}
