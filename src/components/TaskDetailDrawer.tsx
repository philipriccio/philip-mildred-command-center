import type React from 'react';
import type { Agent, TaskDetail } from '../types';
import { DetailBlock, EmptyState, Field, formatDateTime, formatShortDate, InfoCard, Panel, STATUSES, StatusBadge, type StatusId } from './ui';

interface TaskDetailDrawerProps {
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
  apiBase: string;
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
}

export function TaskDetailDrawer({
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
  apiBase,
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
}: TaskDetailDrawerProps) {
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
            <InfoCard label="Model used" value={task.model_used || 'Not recorded'} />
            <InfoCard label="Report status" value={task.office_report?.review_status === 'approved' ? 'Approved by Mildred' : task.status === 'complete' ? 'Waiting for Mildred review' : 'Not ready yet'} />
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
                <DetailBlock title="Short summary" body={task.request_summary || task.description || 'No request summary yet.'} />
                <DetailBlock title="Progress so far" body={task.progress_summary || 'No progress update yet.'} />
                <DetailBlock title="Next step or ETA" body={task.next_step || 'No next step recorded.'} />
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
                        <a href={`${apiBase}/api/evidence/${item.id}/download`} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">Download</a>
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
