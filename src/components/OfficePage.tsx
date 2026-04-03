import { useEffect, useMemo, useRef, useState } from 'react';
// officeSceneConfig no longer used — 2D canvas has its own desk layout
import { OfficeCanvas2D, type OfficeAgent as OfficeAgent2D } from './OfficeCanvas2D';
import { AgentDetailDrawer } from './AgentDetailDrawer';
import { ReportsPanel } from './ReportsPanel';
import { InboxDrawer, useInboxCount } from './InboxDrawer';

type AgentStateSnapshot = {
  state: string;
  current_task: string | null;
  lastSeen: number;
};

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

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'ready' | 'in_progress' | 'verification' | 'complete';
  agent_id: string | null;
  lane_id: string | null;
  blocker_reason: string | null;
  request_summary: string | null;
  completion_summary: string | null;
  progress_summary: string | null;
  next_step: string | null;
  model_used: string | null;
  updated_at: number;
  agent_name?: string | null;
  lane_name?: string | null;
}

interface OfficeReport {
  id: string;
  task_id: string | null;
  agent_id: string;
  agent_name: string;
  task_title: string;
  summary: string | null;
  lane_name: string | null;
  model_used: string | null;
  completed_at: number;
  acknowledged: number;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: number | null;
  approved_by: string | null;
  approved_at: number | null;
}

interface TaskDetail extends Task {
  delivery_notes: string | null;
  office_report?: OfficeReport | null;
  history: Array<{ id: string; summary: string; actor: string; created_at: number }>;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  eventType: 'thinking' | 'tool_call' | 'speaking' | 'idle' | 'error';
  tool: string | null;
  summary: string;
}

const FALLBACK_AGENTS: OfficeAgent[] = [
  { id: 'main', name: 'Mildred', position_x: 0, position_y: 0, state: 'idle', current_task: null, task_progress: 0, color: '#008080', office_enabled: 1 },
  { id: 'dev', name: 'Dev', position_x: 0, position_y: 0, state: 'idle', current_task: null, task_progress: 0, color: '#808080', office_enabled: 1 },
  { id: 'janet', name: 'Janet', position_x: 0, position_y: 0, state: 'idle', current_task: null, task_progress: 0, color: '#8B4513', office_enabled: 1 },
  { id: 'kimi', name: 'Kimi', position_x: 0, position_y: 0, state: 'idle', current_task: null, task_progress: 0, color: '#2E86C1', office_enabled: 1 },
  { id: 'gpt-mini', name: 'GPT-mini', position_x: 0, position_y: 0, state: 'idle', current_task: null, task_progress: 0, color: '#27AE60', office_enabled: 1 },
];

const FALLBACK_TASKS: Task[] = [
  {
    id: 'fallback-mildred-blocked',
    title: 'Review pending launch decision',
    description: 'Waiting on external approval before Mildred can continue execution.',
    status: 'in_progress',
    agent_id: 'mildred',
    lane_id: null,
    blocker_reason: 'Awaiting external approval.',
    request_summary: 'Blocked office-state verification task.',
    completion_summary: null,
    progress_summary: 'Context gathered and recommendation drafted; waiting on go-ahead.',
    next_step: 'Resume execution as soon as approval lands.',
    model_used: 'openai-codex/gpt-5.4',
    updated_at: Date.now(),
    agent_name: 'Mildred',
    lane_name: null,
  },
  {
    id: 'fallback-dev-active',
    title: 'Implement office master scene anchors',
    description: 'Build master-scene background, anchors, states, and desk interactions.',
    status: 'in_progress',
    agent_id: 'dev',
    lane_id: null,
    blocker_reason: null,
    request_summary: 'Integrate the approved master-scene image and live desk states.',
    completion_summary: null,
    progress_summary: 'Scene config, reserved desk state, and interaction zones are in implementation.',
    next_step: 'Verify screenshots and clean up before movement phase.',
    model_used: 'openai-codex/gpt-5.4',
    updated_at: Date.now() - 1000,
    agent_name: 'Dev',
    lane_name: null,
  },
];

function formatRelativeTime(timestamp: number, now: number) {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  if (diff < 15_000) return 'just now';
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < 24 * hour) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  return `${Math.max(1, Math.round(diff / (24 * hour)))}d ago`;
}

function activityLabel(entry: ActivityEntry) {
  switch (entry.eventType) {
    case 'thinking':
      return 'Thinking...';
    case 'tool_call':
      return entry.tool ? `Running ${entry.tool}` : 'Running tool';
    case 'speaking':
      return entry.summary || 'Responding';
    case 'idle':
      return 'Idle';
    case 'error':
      return entry.summary || 'Error';
    default:
      return entry.summary;
  }
}

export function OfficePage({ apiBase, wsUrl }: { apiBase: string; wsUrl: string }) {
  const [reports, setReports] = useState<OfficeReport[]>([]);
  const [pendingReports, setPendingReports] = useState<OfficeReport[]>([]);
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const inboxCount = useInboxCount(apiBase);
  const [selectedDetail, setSelectedDetail] = useState<TaskDetail | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const agentStateHistory = useRef<Map<string, AgentStateSnapshot>>(new Map());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [agentsRes, reportsRes, pendingRes, tasksRes, activityRes] = await Promise.all([
        fetch(`${apiBase}/api/office/agents`),
        fetch(`${apiBase}/api/office/reports`),
        fetch(`${apiBase}/api/office/reports?includePending=1`),
        fetch(`${apiBase}/api/tasks`),
        fetch(`${apiBase}/api/activity/recent`),
      ]);

      const approvedPayload = await reportsRes.json() as { reports?: OfficeReport[] };
      const allPayload = await pendingRes.json() as { reports?: OfficeReport[] };
      const agentPayload = await agentsRes.json() as { agents?: OfficeAgent[] };
      const activityPayload = await activityRes.json() as { entries?: ActivityEntry[] };
      const newAgents = agentPayload.agents || [];

      for (const agent of newAgents) {
        agentStateHistory.current.set(agent.id, {
          state: agent.state,
          current_task: agent.current_task,
          lastSeen: Date.now(),
        });
      }

      setAgents(newAgents);
      setReports(approvedPayload.reports || []);
      setPendingReports((allPayload.reports || []).filter((report) => report.review_status !== 'approved'));
      setTasks(await tasksRes.json());
      setActivity((activityPayload.entries || []).slice(-50));
      setUsingFallbackData(false);
    } catch (error) {
      console.error(error);
      setAgents(FALLBACK_AGENTS);
      setReports([]);
      setPendingReports([]);
      setTasks(FALLBACK_TASKS);
      setActivity([]);
      setUsingFallbackData(true);
    }
  };

  useEffect(() => {
    fetchAll().catch(console.error);

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', topics: ['office', 'gateway', 'activity'] }));
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;

        if (data.type === 'office.init' && Array.isArray(data.agents)) {
          const nextAgents = data.agents as OfficeAgent[];
          for (const agent of nextAgents) {
            agentStateHistory.current.set(agent.id, {
              state: agent.state,
              current_task: agent.current_task,
              lastSeen: Date.now(),
            });
          }
          setAgents(nextAgents);
          return;
        }

        if (data.type === 'agent.state' && typeof data.agentId === 'string') {
          setAgents((prev) => prev.map((agent) => agent.id === data.agentId ? {
            ...agent,
            state: typeof data.state === 'string' ? data.state : agent.state,
            current_task: typeof data.task === 'string' ? data.task : data.task === null ? null : agent.current_task,
            task_progress: typeof data.progress === 'number' ? data.progress : agent.task_progress,
          } : agent));
          agentStateHistory.current.set(data.agentId, {
            state: typeof data.state === 'string' ? data.state : 'idle',
            current_task: typeof data.task === 'string' ? data.task : null,
            lastSeen: Date.now(),
          });
          return;
        }

        if (data.type === 'agent.move' || data.type === 'report.new' || data.type === 'report.updated') {
          fetchAll().catch(console.error);
          return;
        }

        if (data.type === 'activity.recent' && Array.isArray(data.entries)) {
          setActivity((data.entries as ActivityEntry[]).slice(-50));
          return;
        }

        if (data.type === 'activity.entry' && data.entry) {
          setActivity((prev) => [...prev, data.entry as ActivityEntry].slice(-50));
          return;
        }

        fetchAll().catch(console.error);
      } catch {
        fetchAll().catch(console.error);
      }

      if (selectedDetail?.id) {
        fetch(`${apiBase}/api/tasks/${selectedDetail.id}`).then((res) => res.json()).then(setSelectedDetail).catch(console.error);
      }
    };

    return () => ws.close();
  }, [apiBase, selectedDetail?.id, wsUrl]);

  const taskByAgent = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      if (!task.agent_id) continue;
      const current = map.get(task.agent_id);
      if (!current || task.updated_at > current.updated_at) {
        map.set(task.agent_id, task);
      }
    }
    return map;
  }, [tasks]);

  const activeCount = agents.filter((a) => a.state === 'working').length;
  const blockedCount = agents.filter((a) => a.state === 'blocked').length;

  const openAgentDetail = async (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const acknowledgeReport = async (reportId: string) => {
    await fetch(`${apiBase}/api/office/report/${reportId}/acknowledge`, { method: 'POST' });
    setReports((prev) => prev.map((report) => report.id === reportId ? { ...report, acknowledged: 1 } : report));
  };

  const approveReport = async (reportId: string) => {
    const response = await fetch(`${apiBase}/api/office/report/${reportId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved_by: 'Mildred' }) });
    const approved = await response.json() as OfficeReport;
    setPendingReports((prev) => prev.filter((report) => report.id !== reportId));
    setReports((prev) => [approved, ...prev.filter((report) => report.id !== reportId)]);
    setShowReports(true);
  };

  const unreadCount = reports.filter((report) => !report.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/85 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Primary live operations surface</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Office status map</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">Open this page and you can immediately see who is working, who is blocked, and which desks are empty. Click any active desk for the plain-English task detail.</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MiniStat label="Working now" value={String(activeCount)} tone="text-emerald-300" />
          <MiniStat label="Blocked" value={String(blockedCount)} tone="text-amber-200" />
          <MiniStat label="Awaiting review" value={String(pendingReports.length)} tone="text-sky-200" />
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/80 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Mission Control office</p>
          <h3 className="text-lg font-semibold text-slate-100">Default home view</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
            {usingFallbackData ? 'Fallback preview data' : connected ? 'Realtime connected' : 'Realtime disconnected'}
          </div>
          <button onClick={() => setShowReports((prev) => !prev)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700">
            Reports Tray {pendingReports.length > 0 ? `(${pendingReports.length} pending review)` : unreadCount > 0 ? `(${unreadCount} new)` : ''}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
        <OfficeCanvas2D
          agents={agents.map((a): OfficeAgent2D => ({
            id: a.id,
            name: a.name,
            state: (['working', 'blocked', 'idle', 'offline', 'finished', 'reserved'].includes(a.state)
              ? a.state
              : 'idle') as OfficeAgent2D['state'],
            taskTitle: a.current_task,
            color: a.color,
          }))}
          onSelectAgent={(agentId) => void openAgentDetail(agentId)}
          inboxCount={inboxCount}
          onInboxClick={() => setShowInbox(true)}
        />
      </div>

      <ActivityFeed entries={activity} nowMs={nowMs} />

      <ReportsPanel
        reports={reports}
        pendingReports={pendingReports}
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        onAcknowledge={acknowledgeReport}
        onApprove={approveReport}
      />

      <InboxDrawer
        apiBase={apiBase}
        isOpen={showInbox}
        onClose={() => setShowInbox(false)}
      />

      {selectedDetail && (
        <TaskDetailSheet detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}
      {selectedAgentId && (
        <AgentDetailDrawer
          agentId={selectedAgentId}
          apiBase={apiBase}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  );
}

function ActivityFeed({ entries, nowMs }: { entries: ActivityEntry[]; nowMs: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Live activity feed</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">Realtime agent events</h3>
        </div>
        <div className="text-xs text-slate-500">Showing last {entries.length} entries</div>
      </div>
      <div ref={scrollerRef} className="mt-4 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
            Waiting for live gateway activity.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-100">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agentColor(entry.agentId) }} />
                  <span className="font-medium">{entry.agentName}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{activityLabel(entry)}</p>
                {entry.summary && entry.eventType !== 'speaking' && entry.summary !== activityLabel(entry) && (
                  <p className="mt-1 text-xs text-slate-500">{entry.summary}</p>
                )}
              </div>
              <div className="shrink-0 text-xs text-slate-500">{formatRelativeTime(entry.timestamp, nowMs)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function agentColor(agentId: string) {
  const palette: Record<string, string> = {
    main: '#14b8a6',
    dev: '#94a3b8',
    janet: '#f59e0b',
    kimi: '#60a5fa',
    'gpt-mini': '#4ade80',
  };
  return palette[agentId] ?? '#64748b';
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function TaskDetailSheet({ detail, onClose }: { detail: TaskDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Plain-English task detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">{detail.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{detail.request_summary || detail.description || 'No summary recorded yet.'}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <InfoSection title="Current task title" body={detail.title} />
          <InfoSection title="Short summary" body={detail.request_summary || detail.description || 'No short summary recorded yet.'} />
          <InfoSection title="Progress so far" body={detail.progress_summary || 'No progress update recorded yet.'} />
          <InfoSection title="Blockers or issues" body={detail.blocker_reason || 'No blockers right now.'} tone={detail.blocker_reason ? 'amber' : 'slate'} />
          <InfoSection title="Next step or ETA" body={detail.next_step || 'No next step recorded yet.'} />

          <div className="grid gap-4 md:grid-cols-2">
            <MetaCard label="Model being used" value={detail.model_used || 'Not recorded'} />
            <MetaCard label="Report / history link" value={`Task history: ${detail.id}`} />
            <MetaCard label="Owner" value={detail.agent_name || 'Unassigned'} />
            <MetaCard label="Lane" value={detail.lane_name || 'No lane'} />
          </div>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Relevant history</h3>
            <div className="mt-4 space-y-3">
              {detail.history.length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
              {detail.history.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="font-medium text-slate-100">{event.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{event.actor}</span>
                    <span>{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {detail.office_report && detail.office_report.review_status === 'approved' && (
            <section className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
              <h3 className="text-lg font-semibold text-emerald-100">Approved report metadata</h3>
              <div className="mt-3 grid gap-3 text-sm text-emerald-50 md:grid-cols-2">
                <p>Reviewed by: {detail.office_report.reviewed_by || 'Mildred'}</p>
                <p>Approved by: {detail.office_report.approved_by || 'Mildred'}</p>
                <p>Approved at: {detail.office_report.approved_at ? new Date(detail.office_report.approved_at).toLocaleString() : 'Just now'}</p>
                <p>Model used: {detail.office_report.model_used || detail.model_used || 'Not recorded'}</p>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoSection({ title, body, tone = 'slate' }: { title: string; body: string; tone?: 'slate' | 'amber' }) {
  return (
    <section className={`rounded-3xl border p-5 ${tone === 'amber' ? 'border-amber-400/30 bg-amber-500/10' : 'border-slate-800 bg-slate-900/80'}`}>
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{body}</p>
    </section>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}
