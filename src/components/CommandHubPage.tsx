import { DeepWorkHealthPanel } from './DeepWorkHealthPanel';
import { Panel, StatusBadge, type StatusId } from './ui';
import type { ProtectedWorkResponse, Task } from '../types';

interface CommandHubPageProps {
  tasks: Task[];
  protectedWork: ProtectedWorkResponse | null;
  onOpenTask: (taskId: string) => void;
  onOpenView: (view: 'office' | 'dashboard' | 'ops' | 'board' | 'projects') => void;
  onApproveTask: (taskId: string) => void;
  onHoldTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
}

function taskSummary(task: Task) {
  return task.next_step || task.progress_summary || task.request_summary || task.description || 'No plain-English summary yet.';
}

function taskStatusLabel(status: StatusId) {
  switch (status) {
    case 'ready': return 'Ready';
    case 'in_progress': return 'In Progress';
    case 'verification': return 'Ready for Review';
    case 'complete': return 'Done';
    case 'backlog': return 'Backlog';
    default: return status;
  }
}

function TaskRow({ task, onOpenTask, onApproveTask, onHoldTask, onRejectTask, actionMode = false }: { task: Task; onOpenTask: (taskId: string) => void; onApproveTask?: (taskId: string) => void; onHoldTask?: (taskId: string) => void; onRejectTask?: (taskId: string) => void; actionMode?: boolean }) {
  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => onOpenTask(task.id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded">
            <p className="truncate font-medium text-slate-100">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">{taskSummary(task)}</p>
          </button>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-slate-800 px-2 py-1">{task.agent_name || 'Unassigned'}</span>
        <span className="rounded-full border border-slate-800 px-2 py-1">{task.lane_name || 'No lane'}</span>
        <span className="rounded-full border border-slate-800 px-2 py-1">{taskStatusLabel(task.status)}</span>
      </div>
      {actionMode && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onApproveTask?.(task.id)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Approve</button>
          <button onClick={() => onHoldTask?.(task.id)} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Hold</button>
          <button onClick={() => onRejectTask?.(task.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-red-400 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Reject</button>
          <button onClick={() => onOpenTask(task.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-blue-400 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Discuss / Details</button>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-5 text-sm text-slate-500">{message}</div>;
}

export function CommandHubPage({ tasks, protectedWork, onOpenTask, onOpenView, onApproveTask, onHoldTask, onRejectTask }: CommandHubPageProps) {
  const needsPhilip = tasks.filter((task) => task.status === 'verification' || /philip|approval|approve|decision|test/i.test(`${task.next_step ?? ''} ${task.request_summary ?? ''} ${task.blocker_reason ?? ''}`));
  const waitingOnPhilip = tasks.filter((task) => /philip/i.test(`${task.next_step ?? ''} ${task.request_summary ?? ''} ${task.blocker_reason ?? ''} ${task.title ?? ''}`) && task.status !== 'complete');
  const blocked = tasks.filter((task) => Boolean(task.blocker_reason) && task.status !== 'complete' && !waitingOnPhilip.some((waiting) => waiting.id === task.id));
  const active = tasks.filter((task) => ['in_progress', 'ready'].includes(task.status) && !task.blocker_reason);
  const recentlyDone = tasks.filter((task) => task.status === 'complete').slice(0, 5);

  const firstPriority = needsPhilip[0] || blocked[0] || active[0] || null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Mission Control Command Hub</p>
        <div className="mt-3 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <h2 className="max-w-3xl text-3xl font-semibold text-slate-50 text-balance">Everything important, reduced to the next clear action.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">This is the plain-English morning desk: what needs Philip, what Mildred is moving, what is blocked, and what is ready for proof. The deeper dashboards stay one click away.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recommended first look</p>
            {firstPriority ? (
              <button onClick={() => onOpenTask(firstPriority.id)} className="mt-3 w-full rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-left text-sm text-blue-100 hover:bg-blue-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <span className="block font-medium">{firstPriority.title}</span>
                <span className="mt-1 block line-clamp-2 text-blue-200/80">{taskSummary(firstPriority)}</span>
              </button>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Nothing urgent is asking for attention.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <button onClick={() => onOpenView('office')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <p className="text-2xl font-semibold text-slate-100">{needsPhilip.length}</p>
          <p className="mt-1 text-sm text-slate-400">Needs Philip</p>
        </button>
        <button onClick={() => onOpenView('office')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <p className="text-2xl font-semibold text-slate-100">{active.length}</p>
          <p className="mt-1 text-sm text-slate-400">Mildred Moving</p>
        </button>
        <button onClick={() => onOpenView('dashboard')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <p className="text-2xl font-semibold text-sky-200">{waitingOnPhilip.length}</p>
          <p className="mt-1 text-sm text-slate-400">Waiting on Philip</p>
        </button>
        <button onClick={() => onOpenView('dashboard')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <p className="text-2xl font-semibold text-amber-200">{blocked.length}</p>
          <p className="mt-1 text-sm text-slate-400">Blocked</p>
        </button>
        <button onClick={() => onOpenView('ops')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <p className="text-2xl font-semibold text-emerald-200">{recentlyDone.length}</p>
          <p className="mt-1 text-sm text-slate-400">Recently Verified</p>
        </button>
      </section>

      <DeepWorkHealthPanel data={protectedWork} />

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Needs Philip" subtitle="Approvals, device tests, decisions, or external actions.">
          <div className="space-y-3">
            {needsPhilip.length === 0 ? <EmptyPanel message="No approvals or decisions are waiting right now." /> : needsPhilip.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} onApproveTask={onApproveTask} onHoldTask={onHoldTask} onRejectTask={onRejectTask} actionMode />)}
          </div>
        </Panel>
        <Panel title="Mildred Moving" subtitle="Work that is active or prepared without needing babysitting.">
          <div className="space-y-3">
            {active.length === 0 ? <EmptyPanel message="No active work packets are currently moving." /> : active.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Waiting on Philip" subtitle="Human actions I need back from you so I can keep moving.">
          <div className="space-y-3">
            {waitingOnPhilip.length === 0 ? <EmptyPanel message="Nothing is currently waiting on you." /> : waitingOnPhilip.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} onApproveTask={onApproveTask} onHoldTask={onHoldTask} onRejectTask={onRejectTask} actionMode />)}
          </div>
        </Panel>
        <Panel title="Blocked / Risk" subtitle="Where progress is constrained and why.">
          <div className="space-y-3">
            {blocked.length === 0 ? <EmptyPanel message="No active blockers in the task mirror." /> : blocked.slice(0, 6).map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Project Cockpits" subtitle="Fast paths into the deeper operating surfaces.">
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => onOpenView('ops')} className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              <p className="font-medium text-red-100">Self-e-Tape Ops</p>
              <p className="mt-1 text-sm text-red-100/70">Build 278 truth gate, diagnostics, product lanes.</p>
            </button>
            <button onClick={() => onOpenView('projects')} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <p className="font-medium text-slate-100">All Projects</p>
              <p className="mt-1 text-sm text-slate-400">Portfolio health, work items, cron links.</p>
            </button>
            <button onClick={() => onOpenView('office')} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <p className="font-medium text-slate-100">Visual Office</p>
              <p className="mt-1 text-sm text-slate-400">Truthful agent activity and live event feed.</p>
            </button>
            <button onClick={() => onOpenView('dashboard')} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <p className="font-medium text-slate-100">Systems Dashboard</p>
              <p className="mt-1 text-sm text-slate-400">Cron, sessions, cost, sites, raw operations.</p>
            </button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
