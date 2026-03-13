import { useEffect, useState } from 'react';
import { AgentCard } from './components/AgentCard';

interface Agent {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string;
}

interface Status {
  gateway_connected: number;
  last_update: number;
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState<Status>({ gateway_connected: 0, last_update: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Fetch initial data
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(setStatus)
      .catch(console.error);

    fetch('http://localhost:3001/api/agents')
      .then(res => res.json())
      .then(setAgents)
      .catch(console.error);

    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3001/gateway');
    
    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'agent_status' || message.type === 'agent_update') {
          // Refresh agents list
          fetch('http://localhost:3001/api/agents')
            .then(res => res.json())
            .then(setAgents)
            .catch(console.error);
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetch('http://localhost:3001/api/status')
        .then(res => res.json())
        .then(setStatus)
        .catch(console.error);
      
      fetch('http://localhost:3001/api/agents')
        .then(res => res.json())
        .then(setAgents)
        .catch(console.error);
    }, 5000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Philip-Mildred Command Center</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.gateway_connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">
                Gateway: {status.gateway_connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">
                WS: {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Agent Panel */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-slate-400">No agents connected</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </section>

        {/* Kanban Area (placeholder) */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Tasks</h2>
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">Kanban board coming soon</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
