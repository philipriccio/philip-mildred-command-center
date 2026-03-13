import { useEffect, useRef, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  position: { x: number; y: number };
  targetPosition: { x: number; y: number };
  state: 'offline' | 'entering' | 'idle' | 'working' | 'completing' | 'leaving';
  currentTask?: string;
  taskProgress?: number;
  color: string;
}

interface Report {
  id: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  completedAt: number;
  acknowledged: boolean;
}

// Desk positions (grid-based, 32px cells)
const DESK_POSITIONS = {
  dev: { x: 3, y: 4 },      // Top-left
  mildred: { x: 18, y: 4 }, // Top-right
  content: { x: 3, y: 12 }, // Bottom-left
  research: { x: 18, y: 12 }, // Bottom-right
};

const CELL_SIZE = 32;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Agent colors (placeholder sprites)
const AGENT_COLORS: Record<string, string> = {
  'dev': '#808080',       // Grey
  'mildred': '#008080',   // Teal
  'content': '#800080',   // Purple
  'research': '#8B4513', // Brown
};

const STATE_LABELS: Record<string, string> = {
  'offline': 'Offline',
  'entering': 'Arriving...',
  'idle': 'Idle',
  'working': 'Working',
  'completing': 'Delivering...',
  'leaving': 'Leaving...',
};

interface OfficeCanvasProps {
  ws: WebSocket | null;
  onAgentClick?: (agent: Agent) => void;
}

export function OfficeCanvas({ ws, onAgentClick }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Initialize agents from server
  useEffect(() => {
    fetch('http://localhost:3001/api/office/agents')
      .then(res => res.json())
      .then(data => {
        if (data.agents) {
          setAgents(data.agents.map((a: any) => ({
            ...a,
            position: { x: a.position_x, y: a.position_y },
            targetPosition: { x: a.position_x, y: a.position_y },
            color: AGENT_COLORS[a.id] || '#888888',
          })));
        }
      })
      .catch(console.error);

    fetch('http://localhost:3001/api/office/reports')
      .then(res => res.json())
      .then(data => setReports(data.reports || []))
      .catch(console.error);
  }, []);

  // WebSocket updates
  useEffect(() => {
    if (!ws) return;
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'agent.state') {
          setAgents(prev => prev.map(a => 
            a.id === msg.agentId 
              ? { ...a, state: msg.state, currentTask: msg.task, taskProgress: msg.progress }
              : a
          ));
        } else if (msg.type === 'agent.move') {
          setAgents(prev => prev.map(a => 
            a.id === msg.agentId 
              ? { ...a, targetPosition: { x: msg.to.x, y: msg.to.y } }
              : a
          ));
        } else if (msg.type === 'agent.enter') {
          setAgents(prev => [...prev, {
            id: msg.agentId,
            name: msg.agentId,
            position: { x: 10, y: 20 }, // Start at door
            targetPosition: DESK_POSITIONS[msg.agentId as keyof typeof DESK_POSITIONS] || { x: 10, y: 10 },
            state: 'entering',
            color: AGENT_COLORS[msg.agentId] || '#888888',
          }]);
        } else if (msg.type === 'agent.leave') {
          setAgents(prev => prev.filter(a => a.id !== msg.agentId));
        } else if (msg.type === 'report.new') {
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
  }, [ws]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (time: number) => {
      
      lastTimeRef.current = time;

      // Update agent positions (lerp towards target)
      setAgents(prev => prev.map(agent => {
        const dx = agent.targetPosition.x * CELL_SIZE - agent.position.x * CELL_SIZE;
        const dy = agent.targetPosition.y * CELL_SIZE - agent.position.y * CELL_SIZE;
        const speed = 0.05;
        
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          return {
            ...agent,
            position: {
              x: agent.position.x + dx * speed,
              y: agent.position.y + dy * speed,
            },
          };
        }
        
        // Update state when arrived
        if (agent.state === 'entering' && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          return { ...agent, state: 'working' as const };
        }
        if (agent.state === 'completing' && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          return { ...agent, state: 'idle' as const };
        }
        
        return agent;
      }));

      // Draw
      drawOffice(ctx, agents, selectedAgent);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [agents, selectedAgent]);

  const drawOffice = (ctx: CanvasRenderingContext2D, agentList: Agent[], selected: string | null) => {
    // Clear
    ctx.fillStyle = '#f5f5dc'; // Beige wall
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Floor (blue carpet)
    ctx.fillStyle = '#4169e1'; // Royal blue
    ctx.fillRect(0, 100, CANVAS_WIDTH, CANVAS_HEIGHT - 100);

    // Window
    ctx.fillStyle = '#87ceeb'; // Sky blue
    ctx.fillRect(350, 20, 100, 80);
    ctx.strokeStyle = '#8b4513'; // Brown frame
    ctx.lineWidth = 4;
    ctx.strokeRect(350, 20, 100, 80);
    // Window cross
    ctx.beginPath();
    ctx.moveTo(400, 20);
    ctx.lineTo(400, 100);
    ctx.moveTo(350, 60);
    ctx.lineTo(450, 60);
    ctx.stroke();

    // Clock
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(700, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Clock hands
    ctx.beginPath();
    ctx.moveTo(700, 60);
    ctx.lineTo(700, 40); // Hour
    ctx.moveTo(700, 60);
    ctx.lineTo(720, 60); // Minute
    ctx.stroke();

    // Desks
    const deskY = 130;
    drawDesk(ctx, 100, deskY, 'Dev', '#808080');
    drawDesk(ctx, 580, deskY, 'Mildred', '#008080');
    drawDesk(ctx, 100, 380, 'Content', '#800080');
    drawDesk(ctx, 580, 380, 'Research', '#8B4513');

    // Reports Inbox
    const inboxX = 350;
    const inboxY = 540;
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(inboxX, inboxY, 100, 40);
    ctx.fillStyle = '#654321';
    ctx.fillRect(inboxX + 5, inboxY + 5, 90, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText('📥 REPORTS', inboxX + 10, inboxY + 25);
    // Report count badge
    const unackCount = reports.filter(r => !r.acknowledged).length;
    if (unackCount > 0) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(inboxX + 90, inboxY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(String(unackCount), inboxX + 86, inboxY + 4);
    }

    // Agents
    agentList.forEach(agent => {
      drawAgent(ctx, agent, agent.id === selected);
    });
  };

  const drawDesk = (ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) => {
    // Desk top
    ctx.fillStyle = '#deb887'; // Burlywood
    ctx.fillRect(x, y, 120, 60);
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 120, 60);
    
    // Chair
    ctx.fillStyle = color;
    ctx.fillRect(x + 45, y + 60, 30, 20);
    
    // Label
    ctx.fillStyle = '#000';
    ctx.font = '14px monospace';
    ctx.fillText(label, x + 30, y + 45);
  };

  const drawAgent = (ctx: CanvasRenderingContext2D, agent: Agent, selected: boolean) => {
    const x = agent.position.x * CELL_SIZE;
    const y = agent.position.y * CELL_SIZE;
    
    // Idle bob animation
    const bob = agent.state === 'working' ? Math.sin(Date.now() / 200) * 2 : 0;
    
    // Body (placeholder sprite - colored square)
    ctx.fillStyle = agent.color;
    ctx.fillRect(x, y + bob, 28, 28);
    
    // Selection highlight
    if (selected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y + bob - 2, 32, 32);
    }
    
    // Name label
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(agent.name, x, y + bob - 5);
    
    // Working indicator
    if (agent.state === 'working') {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(x + 25, y + bob + 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Task progress bar
    if (agent.currentTask && agent.taskProgress !== undefined) {
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y + bob + 32, 28, 6);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(x, y + bob + 32, 28 * (agent.taskProgress / 100), 6);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / CELL_SIZE;
    const y = (e.clientY - rect.top) / CELL_SIZE;
    
    // Check if clicked on an agent
    const clicked = agents.find(a => {
      const ax = a.position.x;
      const ay = a.position.y;
      return Math.abs(x - ax) < 1 && Math.abs(y - ay) < 1;
    });
    
    if (clicked) {
      setSelectedAgent(clicked.id);
      onAgentClick?.(clicked);
    } else {
      setSelectedAgent(null);
    }
  };

  const selectedAgentData = agents.find(a => a.id === selectedAgent);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        className="border-4 border-slate-700 rounded-lg cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Dialogue Bubble */}
      {selectedAgentData && selectedAgentData.currentTask && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white border-2 border-black rounded-lg p-3 shadow-lg max-w-xs">
          <div className="text-sm font-bold">{selectedAgentData.name}</div>
          <div className="text-xs">{selectedAgentData.currentTask.slice(0, 30)}</div>
          {selectedAgentData.taskProgress !== undefined && (
            <div className="mt-1 text-xs text-green-600">
              Progress: {selectedAgentData.taskProgress}%
            </div>
          )}
          <div className="text-xs text-gray-500">{STATE_LABELS[selectedAgentData.state]}</div>
        </div>
      )}
    </div>
  );
}

export default OfficeCanvas;
