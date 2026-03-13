import { useEffect, useState, useCallback } from 'react';
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
  deadline: number | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
}

interface Status {
  gateway_connected: number;
  last_update: number;
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
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const fetchData = useCallback(() => {
    fetch('http://localhost:3001/api/agents')
      .then(res => res.json())
      .then(setAgents)
      .catch(console.error);
    
    fetch('http://localhost:3001/api/tasks')
      .then(res => res.json())
      .then(setTasks)
      .catch(console.error);
      
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(setStatus)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();

    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3001/gateway');
    
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type?.startsWith('task_') || message.type === 'agent_status' || message.type === 'agent_update') {
          fetchData();
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    };
    ws.onclose = () => setConnected(false);

    const interval = setInterval(fetchData, 5000);
    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTask) return;
    
    try {
      await fetch(`http://localhost:3001/api/tasks/${draggedTask.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: columnId }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to move task:', err);
    }
    setDraggedTask(null);
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!editingTask) return;
    try {
      await fetch(`http://localhost:3001/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      setEditingTask(null);
      fetchData();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`http://localhost:3001/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const tasksByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
    return acc;
  }, {} as Record<string, Task[]>);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || agentId;
  };

  const formatDeadline = (ts: number | null) => {
    if (!ts) return null;
    const date = new Date(ts);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { date: date.toLocaleDateString(), isOverdue: diffDays < 0 };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Philip-Mildred Command Center</h1>
          <div className="flex items-center gap-4">
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
        {/* Agent Panel */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-slate-400">No agents connected</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </section>

        {/* Kanban Board */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              + New Task
            </button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map(column => (
              <div
                key={column.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
                <div className={`${column.color} rounded-t-lg px-4 py-2 font-semibold`}>
                  {column.label}
                  <span className="ml-2 text-sm opacity-75">({tasksByColumn[column.id]?.length || 0})</span>
                </div>
                <div className="bg-slate-800 rounded-b-lg p-2 min-h-[200px] border border-t-0 border-slate-700">
                  {tasksByColumn[column.id]?.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="bg-slate-700 rounded p-3 mb-2 cursor-move hover:bg-slate-600 transition-colors"
                      onClick={() => setEditingTask(task)}
                    >
                      <h4 className="font-medium mb-1">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-slate-400 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      {task.agent_id && (
                        <div className="text-xs text-blue-400 mb-1">👤 {getAgentName(task.agent_id)}</div>
                      )}
                      {task.deadline && (
                        <div className={`text-xs mb-1 ${formatDeadline(task.deadline)?.isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                          📅 {formatDeadline(task.deadline)?.date}
                        </div>
                      )}
                      {task.blocker_reason && (
                        <div className="text-xs text-red-400 bg-red-900/30 rounded px-2 py-1 mt-1">
                          🚫 {task.blocker_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Task Modal */}
      {(showModal || editingTask) && (
        <TaskModal
          task={editingTask}
          agents={agents}
          onSave={editingTask ? handleUpdateTask : handleCreateTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onDelete={editingTask ? () => { handleDeleteTask(editingTask.id); setEditingTask(null); } : undefined}
        />
      )}
    </div>
  );
}

// Task Modal Component
interface TaskModalProps {
  task: Task | null;
  agents: Agent[];
  onSave: (data: Partial<Task>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

function TaskModal({ task, agents, onSave, onClose, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'backlog');
  const [agentId, setAgentId] = useState(task?.agent_id || '');
  const [deadline, setDeadline] = useState(task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
  const [blockerReason, setBlockerReason] = useState(task?.blocker_reason || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      status,
      agent_id: agentId || null,
      deadline: deadline ? new Date(deadline).getTime() : null,
      blocker_reason: blockerReason || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">{task ? 'Edit Task' : 'New Task'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 text-white h-20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-slate-700 rounded px-3 py-2 text-white"
              >
                {COLUMNS.map(col => (
                  <option key={col.id} value={col.id}>{col.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Assign To</label>
              <select
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                className="w-full bg-slate-700 rounded px-3 py-2 text-white"
              >
                <option value="">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Blocker Reason</label>
            <input
              type="text"
              value={blockerReason}
              onChange={e => setBlockerReason(e.target.value)}
              placeholder="What's blocking this task?"
              className="w-full bg-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded font-medium"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded"
            >
              Cancel
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
