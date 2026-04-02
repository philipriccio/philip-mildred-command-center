import type { Task } from '../types';
import { formatDateTime, StatusBadge, statusMeta, type StatusId } from './ui';

interface WatchRowProps {
  task: Task;
  onOpen: () => void;
  onAdvance: (status: StatusId) => void;
}

export function WatchRow({ task, onOpen, onAdvance }: WatchRowProps) {
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
