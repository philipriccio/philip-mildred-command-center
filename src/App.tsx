import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentCard } from './components/AgentCard';
import { OfficePage } from './components/OfficePage';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';
const WS_BASE = API_BASE.replace(/^http/, 'ws');
const STATUSES = [
  { id: 'backlog', label: 'Backlog', tone: 'bg-slate-700 text-slate-100 border-slate-600' },
  { id: 'ready', label: 'Ready', tone: 'bg-blue-500/15 text-blue-200 border-blue-400/40' },
  { id: 'in_progress', label: 'In Progress', tone: 'bg-amber-500/15 text-amber-200 border-amber-400/40' },
  { id: 'verification', label: 'Verification', tone: 'bg-purple-500/15 text-purple-200 border-purple-400/40' },
  { id: 'complete', label: 'Complete', tone: 'bg-green-500/15 text-green-200 border-green-400/40' },
] as const;

type StatusId = (typeof STATUSES)[number]['id'];

type ViewMode = 'dashboard' | 'board' | 'office';

interface Agent {
  id: string;
  name: string;
  status: string;
  last_seen: number | null;
  metadata: string | null;
  current_task_id: string | null;
}

interface Lane {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: StatusId;
  agent_id: string | null;
  lane_id: string | null;
  deadline: number | null;
  blocker_reason: string | null;
  created_at: number;
  updated_at: number;
  promise_date: string | null;
  delivery_notes: string | null;
  request_summary: string | null;
  completion_summary: string | null;
  source: string | null;
  requester: string | null;
  agent_name?: string | null;
  lane_name?: string | null;
  lane_color?: string | null;
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

interface TaskHistoryEvent {
  id: string;
  task_id: string;
  event_type: string;
  actor: string;
  summary: string;
  created_at: number;
  details?: Record<string, unknown> | null;
}

interface TaskDetail extends Task {
  agent: Agent | null;
  lane: Lane | null;
  evidence: Evidence[];
  approvals: Approval[];
  prs: PRTracking[];
  history: TaskHistoryEvent[];
}

interface StatusResponse {
  gateway_connected: number;
  last_update: number;
}

interface DashboardStats {
  totalTasks: number;
  byStatus: Record<StatusId, number>;
  overdue: number;
  dueSoon: number;
  dueVerySoon: number;
  blocked: number;
  activeAgents: number;
  laneStats: Array<{
    id: string;
    name: string;
    color: string;
    total: number;
    completed: number;
    completionRate: number;
  }>;
  recentActivity: Task[];
  recentCompletions: Task[];
  activeWork: Task[];
}

interface TaskCostSummary {
  totals: {
    tokens: number;
    estimated: number;
    actual: number;
  };
}

interface TaskDraft {
  title: string;
  description: string;
  request_summary: string;
  status: StatusId;
  agent_id: string;
  lane_id: string;
  deadline: string;
  promise_date: string;
  blocker_reason: string;
  completion_summary: string;
  delivery_notes: string;
  source: string;
  requester: string;
}

const EMPTY_DRAFT: TaskDraft = {
  title: '',
  description: '',
  request_summary: '',
  status: 'backlog',
  agent_id: '',
  lane_id: '',
  deadline: '',
  promise_date: '',
  blocker_reason: '',
  completion_summary: '',
  delivery_notes: '',
  source: 'telegram',
  requester: 'Philip',
};

function statusMeta(status: StatusId) {
  return STATUSES.find((item) => item.id === status) ?? STATUSES[0];
}

function formatDateTime(value?: number | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatShortDate(value?: number | null) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleDateString();
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [status, setStatus] = useState<StatusResponse>({ gateway_connected: 0, last_update: 0 });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [costSummary, setCostSummary] = useState<TaskCostSummary>({ totals: { tokens: 0, estimated: 0, actual: 0 } });
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedLane, setSelectedLane] = useState('all');
  const [connected, setConnected] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDetail | null>(null);
  const [detailTask, setDetailTask] = useState<TaskDetail | null>(null);
  const [verificationTaskId, setVerificationTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [prOwner, setPrOwner] = useState('');
  const [prRepo, setPrRepo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTaskDetail = useCallback(async (taskId: string) => {
    const response = await fetch(`${API_BASE}/api/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to load task ${taskId}`);
    }
    return response.json() as Promise<TaskDetail>;
  }, []);

  const fetchAll = useCallback(async () => {
    const [agentsRes, tasksRes, statusRes, lanesRes, dashboardRes, costRes] = await Promise.all([
      fetch(`${API_BASE}/api/agents`),
      fetch(`${API_BASE}/api/tasks`),
      fetch(`${API_BASE}/api/status`),
      fetch(`${API_BASE}/api/lanes`),
      fetch(`${API_BASE}/api/dashboard/stats`),
      fetch(`${API_BASE}/api/task-costs/summary`),
    ]);

    setAgents(await agentsRes.json());
    setTasks(await tasksRes.json());
    setStatus(await statusRes.json());
    setLanes(await lanesRes.json());
    setDashboardStats(await dashboardRes.json());
    setCostSummary(await costRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll().catch(console.error);
  }, [fetchAll]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/gateway`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = () => {
      fetchAll().catch(console.error);
      if (detailTask?.id) {
        loadTaskDetail(detailTask.id).then(setDetailTask).catch(console.error);
      }
      if (editingTask?.id) {
        loadTaskDetail(editingTask.id).then(setEditingTask).catch(console.error);
      }
    };
    return () => ws.close();
  }, [detailTask?.id, editingTask?.id, fetchAll, loadTaskDetail]);

  const filteredTasks = useMemo(() => {
    return selectedLane === 'all' ? tasks : tasks.filter((task) => task.lane_id === selectedLane);
  }, [selectedLane, tasks]);

  const overdueTasks = filteredTasks.filter((task) => task.deadline && task.deadline < nowMs && task.status !== 'complete');
  const activeTasks = filteredTasks.filter((task) => ['ready', 'in_progress', 'verification'].includes(task.status));
  const blockedTasks = filteredTasks.filter((task) => Boolean(task.blocker_reason) && task.status !== 'complete');
  const completedTasks = filteredTasks.filter((task) => task.status === 'complete').slice(0, 8);

  const tasksByStatus = useMemo(() => {
    return STATUSES.reduce<Record<StatusId, Task[]>>((acc, statusItem) => {
      acc[statusItem.id] = filteredTasks.filter((task) => task.status === statusItem.id);
      return acc;
    }, { backlog: [], ready: [], in_progress: [], verification: [], complete: [] });
  }, [filteredTasks]);

  const resetComposer = useCallback(() => {
    setTaskDraft(EMPTY_DRAFT);
    setEditingTask(null);
    setShowComposer(false);
  }, []);

  const openCreateTask = () => {
    setTaskDraft(EMPTY_DRAFT);
    setEditingTask(null);
    setShowComposer(true);
  };

  const openEditTask = async (taskId: string) => {
    const detail = await loadTaskDetail(taskId);
    setEditingTask(detail);
    setTaskDraft({
      title: detail.title,
      description: detail.description || '',
      request_summary: detail.request_summary || '',
      status: detail.status,
      agent_id: detail.agent_id || '',
      lane_id: detail.lane_id || '',
      deadline: detail.deadline ? new Date(detail.deadline).toISOString().slice(0, 10) : '',
      promise_date: detail.promise_date || '',
      blocker_reason: detail.blocker_reason || '',
      completion_summary: detail.completion_summary || '',
      delivery_notes: detail.delivery_notes || '',
      source: detail.source || 'telegram',
      requester: detail.requester || 'Philip',
    });
    setShowComposer(true);
  };

  const openTaskDetail = async (taskId: string) => {
    const detail = await loadTaskDetail(taskId);
    setDetailTask(detail);
  };

  const openVerification = async (taskId: string) => {
    setVerificationTaskId(taskId);
    const detail = await loadTaskDetail(taskId);
    setDetailTask(detail);
  };

  const closeDetail = () => {
    setDetailTask(null);
    setVerificationTaskId(null);
    setApprovalNotes('');
    setPrUrl('');
    setPrOwner('');
    setPrRepo('');
  };

  const submitTask = async () => {
    const payload = {
      ...taskDraft,
      agent_id: taskDraft.agent_id || null,
      lane_id: taskDraft.lane_id || null,
      deadline: taskDraft.deadline ? new Date(taskDraft.deadline).getTime() : null,
      blocker_reason: taskDraft.blocker_reason || null,
      promise_date: taskDraft.promise_date || null,
      completion_summary: taskDraft.completion_summary || null,
      delivery_notes: taskDraft.delivery_notes || null,
      request_summary: taskDraft.request_summary || taskDraft.title,
    };
    const url = editingTask ? `${API_BASE}/api/tasks/${editingTask.id}` : `${API_BASE}/api/tasks`;
    const method = editingTask ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await fetchAll();
    resetComposer();
  };

  const updateTaskStatus = async (taskId: string, nextStatus: StatusId) => {
    await fetch(`${API_BASE}/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    await fetchAll();
    if (detailTask?.id === taskId) {
      setDetailTask(await loadTaskDetail(taskId));
    }
  };

  const assignTask = async (taskId: string, agentId: string) => {
    await fetch(`${API_BASE}/api/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId || null }),
    });
    await fetchAll();
    if (detailTask?.id === taskId) {
      setDetailTask(await loadTaskDetail(taskId));
    }
  };

  const deleteTask = async (taskId: string) => {
    await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
    await fetchAll();
    if (detailTask?.id === taskId) closeDetail();
    if (editingTask?.id === taskId) resetComposer();
  };

  const currentDetail = detailTask;
  const isVerificationOpen = Boolean(currentDetail && verificationTaskId === currentDetail.id);

  const runVerificationAction = async (action: 'approve' | 'request-changes' | 'send-back') => {
    if (!currentDetail) return;
    await fetch(`${API_BASE}/api/tasks/${currentDetail.id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: approvalNotes }),
    });
    setApprovalNotes('');
    await fetchAll();
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  const uploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentDetail || !event.target.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', event.target.files[0]);
    await fetch(`${API_BASE}/api/tasks/${currentDetail.id}/evidence`, { method: 'POST', body: formData });
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchAll();
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  const deleteEvidence = async (evidenceId: string) => {
    if (!currentDetail) return;
    await fetch(`${API_BASE}/api/evidence/${evidenceId}`, { method: 'DELETE' });
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  const linkPr = async () => {
    if (!currentDetail || !prUrl.trim()) return;
    await fetch(`${API_BASE}/api/tasks/${currentDetail.id}/pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_url: prUrl.trim(), owner: prOwner.trim(), repo: prRepo.trim() }),
    });
    setPrUrl('');
    setPrOwner('');
    setPrRepo('');
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  const refreshPrs = async () => {
    if (!currentDetail) return;
    await fetch(`${API_BASE}/api/tasks/${currentDetail.id}/pr/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: prOwner.trim(), repo: prRepo.trim() }),
    });
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  const unlinkPr = async (prId: string) => {
    if (!currentDetail) return;
    await fetch(`${API_BASE}/api/pr/${prId}`, { method: 'DELETE' });
    setDetailTask(await loadTaskDetail(currentDetail.id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Telegram-driven operations mirror</p>
            <h1 className="text-2xl font-semibold">Philip–Mildred Mission Control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1 text-sm">
              {(['dashboard', 'board', 'office'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <select
              value={selectedLane}
              onChange={(event) => setSelectedLane(event.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">All lanes</option>
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>{lane.name}</option>
              ))}
            </select>
            <button onClick={openCreateTask} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
              New task mirror
            </button>
            <ConnectionBadge label="Gateway" online={Boolean(status.gateway_connected)} />
            <ConnectionBadge label="Realtime" online={connected} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {(overdueTasks.length > 0 || blockedTasks.length > 0) && (
          <section className="mb-6 grid gap-4 md:grid-cols-2">
            <AlertCard tone="red" title={`${overdueTasks.length} overdue tasks`} body="These tasks are slipping beyond their promised timeline." />
            <AlertCard tone="amber" title={`${blockedTasks.length} blocked tasks`} body="There are active blockers that need Mildred’s attention or user input." />
          </section>
        )}

        {viewMode === 'dashboard' && dashboardStats && (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Active work" value={activeTasks.length} accent="text-blue-300" />
              <StatCard label="Verification" value={dashboardStats.byStatus.verification} accent="text-purple-300" />
              <StatCard label="Completed" value={dashboardStats.byStatus.complete} accent="text-green-300" />
              <StatCard label="Blocked" value={dashboardStats.blocked} accent="text-amber-300" />
              <StatCard label="Agents active" value={dashboardStats.activeAgents} accent="text-cyan-300" />
              <StatCard label="Actual cost" value={`$${costSummary.totals.actual.toFixed(2)}`} accent="text-emerald-300" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <Panel title="Active operations">
                <div className="space-y-3">
                  {activeTasks.length === 0 && <EmptyState message="No active work. New Telegram requests will appear here first." />}
                  {activeTasks.map((task) => (
                    <WatchRow
                      key={task.id}
                      task={task}
                      onOpen={() => void openTaskDetail(task.id)}
                      onAdvance={(nextStatus) => void updateTaskStatus(task.id, nextStatus)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Owner visibility">
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div key={agent.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-100">{agent.name}</p>
                        <span className="text-xs uppercase tracking-wide text-slate-400">{agent.status}</span>
                      </div>
                      <p className="text-sm text-slate-400">Current mirror: {tasks.find((task) => task.id === agent.current_task_id)?.title ?? 'No task assigned'}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Panel title="Recent completions">
                <div className="space-y-3">
                  {completedTasks.length === 0 && <EmptyState message="Completed work will surface here with readable summaries." />}
                  {completedTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => void openTaskDetail(task.id)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-100">{task.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{task.completion_summary || task.delivery_notes || task.request_summary || 'No completion summary yet.'}</p>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{task.agent_name || 'Unassigned'}</span>
                        <span>{task.lane_name || 'No lane'}</span>
                        <span>{formatDateTime(task.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Portfolio lanes">
                <div className="space-y-3">
                  {dashboardStats.laneStats.map((lane) => (
                    <div key={lane.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: lane.color }} />
                          <p className="font-medium">{lane.name}</p>
                        </div>
                        <span className="text-sm text-slate-400">{lane.completed}/{lane.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${lane.completionRate}%`, backgroundColor: lane.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="Recent activity feed">
                <div className="space-y-3">
                  {dashboardStats.recentActivity.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-slate-400">{task.request_summary || task.description || 'Task updated'}</p>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{task.agent_name || 'Unassigned'}</span>
                        <span>{formatDateTime(task.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Agents">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
                </div>
              </Panel>
            </section>
          </div>
        )}

        {viewMode === 'board' && (
          <div className="space-y-6">
            <Panel title="Manual board view" subtitle="Still available for oversight, but de-emphasized in favor of the live mirror.">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {STATUSES.map((column) => (
                  <div key={column.id} className="w-80 flex-shrink-0 rounded-3xl border border-slate-800 bg-slate-900/80">
                    <div className="border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-100">{column.label}</p>
                          <p className="text-xs text-slate-500">{tasksByStatus[column.id].length} tasks</p>
                        </div>
                        <StatusBadge status={column.id} />
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      {tasksByStatus[column.id].map((task) => (
                        <div key={task.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <button className="w-full text-left" onClick={() => void openTaskDetail(task.id)}>
                            <p className="font-medium text-slate-100">{task.title}</p>
                            <p className="mt-1 text-sm text-slate-400">{task.request_summary || task.description || 'No description'}</p>
                          </button>
                          <div className="mt-3 space-y-2 text-xs text-slate-500">
                            <div className="flex items-center justify-between gap-3">
                              <span>{task.agent_name || 'Unassigned'}</span>
                              <span>{task.lane_name || 'No lane'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>{formatShortDate(task.deadline)}</span>
                              {task.status === 'verification' ? (
                                <button onClick={() => void openVerification(task.id)} className="text-purple-300 hover:text-purple-200">Open verification</button>
                              ) : (
                                <button onClick={() => void openEditTask(task.id)} className="text-blue-300 hover:text-blue-200">Edit</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {tasksByStatus[column.id].length === 0 && <EmptyState message={`No ${column.label.toLowerCase()} tasks.`} />}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {viewMode === 'office' && <OfficePage apiBase={API_BASE} wsUrl={`${WS_BASE}/ws/office`} />}
      </main>

      {showComposer && (
        <TaskComposer
          draft={taskDraft}
          setDraft={setTaskDraft}
          agents={agents}
          lanes={lanes}
          editing={Boolean(editingTask)}
          onClose={resetComposer}
          onDelete={editingTask ? () => void deleteTask(editingTask.id) : undefined}
          onSubmit={() => void submitTask()}
        />
      )}

      {currentDetail && (
        <TaskDetailDrawer
          task={currentDetail}
          agents={agents}
          verificationMode={isVerificationOpen}
          approvalNotes={approvalNotes}
          setApprovalNotes={setApprovalNotes}
          prUrl={prUrl}
          prOwner={prOwner}
          prRepo={prRepo}
          setPrUrl={setPrUrl}
          setPrOwner={setPrOwner}
          setPrRepo={setPrRepo}
          fileInputRef={fileInputRef}
          onClose={closeDetail}
          onEdit={() => void openEditTask(currentDetail.id)}
          onAssign={(agentId) => void assignTask(currentDetail.id, agentId)}
          onStatusChange={(nextStatus) => void updateTaskStatus(currentDetail.id, nextStatus)}
          onOpenVerification={() => void openVerification(currentDetail.id)}
          onUploadEvidence={(event) => void uploadEvidence(event)}
          onDeleteEvidence={(evidenceId) => void deleteEvidence(evidenceId)}
          onApprove={() => void runVerificationAction('approve')}
          onRequestChanges={() => void runVerificationAction('request-changes')}
          onSendBack={() => void runVerificationAction('send-back')}
          onLinkPr={() => void linkPr()}
          onRefreshPrs={() => void refreshPrs()}
          onUnlinkPr={(prId) => void unlinkPr(prId)}
        />
      )}
    </div>
  );
}

function ConnectionBadge({ label, online }: { label: string; online: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {label}
    </div>
  );
}

function AlertCard({ title, body, tone }: { title: string; body: string; tone: 'red' | 'amber' }) {
  const palette = tone === 'red'
    ? 'border-red-500/30 bg-red-500/10 text-red-100'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  return (
    <div className={`rounded-2xl border px-5 py-4 ${palette}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-slate-300">{body}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.4)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">{message}</div>;
}

function StatusBadge({ status }: { status: StatusId }) {
  const meta = statusMeta(status);
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>;
}

function WatchRow({ task, onOpen, onAdvance }: { task: Task; onOpen: () => void; onAdvance: (status: StatusId) => void }) {
  const nextAction: Record<StatusId, StatusId | null> = {
    backlog: 'ready',
    ready: 'in_progress',
    in_progress: 'verification',
    verification: 'complete',
    complete: null,
  };
  const nextStatus = nextAction[task.status];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="text-xs uppercase tracking-wide text-slate-500">{task.source || 'telegram'}</span>
          </div>
          <p className="text-base font-medium text-slate-100">{task.title}</p>
          <p className="mt-1 text-sm text-slate-400">{task.request_summary || task.description || 'No task summary yet.'}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Owner: {task.agent_name || 'Unassigned'}</span>
            <span>Lane: {task.lane_name || 'No lane'}</span>
            <span>Updated: {formatDateTime(task.updated_at)}</span>
          </div>
          {task.blocker_reason && <p className="mt-3 text-sm text-amber-300">Blocked: {task.blocker_reason}</p>}
        </button>
        {nextStatus && (
          <button onClick={() => onAdvance(nextStatus)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800">
            Move to {statusMeta(nextStatus).label}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskComposer({
  draft,
  setDraft,
  agents,
  lanes,
  editing,
  onClose,
  onDelete,
  onSubmit,
}: {
  draft: TaskDraft;
  setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>;
  agents: Agent[];
  lanes: Lane[];
  editing: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="mx-auto max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Mildred-operated task lifecycle</p>
            <h2 className="text-2xl font-semibold text-slate-100">{editing ? 'Update mirrored task' : 'Create mirrored task'}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Task title">
            <input value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} className="field" placeholder="Ship verification fixes for Mission Control" />
          </Field>
          <Field label="Original requester">
            <input value={draft.requester} onChange={(event) => setDraft((prev) => ({ ...prev, requester: event.target.value }))} className="field" placeholder="Philip" />
          </Field>
          <Field label="Telegram / request summary" className="md:col-span-2">
            <textarea value={draft.request_summary} onChange={(event) => setDraft((prev) => ({ ...prev, request_summary: event.target.value }))} className="field min-h-24" placeholder="Summarize what Philip asked Mildred to do." />
          </Field>
          <Field label="Execution notes" className="md:col-span-2">
            <textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="field min-h-24" placeholder="Optional internal execution detail for the operators." />
          </Field>
          <Field label="Owner">
            <select value={draft.agent_id} onChange={(event) => setDraft((prev) => ({ ...prev, agent_id: event.target.value }))} className="field">
              <option value="">Unassigned</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </Field>
          <Field label="Portfolio lane">
            <select value={draft.lane_id} onChange={(event) => setDraft((prev) => ({ ...prev, lane_id: event.target.value }))} className="field">
              <option value="">No lane</option>
              {lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
            </select>
          </Field>
          <Field label="Execution state">
            <select value={draft.status} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as StatusId }))} className="field">
              {STATUSES.map((statusItem) => <option key={statusItem.id} value={statusItem.id}>{statusItem.label}</option>)}
            </select>
          </Field>
          <Field label="Source channel">
            <input value={draft.source} onChange={(event) => setDraft((prev) => ({ ...prev, source: event.target.value }))} className="field" placeholder="telegram" />
          </Field>
          <Field label="Deadline">
            <input type="date" value={draft.deadline} onChange={(event) => setDraft((prev) => ({ ...prev, deadline: event.target.value }))} className="field" />
          </Field>
          <Field label="Promised date">
            <input type="date" value={draft.promise_date} onChange={(event) => setDraft((prev) => ({ ...prev, promise_date: event.target.value }))} className="field" />
          </Field>
          <Field label="Blocker / waiting reason" className="md:col-span-2">
            <textarea value={draft.blocker_reason} onChange={(event) => setDraft((prev) => ({ ...prev, blocker_reason: event.target.value }))} className="field min-h-20" placeholder="Waiting for CI, approval, or external input" />
          </Field>
          <Field label="Completion summary" className="md:col-span-2">
            <textarea value={draft.completion_summary} onChange={(event) => setDraft((prev) => ({ ...prev, completion_summary: event.target.value }))} className="field min-h-24" placeholder="Readable wrap-up for Philip once work is done." />
          </Field>
          <Field label="Delivery notes / artifacts" className="md:col-span-2">
            <textarea value={draft.delivery_notes} onChange={(event) => setDraft((prev) => ({ ...prev, delivery_notes: event.target.value }))} className="field min-h-24" placeholder="PR links, evidence context, or notable follow-up." />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {onDelete && <button onClick={onDelete} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">Delete task</button>}
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:text-white">Cancel</button>
          <button onClick={onSubmit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">{editing ? 'Save task' : 'Create task'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="mb-2 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function TaskDetailDrawer({
  task,
  agents,
  verificationMode,
  approvalNotes,
  setApprovalNotes,
  prUrl,
  prOwner,
  prRepo,
  setPrUrl,
  setPrOwner,
  setPrRepo,
  fileInputRef,
  onClose,
  onEdit,
  onAssign,
  onStatusChange,
  onOpenVerification,
  onUploadEvidence,
  onDeleteEvidence,
  onApprove,
  onRequestChanges,
  onSendBack,
  onLinkPr,
  onRefreshPrs,
  onUnlinkPr,
}: {
  task: TaskDetail;
  agents: Agent[];
  verificationMode: boolean;
  approvalNotes: string;
  setApprovalNotes: React.Dispatch<React.SetStateAction<string>>;
  prUrl: string;
  prOwner: string;
  prRepo: string;
  setPrUrl: React.Dispatch<React.SetStateAction<string>>;
  setPrOwner: React.Dispatch<React.SetStateAction<string>>;
  setPrRepo: React.Dispatch<React.SetStateAction<string>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onEdit: () => void;
  onAssign: (agentId: string) => void;
  onStatusChange: (nextStatus: StatusId) => void;
  onOpenVerification: () => void;
  onUploadEvidence: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteEvidence: (evidenceId: string) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onSendBack: () => void;
  onLinkPr: () => void;
  onRefreshPrs: () => void;
  onUnlinkPr: (prId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{task.source || 'telegram'} request</span>
            </div>
            <h2 className="text-2xl font-semibold text-slate-100">{task.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{task.request_summary || task.description || 'No request summary recorded yet.'}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="grid gap-4 md:grid-cols-2">
            <InfoCard label="Owner" value={task.agent?.name || 'Unassigned'} />
            <InfoCard label="Lane" value={task.lane?.name || 'No lane'} />
            <InfoCard label="Requested by" value={task.requester || 'Philip'} />
            <InfoCard label="Promised date" value={task.promise_date || 'Not set'} />
            <InfoCard label="Last updated" value={formatDateTime(task.updated_at)} />
            <InfoCard label="Deadline" value={formatShortDate(task.deadline)} />
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-100">Lifecycle controls</h3>
              <button onClick={onEdit} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">Edit details</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Assign owner">
                <select value={task.agent_id || ''} onChange={(event) => onAssign(event.target.value)} className="field">
                  <option value="">Unassigned</option>
                  {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
              </Field>
              <Field label="Move state">
                <select value={task.status} onChange={(event) => onStatusChange(event.target.value as StatusId)} className="field">
                  {STATUSES.map((statusItem) => <option key={statusItem.id} value={statusItem.id}>{statusItem.label}</option>)}
                </select>
              </Field>
            </div>
            {task.blocker_reason && <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Blocked: {task.blocker_reason}</p>}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel title="Readable completion report">
              <div className="space-y-4 text-sm text-slate-300">
                <DetailBlock title="Completion summary" body={task.completion_summary || 'No completion summary yet.'} />
                <DetailBlock title="Delivery notes" body={task.delivery_notes || 'No delivery notes attached.'} />
                <DetailBlock title="Execution notes" body={task.description || 'No internal execution notes.'} />
              </div>
            </Panel>
            <Panel title="Verification">
              <div className="space-y-3 text-sm text-slate-300">
                <p>{verificationMode ? 'Verification panel is active for this task.' : 'Open verification to manage evidence, PRs, and approvals.'}</p>
                <button onClick={onOpenVerification} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500">Open verification flow</button>
              </div>
            </Panel>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Task history</h3>
            <div className="space-y-3">
              {task.history.length === 0 && <EmptyState message="No lifecycle events recorded yet." />}
              {task.history.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-100">{event.summary}</p>
                    <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{event.actor}</p>
                </div>
              ))}
            </div>
          </section>

          {verificationMode && (
            <>
              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-100">GitHub PRs</h3>
                  <button onClick={onRefreshPrs} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">Refresh</button>
                </div>
                <div className="space-y-3">
                  {task.prs.length === 0 && <EmptyState message="No PR linked yet." />}
                  {task.prs.map((pr) => (
                    <div key={pr.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <a href={pr.pr_url} target="_blank" rel="noreferrer" className="font-medium text-blue-300 hover:text-blue-200">PR #{pr.pr_number}</a>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                            <span>Status: {pr.status}</span>
                            <span>CI: {pr.ci_status}</span>
                          </div>
                        </div>
                        <button onClick={() => onUnlinkPr(pr.id)} className="text-sm text-red-300 hover:text-red-200">Unlink</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
                  <input value={prUrl} onChange={(event) => setPrUrl(event.target.value)} className="field" placeholder="https://github.com/owner/repo/pull/123" />
                  <input value={prOwner} onChange={(event) => setPrOwner(event.target.value)} className="field" placeholder="owner" />
                  <input value={prRepo} onChange={(event) => setPrRepo(event.target.value)} className="field" placeholder="repo" />
                  <button onClick={onLinkPr} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">Link PR</button>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">Evidence</h3>
                <div className="space-y-3">
                  {task.evidence.length === 0 && <EmptyState message="No evidence attached yet." />}
                  {task.evidence.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div>
                        <p className="font-medium text-slate-100">{item.original_name}</p>
                        <p className="text-sm text-slate-400">{Math.round(item.size / 1024)} KB • {formatDateTime(item.uploaded_at)}</p>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <a href={`${API_BASE}/api/evidence/${item.id}/download`} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">Download</a>
                        <button onClick={() => onDeleteEvidence(item.id)} className="text-red-300 hover:text-red-200">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
                <input ref={fileInputRef} type="file" onChange={onUploadEvidence} accept="image/*,.pdf,.txt,.log" className="mt-4 block w-full text-sm text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-500" />
              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">Approval history & actions</h3>
                <div className="space-y-3">
                  {task.approvals.length === 0 && <EmptyState message="No approval decisions recorded yet." />}
                  {task.approvals.map((approval) => (
                    <div key={approval.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-100">{approval.decision.replace('_', ' ')}</p>
                        <span className="text-xs text-slate-500">{formatDateTime(approval.decided_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{approval.decided_by}</p>
                      {approval.notes && <p className="mt-2 text-sm text-slate-300">{approval.notes}</p>}
                    </div>
                  ))}
                </div>
                <textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} className="field mt-4 min-h-24" placeholder="Verification notes for Philip / Mildred" />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button onClick={onApprove} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-500">Approve</button>
                  <button onClick={onRequestChanges} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500">Request changes</button>
                  <button onClick={onSendBack} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500">Send back</button>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-sm font-medium text-slate-100">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

export default App;
