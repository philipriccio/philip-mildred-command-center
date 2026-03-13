import { useEffect, useState } from 'react';
import { OfficeCanvas } from './OfficeCanvas';
import { ReportsPanel } from './ReportsPanel';

interface Agent {
  id: string;
  name: string;
  position: { x: number; y: number };
  state: string;
  currentTask?: string;
}

interface Report {
  id: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  completedAt: number;
  acknowledged: boolean;
}

export function OfficePage() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [showReports, setShowReports] = useState(false);

  // Initialize WebSocket
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3001/ws/office');
    
    websocket.onopen = () => {
      console.log('Office WS connected');
      setConnected(true);
    };
    
    websocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'report.new') {
          setReports(prev => [...prev, {
            id: msg.reportId,
            agentId: msg.agentId,
            agentName: msg.agentName,
            taskTitle: msg.taskTitle,
            completedAt: Date.now(),
            acknowledged: false,
          }]);
        }
      } catch (err) {
        console.error('Office WS error:', err);
      }
    };
    
    websocket.onclose = () => {
      console.log('Office WS disconnected');
      setConnected(false);
    };

    setWs(websocket);

    // Load initial reports
    fetch('http://localhost:3001/api/office/reports')
      .then(res => res.json())
      .then(data => setReports(data.reports || []))
      .catch(console.error);

    return () => websocket.close();
  }, []);

  const handleAgentClick = (agent: Agent) => {
    console.log('Clicked agent:', agent);
  };

  const handleAcknowledgeReport = async (reportId: string) => {
    try {
      await fetch(`http://localhost:3001/api/office/report/${reportId}/acknowledge`, {
        method: 'POST',
      });
      setReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, acknowledged: true } : r
      ));
    } catch (err) {
      console.error('Failed to acknowledge report:', err);
    }
  };

  const unackCount = reports.filter(r => !r.acknowledged).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🏢 Office</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setShowReports(!showReports)}
              className="relative px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
            >
              📥 Reports
              {unackCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unackCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Office View */}
      <main className="p-6">
        <div className="flex justify-center">
          <OfficeCanvas ws={ws} onAgentClick={handleAgentClick} />
        </div>
        
        {/* Instructions */}
        <div className="mt-6 text-center text-slate-400 text-sm">
          <p>Click on an agent to see their current task • Agents walk to their desks when assigned work</p>
          <p>Completed tasks appear in the Reports inbox</p>
        </div>
      </main>

      {/* Reports Panel */}
      <ReportsPanel
        reports={reports}
        onAcknowledge={handleAcknowledgeReport}
        isOpen={showReports}
        onClose={() => setShowReports(false)}
      />
    </div>
  );
}

export default OfficePage;
