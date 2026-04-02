import type React from 'react';
import type { Agent, Lane, TaskDraft } from '../types';
import { Field, STATUSES, type StatusId } from './ui';

interface TaskComposerProps {
  draft: TaskDraft;
  setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>;
  agents: Agent[];
  lanes: Lane[];
  editing: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: () => void;
}

export function TaskComposer({
  draft,
  setDraft,
  agents,
  lanes,
  editing,
  onClose,
  onDelete,
  onSubmit,
}: TaskComposerProps) {
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
          <Field label="Progress so far" className="md:col-span-2">
            <textarea value={draft.progress_summary} onChange={(event) => setDraft((prev) => ({ ...prev, progress_summary: event.target.value }))} className="field min-h-24" placeholder="Plain-English update on what has been done so far." />
          </Field>
          <Field label="Next step or ETA">
            <input value={draft.next_step} onChange={(event) => setDraft((prev) => ({ ...prev, next_step: event.target.value }))} className="field" placeholder="Finish review notes by 3pm" />
          </Field>
          <Field label="Model being used">
            <input value={draft.model_used} onChange={(event) => setDraft((prev) => ({ ...prev, model_used: event.target.value }))} className="field" placeholder="MiniMax M2.5" />
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
