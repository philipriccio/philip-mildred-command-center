import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ActivityTimeline } from './components/ActivityTimeline';
import { AgentCard } from './components/AgentCard';
import { CostTracker } from './components/CostTracker';
import { CronPanel } from './components/CronPanel';
import { NotificationToast, type NotificationToastItem } from './components/NotificationToast';
import { OfficePage } from './components/OfficePage';
import { ProjectsPage } from './components/ProjectsPage';
import { QuickCommand } from './components/QuickCommand';
import { SessionsPanel } from './components/SessionsPanel';
import { SiteHealthPanel } from './components/SiteHealthPanel';
import { TaskComposer } from './components/TaskComposer';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import {
  AlertCard,
  ConnectionBadge,
  EmptyState,
  formatDateTime,
  formatShortDate,
  Panel,
  STATUSES,
  StatCard,
  StatusBadge,
  type StatusId,
} from './components/ui';
import { WatchRow } from './components/WatchRow';
import {
  type Agent,
  type DashboardStats,
  EMPTY_DRAFT,
  type Lane,
  type StatusResponse,
  type Task,
  type TaskCostSummary,
  type TaskDetail,
  type TaskDraft,
  type ViewMode,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [status, setStatus] = useState<StatusResponse>({ gateway_connected: 0, last_update: 0 });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [costSummary, setCostSummary] = useState<TaskCostSummary>({ totals: { tokens: 0, estimated: 0, actual: 0 } });
  const [viewMode, setViewMode] = useState<ViewMode>('office');
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
  const [notifications, setNotifications] = useState<NotificationToastItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<typeof setNotifications>(setNotifications);
  notificationsRef.current = setNotifications;

  const pushNotification = useCallback((title: string, body: string, tone: NotificationToastItem['tone']) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const setter = notificationsRef.current;
    setter((prev: NotificationToastItem[]) => [...prev.slice(-4), { id, title, body, tone }]);
    setTimeout(() => {
      setter((prev: NotificationToastItem[]) => prev.filter((n: NotificationToastItem) => n.id !== id));
    }, 8000);
  }, []);

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
    void fetchAll().catch(console.error);
  }, [fetchAll]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws`);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', topics: ['gateway'] }));
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      void fetchAll().catch(console.error);
      if (detailTask?.id) {
        void loadTaskDetail(detailTask.id).then(setDetailTask).catch(console.error);
      }
      if (editingTask?.id) {
        void loadTaskDetail(editingTask.id).then(setEditingTask).catch(console.error);
      }
      // Parse events for notifications
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        const data = (msg.data ?? {}) as Record<string, unknown>;
        if (msg.type === 'gateway.agent.event') {
          const status = data.status as string | undefined;
          const agentId = data.agentId as string | undefined;
          if (status === 'error' && agentId) {
            pushNotification('Agent error', `${agentId} encountered an error`, 'red');
          }
        }
        if (msg.type === 'task.moved') {
          const taskTitle = (data.title as string | undefined) ?? 'A task';
          const newStatus = data.status as string | undefined;
          if (newStatus === 'verification') {
            pushNotification('Ready for review', `${taskTitle} moved to verification`, 'purple');
          }
        }
      } catch { /* ignore parse errors */ }
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
      progress_summary: detail.progress_summary || '',
      next_step: detail.next_step || '',
      model_used: detail.model_used || '',
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
      progress_summary: taskDraft.progress_summary || null,
      next_step: taskDraft.next_step || null,
      model_used: taskDraft.model_used || null,
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

  const uploadEvidence = async (event: ChangeEvent<HTMLInputElement>) => {
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
              {(['office', 'dashboard', 'board', 'projects'] as ViewMode[]).map((mode) => (
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
            <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
              <QuickCommand apiBase={API_BASE} />
              <ActivityTimeline wsUrl={`${WS_BASE}/ws`} />
            </section>
            <CostTracker apiBase={API_BASE} />

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

            <section className="grid gap-6 xl:grid-cols-3">
              <Panel title="Cron Monitor">
                <CronPanel apiBase={API_BASE} />
              </Panel>
              <Panel title="Active Sessions">
                <SessionsPanel apiBase={API_BASE} />
              </Panel>
              <Panel title="Production Sites">
                <SiteHealthPanel apiBase={API_BASE} />
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

        {viewMode === 'office' && <OfficePage apiBase={API_BASE} wsUrl={`${WS_BASE}/ws`} />}
        {viewMode === 'projects' && <ProjectsPage apiBase={API_BASE} />}
      </main>

      <NotificationToast notifications={notifications} onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))} />

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
          apiBase={API_BASE}
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

export default App;
