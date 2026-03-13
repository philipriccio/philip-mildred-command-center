interface Agent {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string;
}

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const statusColors: Record<string, string> = {
    idle: 'bg-gray-500',
    running: 'bg-green-500',
    busy: 'bg-yellow-500',
    error: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  const statusColor = statusColors[agent.status] || statusColors.unknown;
  
  const lastSeen = agent.last_seen 
    ? new Date(agent.last_seen).toLocaleTimeString() 
    : 'Never';

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-3 h-3 rounded-full ${statusColor}`} />
        <span className="font-semibold text-white">{agent.name}</span>
      </div>
      <div className="text-sm text-slate-400 space-y-1">
        <p>Status: <span className="text-slate-300">{agent.status}</span></p>
        <p>Last seen: <span className="text-slate-300">{lastSeen}</span></p>
      </div>
    </div>
  );
}
