import { useEffect, useMemo, useRef, useState } from 'react';
import { OFFICE_SCENE_CONFIG, OFFICE_SCENE_DESK_ORDER } from '../officeSceneConfig';
import { OfficeCanvas, type OfficeCanvasHandle } from './OfficeCanvas'; // kept for reference
import { OfficeCanvas2D, type OfficeAgent as OfficeAgent2D } from './OfficeCanvas2D';
import { ReportsPanel } from './ReportsPanel';

// Agent state tracking for movement animations
type AgentStateSnapshot = {
  state: string;
  current_task: string | null;
  lastSeen: number;
};

type MovementTrigger = {
  agentId: string;
  type: 'enter' | 'exit';
  timestamp: number;
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

const DESK_LAYOUT = OFFICE_SCENE_DESK_ORDER.map((id) => ({
  id,
  label: OFFICE_SCENE_CONFIG.desks[id].label,
  x: OFFICE_SCENE_CONFIG.desks[id].stage.left,
  y: OFFICE_SCENE_CONFIG.desks[id].stage.top,
}));

const FALLBACK_AGENTS: OfficeAgent[] = [
  { id: 'mildred', name: 'Mildred', position_x: 0, position_y: 0, state: 'blocked', current_task: 'Waiting on approval', task_progress: 58, color: '#008080', office_enabled: 1 },
  { id: 'dev', name: 'Dev', position_x: 0, position_y: 0, state: 'working', current_task: 'Implement office master scene', task_progress: 76, color: '#808080', office_enabled: 1 },
  { id: 'research', name: 'Claire', position_x: 0, position_y: 0, state: 'working', current_task: 'Mission Control visual design', task_progress: 45, color: '#8B4513', office_enabled: 1 },
  { id: 'content', name: 'Future', position_x: 0, position_y: 0, state: 'reserved', current_task: null, task_progress: 0, color: '#7c6f4f', office_enabled: 1 },
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

export function OfficePage({ apiBase, wsUrl }: { apiBase: string; wsUrl: string }) {
  const [reports, setReports] = useState<OfficeReport[]>([]);
  const [pendingReports, setPendingReports] = useState<OfficeReport[]>([]);
  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connected, setConnected] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<TaskDetail | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const canvasRef = useRef<OfficeCanvasHandle>(null);
  
  // Agent state tracking for automatic movement triggers
  const agentStateHistory = useRef<Map<string, AgentStateSnapshot>>(new Map());
  const [movementQueue, setMovementQueue] = useState<MovementTrigger[]>([]);
  const processingMovement = useRef(false);

  // Process movement queue sequentially
  useEffect(() => {
    if (processingMovement.current || movementQueue.length === 0) return;
    
    const processNext = async () => {
      processingMovement.current = true;
      const trigger = movementQueue[0];
      
      if (canvasRef.current) {
        if (trigger.type === 'enter') {
          canvasRef.current.startAgentEnter(trigger.agentId, trigger.agentId);
        } else {
          canvasRef.current.startAgentExit(trigger.agentId, trigger.agentId);
        }
        // Wait for animation to complete (~2.5s total)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      setMovementQueue(prev => prev.slice(1));
      processingMovement.current = false;
    };
    
    processNext();
  }, [movementQueue]);

  // Detect agent state changes and queue movements
  const detectStateChanges = (newAgents: OfficeAgent[]) => {
    const changes: MovementTrigger[] = [];
    
    for (const agent of newAgents) {
      const prev = agentStateHistory.current.get(agent.id);
      const current: AgentStateSnapshot = {
        state: agent.state,
        current_task: agent.current_task,
        lastSeen: Date.now(),
      };
      
      if (!prev) {
        // First time seeing this agent - just record state, no animation on initial load
        agentStateHistory.current.set(agent.id, current);
        continue;
      } else {
        // State transition detection
        const wasActive = prev.state !== 'inactive' && prev.state !== 'offline';
        const isActive = agent.state !== 'inactive' && agent.state !== 'offline';
        
        if (!wasActive && isActive) {
          // Agent became active - enter
          changes.push({ agentId: agent.id, type: 'enter', timestamp: Date.now() });
        } else if (wasActive && !isActive) {
          // Agent became inactive - exit
          changes.push({ agentId: agent.id, type: 'exit', timestamp: Date.now() });
        }
      }
      
      agentStateHistory.current.set(agent.id, current);
    }
    
    if (changes.length > 0) {
      setMovementQueue(prev => [...prev, ...changes]);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [agentsRes, reportsRes, pendingRes, tasksRes] = await Promise.all([
          fetch(`${apiBase}/api/office/agents`),
          fetch(`${apiBase}/api/office/reports`),
          fetch(`${apiBase}/api/office/reports?includePending=1`),
          fetch(`${apiBase}/api/tasks`),
        ]);

        const approvedPayload = await reportsRes.json() as { reports?: OfficeReport[] };
        const allPayload = await pendingRes.json() as { reports?: OfficeReport[] };
        const newAgents = (await agentsRes.json()).agents || [];
        
        // Detect state changes for movement animations
        detectStateChanges(newAgents);
        
        setAgents(newAgents);
        setReports(approvedPayload.reports || []);
        setPendingReports((allPayload.reports || []).filter((report) => report.review_status !== 'approved'));
        setTasks(await tasksRes.json());
        setUsingFallbackData(false);
      } catch (error) {
        console.error(error);
        setAgents(FALLBACK_AGENTS);
        setReports([]);
        setPendingReports([]);
        setTasks(FALLBACK_TASKS);
        setUsingFallbackData(true);
      }
    };

    fetchAll().catch(console.error);

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      // Handle specific WebSocket message types
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent.state' && data.agentId && data.state) {
          // Real-time state change - trigger movement if needed
          const prev = agentStateHistory.current.get(data.agentId);
          const wasActive = prev && prev.state !== 'inactive' && prev.state !== 'offline';
          const isActive = data.state !== 'inactive' && data.state !== 'offline';
          
          if (!wasActive && isActive) {
            setMovementQueue(prev => [...prev, { agentId: data.agentId, type: 'enter', timestamp: Date.now() }]);
          } else if (wasActive && !isActive) {
            setMovementQueue(prev => [...prev, { agentId: data.agentId, type: 'exit', timestamp: Date.now() }]);
          }
          
          agentStateHistory.current.set(data.agentId, {
            state: data.state,
            current_task: data.task || null,
            lastSeen: Date.now(),
          });
        }
      } catch {
        // Ignore parse errors
      }
      
      fetchAll().catch(console.error);
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

  const desks = useMemo(() => {
    return DESK_LAYOUT.map((desk) => {
      const officeAgent = agents.find((agent) => agent.id === desk.id);
      const task = taskByAgent.get(desk.id);
      const hasPending = pendingReports.some((report) => report.agent_id === desk.id);
      const state: 'working' | 'blocked' | 'inactive' | 'finished' | 'reserved' = desk.id === 'content'
        ? 'reserved'
        : task?.status === 'complete'
          ? 'finished'
          : task?.blocker_reason
            ? 'blocked'
            : task && ['ready', 'in_progress', 'verification'].includes(task.status)
              ? 'working'
              : hasPending
                ? 'finished'
                : 'inactive';

      return {
        id: desk.id,
        label: desk.label,
        color: officeAgent?.color || '#64748b',
        x: desk.x,
        y: desk.y,
        agent: {
          id: desk.id,
          name: desk.label,
          color: officeAgent?.color || '#64748b',
          state,
          taskTitle: state === 'reserved' ? 'Reserved for future agent' : state === 'finished' ? null : task?.title || null,
          progress: state === 'reserved' ? 0 : officeAgent?.task_progress || (state === 'blocked' ? 55 : state === 'working' ? 35 : 0),
          summary: state === 'reserved' ? 'Future workstation kept open for expansion.' : task?.progress_summary || task?.request_summary || null,
          blocker: state === 'reserved' ? null : task?.blocker_reason || null,
          isClickable: desk.id === 'content' || Boolean(task),
        },
      };
    });
  }, [agents, pendingReports, taskByAgent]);

  // Use real agent data for stats (not the old desk config)
  const activeCount = agents.filter((a) => a.state === 'working').length;
  const blockedCount = agents.filter((a) => a.state === 'blocked').length;

  const openAgentDetail = async (agentId: string) => {
    const task = taskByAgent.get(agentId);
    if (!task) {
      if (agentId === 'content') {
        setSelectedDetail({
          id: 'reserved-future-desk',
          title: 'Reserved future workstation',
          description: 'This desk is intentionally held open for a future agent slot.',
          status: 'ready',
          agent_id: null,
          lane_id: null,
          blocker_reason: null,
          request_summary: 'Reserved desk in the office master scene.',
          completion_summary: null,
          progress_summary: 'No active agent assigned yet. The station stays visible so the room can expand without relayout.',
          next_step: 'Assign a future agent when the next persistent role comes online.',
          model_used: null,
          updated_at: Date.now(),
          agent_name: 'Future agent',
          lane_name: 'Reserved',
          delivery_notes: 'Reserved desk state implemented from scene config spec.',
          office_report: null,
          history: [],
        });
      }
      return;
    }
    if (usingFallbackData && task.id.startsWith('fallback-')) {
      setSelectedDetail({
        ...task,
        delivery_notes: task.id === 'fallback-dev-active' ? 'Master scene implementation is using configured anchors and lightweight overlays.' : null,
        office_report: null,
        history: [],
      });
      return;
    }
    const response = await fetch(`${apiBase}/api/tasks/${task.id}`);
    setSelectedDetail(await response.json());
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

      {/* Movement Demo Controls */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Movement Testing Controls</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => canvasRef.current?.startAgentEnter('mildred', 'mildred')}
            className="rounded-lg bg-teal-600/80 px-3 py-1.5 text-xs text-white hover:bg-teal-500"
          >
            Mildred Enter
          </button>
          <button
            onClick={() => canvasRef.current?.startAgentExit('mildred', 'mildred')}
            className="rounded-lg bg-teal-800/80 px-3 py-1.5 text-xs text-white hover:bg-teal-700"
          >
            Mildred Exit
          </button>
          <button
            onClick={() => canvasRef.current?.startAgentEnter('dev', 'dev')}
            className="rounded-lg bg-gray-600/80 px-3 py-1.5 text-xs text-white hover:bg-gray-500"
          >
            Dev Enter
          </button>
          <button
            onClick={() => canvasRef.current?.startAgentExit('dev', 'dev')}
            className="rounded-lg bg-gray-800/80 px-3 py-1.5 text-xs text-white hover:bg-gray-700"
          >
            Dev Exit
          </button>
          <button
            onClick={() => canvasRef.current?.startAgentEnter('research', 'research')}
            className="rounded-lg bg-amber-700/80 px-3 py-1.5 text-xs text-white hover:bg-amber-600"
          >
            Claire Enter
          </button>
          <button
            onClick={() => canvasRef.current?.startAgentExit('research', 'research')}
            className="rounded-lg bg-amber-900/80 px-3 py-1.5 text-xs text-white hover:bg-amber-800"
          >
            Claire Exit
          </button>
        </div>
      </div>

      {/* New 2D pixel art game canvas */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
        <OfficeCanvas2D
          agents={agents.map((a): OfficeAgent2D => ({
            id: a.id,
            name: a.name,
            state: (['working','blocked','idle','offline','finished','reserved'].includes(a.state)
              ? a.state
              : 'idle') as OfficeAgent2D['state'],
            taskTitle: a.current_task,
            color: a.color,
          }))}
          onSelectAgent={(agentId) => void openAgentDetail(agentId)}
        />
      </div>

      <ReportsPanel
        reports={reports}
        pendingReports={pendingReports}
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        onAcknowledge={acknowledgeReport}
        onApprove={approveReport}
      />

      {selectedDetail && (
        <TaskDetailSheet detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}
    </div>
  );
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
