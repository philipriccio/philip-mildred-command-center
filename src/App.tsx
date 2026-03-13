import { useEffect, useState, useCallback, useRef } from 'react';
import { OfficePage } from './components/OfficePage';
import { AgentCard } from './components/AgentCard';

interface Agent {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string;
  current_task_id: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  agent_id: string | null;
  lane_id: string | null;
  deadline: number | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  promise_date?: string;
  delivery_notes?: string;
}

interface Evidence {
  id: string;
  task_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: number;
}

interface Approval {
  id: string;
  task_id: string;
  decision: 'approve' | 'request_changes' | 'send_back';
  notes: string | null;
  decided_by: string;
  decided_at: number;
}

interface PRTracking {
  id: string;
  task_id: string;
  pr_number: number;
  pr_url: string;
  status: string;
  ci_status: string;
  last_checked: number;
}

interface Status {
  gateway_connected: number;
  last_update: number;
}

interface Lane {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface TaskCost {
  id: string;
  task_id: string;
  tokens_used: number;
  estimated_cost: number;
  actual_cost: number;
  recorded_at: number;
  task_title?: string;
  lane_id?: string;
  lane_name?: string;
  lane_color?: string;
}

interface DashboardStats {
  totalTasks: number;
  byStatus: {
    backlog: number;
    ready: number;
    in_progress: number;
    verification: number;
    complete: number;
  };
  overdue: number;
  dueSoon: number;
  dueVerySoon: number;
  blocked: number;
  activeAgents: number;
  laneStats: {
    id: string;
    name: string;
    color: string;
    total: number;
    completed: number;
    completionRate: number;
  }[];
  recentActivity: Task[];
}

interface WeeklySummary {
  id: string;
  week_start: number;
  week_end: number;
  summary_json: string;
  generated_at: number;
}

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-700' },
  { id: 'ready', label: 'Ready', color: 'bg-blue-700' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-700' },
  { id: 'verification', label: 'Verification', color: 'bg-purple-700' },
  { id: 'complete', label: 'Complete', color: 'bg-green-700' },
];

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<Status>({ gateway_connected: 0, last_update: 0 });
  const [connected, setConnected] = useState(false);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [selectedLane, setSelectedLane] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'dashboard' | 'office'>('board');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [taskCosts, setTaskCosts] = useState<TaskCost[]>([]);
  const [costTotals, setCostTotals] = useState({ tokens: 0, estimated: 0, actual: 0 });
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  
  // Used in template
  void taskCosts;
  void weeklySummaries;
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [verificationTask, setVerificationTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [prs, setPrs] = useState<PRTracking[]>([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [prOwner, setPrOwner] = useState('');
  const [prRepo, setPrRepo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(() => {
    fetch('http://localhost:3001/api/agents').then(res => res.json()).then(setAgents).catch(console.error);
    fetch('http://localhost:3001/api/tasks').then(res => res.json()).then(setTasks).catch(console.error);
    fetch('http://localhost:3001/api/status').then(res => res.json()).then(setStatus).catch(console.error);
    fetch('http://localhost:3001/api/lanes').then(res => res.json()).then(setLanes).catch(console.error);
    fetch('http://localhost:3001/api/dashboard/stats').then(res => res.json()).then(setDashboardStats).catch(console.error);
    fetch('http://localhost:3001/api/task-costs/summary').then(res => res.json()).then(d => {
      setTaskCosts(d.costs || []);
      setCostTotals(d.totals || { tokens: 0, estimated: 0, actual: 0 });
    }).catch(console.error);
    fetch('http://localhost:3001/api/weekly-summaries').then(res => res.json()).then(setWeeklySummaries).catch(console.error);
  }, []);

  const fetchVerificationData = useCallback((taskId: string) => {
    Promise.all([
      fetch(`http://localhost:3001/api/tasks/${taskId}/evidence`).then(r => r.json()),
      fetch(`http://localhost:3001/api/tasks/${taskId}/approvals`).then(r => r.json()),
      fetch(`http://localhost:3001/api/tasks/${taskId}/pr`).then(r => r.json()),
      fetch(`http://localhost:3001/api/tasks/${taskId}`).then(r => r.json()),
    ]).then(([ev, ap, pr, task]) => {
      setEvidence(ev);
      setApprovals(ap);
      setPrs(pr);
      if (task) setVerificationTask(task);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
    const ws = new WebSocket('ws://localhost:3001/gateway');
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type?.startsWith('task_') || message.type === 'agent_status' || message.type === 'agent_update' || message.type === 'evidence_' || message.type === 'pr_' || message.type === 'task_approved' || message.type === 'changes_requested' || message.type === 'task_sent_back') {
          fetchData();
          if (verificationTask) fetchVerificationData(verificationTask.id);
        }
      } catch (err) { console.error('WS message error:', err); }
    };
    ws.onclose = () => setConnected(false);
    const interval = setInterval(fetchData, 5000);
    return () => { ws.close(); clearInterval(interval); };
  }, [fetchData, fetchVerificationData, verificationTask]);

  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (columnId: string) => {
    if (!draggedTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${draggedTask.id}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: columnId }),
      });
      fetchData();
    } catch (err) { console.error('Failed to move task:', err); }
    setDraggedTask(null);
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await fetch('http://localhost:3001/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      setShowModal(false);
      fetchData();
    } catch (err) { console.error('Failed to create task:', err); }
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!editingTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${editingTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      setEditingTask(null);
      fetchData();
    } catch (err) { console.error('Failed to update task:', err); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try { await fetch(`http://localhost:3001/api/tasks/${taskId}`, { method: 'DELETE' }); fetchData(); }
    catch (err) { console.error('Failed to delete task:', err); }
  };

  // Phase 3: Verification Panel
  const openVerification = (task: Task) => {
    fetchVerificationData(task.id);
  };

  const closeVerification = () => {
    setVerificationTask(null);
    setEvidence([]);
    setApprovals([]);
    setPrs([]);
    setApprovalNotes('');
    setPrUrl('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verificationTask || !e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/evidence`, { method: 'POST', body: formData });
      fetchVerificationData(verificationTask.id);
    } catch (err) { console.error('Upload failed:', err); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteEvidence = async (id: string) => {
    try { await fetch(`http://localhost:3001/api/evidence/${id}`, { method: 'DELETE' }); fetchVerificationData(verificationTask!.id); }
    catch (err) { console.error('Delete failed:', err); }
  };

  const handleApprove = async () => {
    if (!verificationTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      setApprovalNotes('');
      fetchData();
      fetchVerificationData(verificationTask.id);
    } catch (err) { console.error('Approve failed:', err); }
  };

  const handleRequestChanges = async () => {
    if (!verificationTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/request-changes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      setApprovalNotes('');
      fetchData();
      fetchVerificationData(verificationTask.id);
    } catch (err) { console.error('Request changes failed:', err); }
  };

  const handleSendBack = async () => {
    if (!verificationTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/send-back`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      setApprovalNotes('');
      fetchData();
      closeVerification();
    } catch (err) { console.error('Send back failed:', err); }
  };

  const handleLinkPR = async () => {
    if (!verificationTask || !prUrl) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/pr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_url: prUrl, owner: prOwner, repo: prRepo }),
      });
      setPrUrl('');
      setPrOwner('');
      setPrRepo('');
      fetchVerificationData(verificationTask.id);
    } catch (err) { console.error('Link PR failed:', err); }
  };

  const handleRefreshPRs = async () => {
    if (!verificationTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${verificationTask.id}/pr/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: prOwner, repo: prRepo }),
      });
      fetchVerificationData(verificationTask.id);
    } catch (err) { console.error('Refresh PRs failed:', err); }
  };

  const handleUnlinkPR = async (id: string) => {
    try { await fetch(`http://localhost:3001/api/pr/${id}`, { method: 'DELETE' }); fetchVerificationData(verificationTask!.id); }
    catch (err) { console.error('Unlink PR failed:', err); }
  };

  // Filter tasks by selected lane
  const filteredTasks = selectedLane === 'all' ? tasks : tasks.filter(t => t.lane_id === selectedLane);
  const tasksByColumn = COLUMNS.reduce((acc, col) => { acc[col.id] = filteredTasks.filter(t => t.status === col.id); return acc; }, {} as Record<string, Task[]>);
  
  // Deadline alerts
  const nowMs = Date.now();
  const in48h = nowMs + 48 * 60 * 60 * 1000;
  const in24h = nowMs + 24 * 60 * 60 * 1000;
  const overdueTasks = filteredTasks.filter(t => t.deadline && t.deadline < nowMs && t.status !== 'complete');
  const dueSoonTasks = filteredTasks.filter(t => t.deadline && t.deadline >= nowMs && t.deadline <= in48h && t.status !== 'complete');
  const dueVerySoonTasks = filteredTasks.filter(t => t.deadline && t.deadline >= nowMs && t.deadline <= in24h && t.status !== 'complete');
  
  const getAgentName = (agentId: string | null) => { if (!agentId) return null; return agents.find(a => a.id === agentId)?.name || agentId; };
  const formatDeadline = (ts: number | null) => { if (!ts) return null; const date = new Date(ts); const diffDays = Math.ceil((date.getTime() - nowMs) / (1000 * 60 * 60 * 24)); return { date: date.toLocaleDateString(), isOverdue: diffDays < 0, isDueSoon: diffDays >= 0 && diffDays <= 2, isDueVerySoon: diffDays >= 0 && diffDays <= 1 }; };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Philip-Mildred Command Center</h1>
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button onClick={() => setViewMode('board')} className={`px-3 py-1 rounded text-sm ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Board</button>
              <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1 rounded text-sm ${viewMode === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Dashboard</button>
              <button onClick={() => setViewMode('office')} className={`px-3 py-1 rounded text-sm ${viewMode === 'office' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>🏢 Office</button>
            </div>
            {/* Lane Selector */}
            <select value={selectedLane} onChange={e => setSelectedLane(e.target.value)} className="bg-slate-700 rounded px-3 py-1 text-sm">
              <option value="all">All Lanes</option>
              {lanes.map(lane => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.gateway_connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">Gateway: {status.gateway_connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">WS: {connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Deadline Alerts Banner */}
        {(overdueTasks.length > 0 || dueVerySoonTasks.length > 0) && (
          <div className="mb-6 p-4 rounded-lg border">
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <span className="text-xl">🚨</span>
                <span className="font-medium">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}!</span>
              </div>
            )}
            {dueVerySoonTasks.length > 0 && (
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <span className="text-xl">⚠️</span>
                <span className="font-medium">{dueVerySoonTasks.length} due within 24h</span>
              </div>
            )}
            {dueSoonTasks.length > 0 && (
              <div className="flex items-center gap-2 text-yellow-400">
                <span className="text-xl">📅</span>
                <span className="font-medium">{dueSoonTasks.length} due within 48h</span>
              </div>
            )}
          </div>
        )}

        {/* Dashboard View */}
        {viewMode === 'dashboard' && dashboardStats && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Dashboard</h2>
              <button onClick={() => setShowWeeklySummary(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">📊 Generate Weekly Summary</button>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold">{dashboardStats.totalTasks}</div>
                <div className="text-sm text-slate-400">Total Tasks</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-500">{dashboardStats.byStatus.complete}</div>
                <div className="text-sm text-slate-400">Completed</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-500">{dashboardStats.byStatus.in_progress}</div>
                <div className="text-sm text-slate-400">In Progress</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-500">{dashboardStats.overdue}</div>
                <div className="text-sm text-slate-400">Overdue</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-500">{dashboardStats.dueSoon}</div>
                <div className="text-sm text-slate-400">Due Soon</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-500">{dashboardStats.activeAgents}</div>
                <div className="text-sm text-slate-400">Active Agents</div>
              </div>
            </div>

            {/* Lane Stats */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="font-semibold mb-4">Portfolio Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dashboardStats.laneStats.map(lane => (
                  <div key={lane.id} className="bg-slate-700 rounded-lg p-4" style={{ borderLeft: `4px solid ${lane.color}` }}>
                    <div className="font-medium mb-2">{lane.name}</div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">{lane.completed}/{lane.total} tasks</span>
                      <span className="text-green-400">{lane.completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${lane.completionRate}%`, backgroundColor: lane.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Summary */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="font-semibold mb-4">Cost Tracking</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="text-2xl font-bold">{costTotals.tokens.toLocaleString()}</div>
                  <div className="text-sm text-slate-400">Tokens Used</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="text-2xl font-bold">${costTotals.estimated.toFixed(2)}</div>
                  <div className="text-sm text-slate-400">Estimated Cost</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-500">${costTotals.actual.toFixed(2)}</div>
                  <div className="text-sm text-slate-400">Actual Cost</div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {dashboardStats.recentActivity.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center justify-between bg-slate-700 rounded p-3">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-slate-400">{new Date(task.updated_at).toLocaleString()}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${task.status === 'complete' ? 'bg-green-600' : task.status === 'in_progress' ? 'bg-amber-600' : 'bg-slate-600'}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Board View */}
        {viewMode === 'board' && (
        <>
        {/* Agent Panel */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-slate-400">No agents connected</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          )}
        </section>

        {/* Kanban Board */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">+ New Task</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map(column => (
              <div key={column.id} className="flex-shrink-0 w-72" onDragOver={handleDragOver} onDrop={() => handleDrop(column.id)}>
                <div className={`${column.color} rounded-t-lg px-4 py-2 font-semibold`}>
                  {column.label}
                  <span className="ml-2 text-sm opacity-75">({tasksByColumn[column.id]?.length || 0})</span>
                </div>
                <div className="bg-slate-800 rounded-b-lg p-2 min-h-[200px] border border-t-0 border-slate-700">
                  {tasksByColumn[column.id]?.map(task => (
                    <div key={task.id} draggable onDragStart={() => handleDragStart(task)}
                      className="bg-slate-700 rounded p-3 mb-2 cursor-move hover:bg-slate-600 transition-colors"
                      onClick={() => column.id === 'verification' ? openVerification(task) : setEditingTask(task)}>
                      <h4 className="font-medium mb-1">{task.title}</h4>
                      {task.description && <p className="text-sm text-slate-400 mb-2 line-clamp-2">{task.description}</p>}
                      {task.agent_id && <div className="text-xs text-blue-400 mb-1">👤 {getAgentName(task.agent_id)}</div>}
                      {task.deadline && <div className={`text-xs mb-1 ${formatDeadline(task.deadline)?.isOverdue ? 'text-red-400' : 'text-slate-400'}`}>📅 {formatDeadline(task.deadline)?.date}</div>}
                      {task.blocker_reason && <div className="text-xs text-red-400 bg-red-900/30 rounded px-2 py-1 mt-1">🚫 {task.blocker_reason}</div>}
                      {column.id === 'verification' && <div className="text-xs text-purple-400 mt-2">🔍 Click to verify</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        </>
        )}

        {/* Office View */}
        {viewMode === 'office' && (
          <OfficePage />
        )}
      </main>

      {/* Weekly Summary Modal */}
      {showWeeklySummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-2xl border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Weekly Summary</h2>
              <button onClick={() => setShowWeeklySummary(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-slate-400 mb-4">Generate a weekly summary report with:</p>
              <ul className="list-disc list-inside text-slate-300 mb-6 space-y-1">
                <li>Completed, in-progress, and blocked tasks</li>
                <li>Cost summary for the week</li>
                <li>Upcoming deadlines (next 7 days)</li>
              </ul>
              <button onClick={async () => {
                await fetch('http://localhost:3001/api/weekly-summaries/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
                });
                fetchData();
                setShowWeeklySummary(false);
              }} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium">Generate Summary</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {(showModal || editingTask) && (
        <TaskModal task={editingTask} agents={agents} lanes={lanes} onSave={editingTask ? handleUpdateTask : handleCreateTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onDelete={editingTask ? () => { handleDeleteTask(editingTask.id); setEditingTask(null); } : undefined} />
      )}

      {/* Phase 3: Verification Panel */}
      {verificationTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Verification: {verificationTask.title}</h2>
              <button onClick={closeVerification} className="text-slate-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Task Info */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-2">Task Details</h3>
                <p className="text-slate-300">{verificationTask.description || 'No description'}</p>
                {verificationTask.promise_date && (
                  <p className="text-sm text-yellow-400 mt-2">📌 Promise Date: {verificationTask.promise_date}</p>
                )}
                {verificationTask.delivery_notes && (
                  <p className="text-sm text-blue-400 mt-2">📝 Delivery Notes: {verificationTask.delivery_notes}</p>
                )}
              </div>

              {/* GitHub PRs */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">GitHub PRs</h3>
                  <button onClick={handleRefreshPRs} className="text-xs bg-slate-600 hover:bg-slate-500 px-2 py-1 rounded">🔄 Refresh</button>
                </div>
                
                {prs.length === 0 ? (
                  <p className="text-slate-400 text-sm">No PRs linked</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {prs.map(pr => (
                      <div key={pr.id} className="flex items-center justify-between bg-slate-600 rounded p-2">
                        <div>
                          <a href={pr.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            PR #{pr.pr_number}
                          </a>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${pr.status === 'merged' ? 'bg-purple-600' : pr.status === 'closed' ? 'bg-red-600' : 'bg-green-600'}`}>
                            {pr.status}
                          </span>
                          <span className={`ml-1 text-xs px-2 py-0.5 rounded ${pr.ci_status === 'passing' ? 'bg-green-600' : pr.ci_status === 'failing' ? 'bg-red-600' : 'bg-yellow-600'}`}>
                            CI: {pr.ci_status}
                          </span>
                        </div>
                        <button onClick={() => handleUnlinkPR(pr.id)} className="text-red-400 hover:text-red-300 text-sm">Unlink</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <input type="text" placeholder="PR URL (e.g., https://github.com/user/repo/pull/123)" value={prUrl}
                    onChange={e => setPrUrl(e.target.value)} className="flex-1 bg-slate-600 rounded px-3 py-1 text-sm" />
                  <input type="text" placeholder="Owner" value={prOwner} onChange={e => setPrOwner(e.target.value)} className="w-24 bg-slate-600 rounded px-3 py-1 text-sm" />
                  <input type="text" placeholder="Repo" value={prRepo} onChange={e => setPrRepo(e.target.value)} className="w-24 bg-slate-600 rounded px-3 py-1 text-sm" />
                  <button onClick={handleLinkPR} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm">Link</button>
                </div>
              </div>

              {/* Evidence */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Evidence</h3>
                
                {evidence.length === 0 ? (
                  <p className="text-slate-400 text-sm">No evidence uploaded</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {evidence.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between bg-slate-600 rounded p-2">
                        <div className="flex items-center gap-2">
                          {ev.mime_type.startsWith('image/') ? '🖼️' : ev.mime_type === 'application/pdf' ? '📄' : '📎'}
                          <span className="text-sm">{ev.original_name}</span>
                          <span className="text-xs text-slate-400">({Math.round(ev.size / 1024)}KB)</span>
                        </div>
                        <div className="flex gap-2">
                          <a href={`http://localhost:3001/api/evidence/${ev.id}/download`} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm">Download</a>
                          <button onClick={() => handleDeleteEvidence(ev.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.txt,.log"
                  className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
              </div>

              {/* Approval History */}
              {approvals.length > 0 && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h3 className="font-medium mb-3">Approval History</h3>
                  <div className="space-y-2">
                    {approvals.map(ap => (
                      <div key={ap.id} className="bg-slate-600 rounded p-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${ap.decision === 'approve' ? 'bg-green-600' : ap.decision === 'request_changes' ? 'bg-yellow-600' : 'bg-red-600'}`}>
                            {ap.decision.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">by {ap.decided_by}</span>
                          <span className="text-xs text-slate-500">{new Date(ap.decided_at).toLocaleString()}</span>
                        </div>
                        {ap.notes && <p className="text-sm text-slate-300 mt-1">{ap.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Actions */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Philip's Approval</h3>
                <textarea placeholder="Notes (optional)..." value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)}
                  className="w-full bg-slate-600 rounded px-3 py-2 text-white h-20 mb-3" />
                <div className="flex gap-3">
                  <button onClick={handleApprove} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-medium">✅ Approve</button>
                  <button onClick={handleRequestChanges} className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded font-medium">🔄 Request Changes</button>
                  <button onClick={handleSendBack} className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded font-medium">↩️ Send Back to Backlog</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Modal Component
interface TaskModalProps {
  task: Task | null;
  agents: Agent[];
  lanes: Lane[];
  onSave: (data: Partial<Task>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

function TaskModal({ task, agents, lanes, onSave, onClose, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'backlog');
  const [agentId, setAgentId] = useState(task?.agent_id || '');
  const [laneId, setLaneId] = useState(task?.lane_id || '');
  const [deadline, setDeadline] = useState(task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
  const [blockerReason, setBlockerReason] = useState(task?.blocker_reason || '');
  const [promiseDate, setPromiseDate] = useState(task?.promise_date || '');
  const [deliveryNotes, setDeliveryNotes] = useState(task?.delivery_notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title, description, status,
      agent_id: agentId || null,
      lane_id: laneId || null,
      deadline: deadline ? new Date(deadline).getTime() : null,
      blocker_reason: blockerReason || null,
      promise_date: promiseDate || undefined,
      delivery_notes: deliveryNotes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{task ? 'Edit Task' : 'New Task'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white h-20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white">
                {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Assign To</label>
              <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white">
                <option value="">Unassigned</option>
                {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Lane</label>
              <select value={laneId} onChange={e => setLaneId(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white">
                <option value="">No Lane</option>
                {lanes.map(lane => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Deadline</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Promise Date</label>
            <input type="date" value={promiseDate} onChange={e => setPromiseDate(e.target.value)} className="w-full bg-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Blocker Reason</label>
            <input type="text" value={blockerReason} onChange={e => setBlockerReason(e.target.value)} placeholder="What's blocking this task?"
              className="w-full bg-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Delivery Notes</label>
            <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Post-completion learnings..."
              className="w-full bg-slate-700 rounded px-3 py-2 text-white h-16" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium">{task ? 'Save Changes' : 'Create Task'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded">Cancel</button>
            {onDelete && <button type="button" onClick={onDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded">Delete</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
