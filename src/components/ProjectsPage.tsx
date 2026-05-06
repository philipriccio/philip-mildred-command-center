import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, Panel } from './ui';
import type { CronJob, ProjectDetail, ProjectSummary, WorkItem, WorkItemStatus } from '../types';

const WORK_ITEM_COLUMNS: Array<{ id: WorkItemStatus; label: string }> = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

const PROJECT_PRIORITY: Record<string, number> = {
  selftape: 0,
  'command-center': 1,
  'hawco-crm': 2,
  coverageiq: 3,
};

function sortProjects(projects: ProjectSummary[]) {
  return [...projects].sort((a, b) => {
    const aPriority = PROJECT_PRIORITY[a.id] ?? 50;
    const bPriority = PROJECT_PRIORITY[b.id] ?? 50;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name);
  });
}

const AGENT_OPTIONS = [
  { id: '', name: 'Unassigned' },
  { id: 'main', name: 'Mildred' },
  { id: 'dev', name: 'Dev' },
  { id: 'janet', name: 'Janet' },
  { id: 'kimi', name: 'Kimi' },
  { id: 'gpt-mini', name: 'GPT-mini' },
];

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 1,
  status: 'todo' as WorkItemStatus,
  assigned_agent: '',
  blocker_reason: '',
};

function formatSchedule(schedule: CronJob['schedule']) {
  if (schedule.kind === 'cron') return `${schedule.expr ?? ''}${schedule.tz ? ` (${schedule.tz})` : ''}`.trim();
  if (schedule.kind === 'every') return `Every ${Math.round((schedule.everyMs ?? 0) / 60000)}m`;
  if (schedule.kind === 'at') return `At ${schedule.at ?? '—'}`;
  return schedule.kind;
}

function statusTone(status?: string) {
  if (status === 'ok') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'error') return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}


function cockpitTone(status: 'green' | 'yellow' | 'red' | 'slate') {
  if (status === 'green') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  if (status === 'yellow') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  if (status === 'red') return 'border-rose-400/40 bg-rose-500/10 text-rose-100';
  return 'border-slate-800 bg-slate-950/60 text-slate-200';
}

function freshnessLabel(freshness?: NonNullable<ProjectDetail['cockpit']>['freshness']) {
  if (freshness === 'live') return 'Live checked now';
  if (freshness === 'mixed') return 'Mixed live + manual';
  if (freshness === 'static') return 'Static / needs refresh';
  if (freshness === 'unavailable') return 'Unavailable';
  return 'No cockpit configured';
}

function priorityTone(priority: number) {
  if (priority <= 0) return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  if (priority === 1) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (priority === 2) return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function WorkItemEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: typeof EMPTY_FORM;
  onChange: (next: typeof EMPTY_FORM) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
      <input className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" placeholder="Work item title" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      <textarea className="min-h-24 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" placeholder="Description" value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      <div className="grid gap-3 md:grid-cols-3">
        <select className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={value.priority} onChange={(e) => onChange({ ...value, priority: Number(e.target.value) })}>
          {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{`P${n}`}</option>)}
        </select>
        <select className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as WorkItemStatus })}>
          {WORK_ITEM_COLUMNS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={value.assigned_agent} onChange={(e) => onChange({ ...value, assigned_agent: e.target.value })}>
          {AGENT_OPTIONS.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
      </div>
      <input className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100" placeholder="Blocker reason (for blocked items)" value={value.blocker_reason} onChange={(e) => onChange({ ...value, blocker_reason: e.target.value })} />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:text-white">Cancel</button>
        <button onClick={onSave} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">Save item</button>
      </div>
    </div>
  );
}

export function ProjectsPage({ apiBase }: { apiBase: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const response = await fetch(`${apiBase}/api/projects`);
    const data = sortProjects(await response.json());
    setProjects(data);
    if (!selectedId && data[0]?.id) setSelectedId(data[0].id);
  }, [apiBase, selectedId]);

  const loadProject = useCallback(async (projectId: string) => {
    const response = await fetch(`${apiBase}/api/projects/${projectId}`);
    const data = await response.json();
    setDetail(data);
  }, [apiBase]);

  const loadCronJobs = useCallback(async () => {
    const response = await fetch(`${apiBase}/api/cron/jobs`);
    if (!response.ok) return;
    const data = await response.json();
    setCronJobs(data.jobs ?? []);
  }, [apiBase]);

  const refresh = useCallback(async (projectId = selectedId) => {
    setLoading(true);
    await loadProjects();
    if (projectId) await loadProject(projectId);
    await loadCronJobs();
    setLoading(false);
  }, [loadCronJobs, loadProject, loadProjects, selectedId]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh().catch(console.error);
    });
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    queueMicrotask(() => {
      void loadProject(selectedId).catch(console.error);
    });
  }, [loadProject, selectedId]);

  const isSelfTape = detail?.id === 'selftape';
  const visibleWorkItems = useMemo(() => (isSelfTape ? [] : (detail?.work_items ?? [])), [detail?.work_items, isSelfTape]);

  const groupedItems = useMemo(() => {
    const groups: Record<WorkItemStatus, WorkItem[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const item of visibleWorkItems) groups[item.status].push(item);
    return groups;
  }, [visibleWorkItems]);

  const availableCronJobs = useMemo(() => {
    const linked = new Set(detail?.cron_job_ids ?? []);
    return cronJobs.filter((job) => !linked.has(job.id));
  }, [cronJobs, detail]);

  const startEdit = (item: WorkItem) => {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      description: item.description ?? '',
      priority: item.priority,
      status: item.status,
      assigned_agent: item.assigned_agent ?? '',
      blocker_reason: item.blocker_reason ?? '',
    });
  };

  const saveNewItem = async () => {
    if (!detail || !draft.title.trim()) return;
    await fetch(`${apiBase}/api/projects/${detail.id}/work-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, assigned_agent: draft.assigned_agent || null, blocker_reason: draft.blocker_reason || null }),
    });
    setDraft(EMPTY_FORM);
    setShowAddForm(false);
    await refresh(detail.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch(`${apiBase}/api/work-items/${editingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, assigned_agent: draft.assigned_agent || null, blocker_reason: draft.blocker_reason || null }),
    });
    setEditingId(null);
    setDraft(EMPTY_FORM);
    if (detail) await refresh(detail.id);
  };

  const updateItem = async (itemId: string, payload: Partial<WorkItem>) => {
    await fetch(`${apiBase}/api/work-items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (detail) await refresh(detail.id);
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`${apiBase}/api/work-items/${itemId}`, { method: 'DELETE' });
    if (detail) await refresh(detail.id);
  };

  const linkCron = async (cronJobId: string) => {
    if (!detail || !cronJobId) return;
    await fetch(`${apiBase}/api/projects/${detail.id}/cron-links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron_job_id: cronJobId }),
    });
    await refresh(detail.id);
  };

  const unlinkCron = async (cronJobId: string) => {
    if (!detail) return;
    await fetch(`${apiBase}/api/projects/${detail.id}/cron-links/${encodeURIComponent(cronJobId)}`, { method: 'DELETE' });
    await refresh(detail.id);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Projects" subtitle="Self-e-Tape is pinned first; every project opens into its cockpit and work queue.">
        <div className="space-y-3">
          {projects.map((project) => (
            <button key={project.id} onClick={() => setSelectedId(project.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === project.id ? 'border-blue-500/50 bg-slate-900' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                    <p className="truncate font-medium text-slate-100">{project.name}</p>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{project.slug}</p>
                  {project.id === 'selftape' && <p className="mt-2 inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-200">Pinned cockpit</p>}
                </div>
                <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">{project.open_work_items_count}</span>
              </div>
            </button>
          ))}
          {projects.length === 0 && <EmptyState message="No projects found." />}
        </div>
      </Panel>

      <div className="space-y-6">
        {!detail && !loading && <EmptyState message="Select a project to see its queue and linked cron jobs." />}
        {detail && (
          <>
            <Panel title={detail.name} subtitle={detail.description ?? 'Project overview and linked automation.'}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-500">Repository</p>
                  {detail.repo_url ? <a href={detail.repo_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-blue-300 hover:text-blue-200">{detail.repo_url}</a> : <p className="mt-2 text-sm text-slate-400">Not set</p>}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-500">Live URL</p>
                  {detail.live_url ? <a href={detail.live_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-blue-300 hover:text-blue-200">{detail.live_url}</a> : <p className="mt-2 text-sm text-slate-400">Not set</p>}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-500">Local path</p>
                  <p className="mt-2 break-all text-sm text-slate-300">{detail.local_path ?? 'Not set'}</p>
                </div>
              </div>
            </Panel>

            <Panel title={detail.cockpit?.title ?? `${detail.name} cockpit`} subtitle={detail.cockpit ? `${freshnessLabel(detail.cockpit.freshness)} · ${detail.cockpit.evidenceLabel}` : 'Live operating state for this project.'}>
              {detail.cockpit ? (
                isSelfTape ? (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-sky-400/30 bg-sky-500/10 p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-sky-200">Mission</p>
                      <p className="mt-2 max-w-4xl text-xl font-semibold leading-8 text-sky-50">{detail.cockpit.mission}</p>
                    </div>

                    {detail.cockpit.betaStatus && (
                      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-rose-200">Beta readiness</p>
                            <h3 className="mt-2 text-2xl font-bold text-rose-50">{detail.cockpit.betaStatus.label}</h3>
                            <p className="mt-2 max-w-4xl text-sm leading-6 text-rose-50/90">{detail.cockpit.betaStatus.body}</p>
                          </div>
                          <span className="rounded-full border border-rose-300/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100">Blocked</span>
                        </div>
                      </div>
                    )}

                    {detail.cockpit.warnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Plain-English rules</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50">
                          {detail.cockpit.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                        </ul>
                      </div>
                    )}

                    <div>
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Current major blockers</p>
                          <h3 className="mt-1 text-lg font-semibold text-slate-100">The three things stopping beta right now</h3>
                        </div>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-3">
                        {(detail.cockpit.betaBlockers ?? []).map((blocker) => (
                          <div key={blocker.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-lg font-bold text-slate-50">{blocker.title}</h4>
                              <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200">{blocker.status}</span>
                            </div>
                            <p className="mt-3 text-sm font-medium leading-6 text-slate-200">Goal: {blocker.goal}</p>
                            <div className="mt-4 space-y-3 text-sm leading-6">
                              <p className="text-slate-300"><span className="font-semibold text-slate-100">Current truth: </span>{blocker.currentTruth}</p>
                              <p className="text-slate-400"><span className="font-semibold text-slate-200">Why it blocks beta: </span>{blocker.whyItBlocksBeta}</p>
                              <p className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-50"><span className="font-semibold">Next action: </span>{blocker.nextAction}</p>
                              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-400">Proof level: </span>{blocker.proofLevel}</p>
                            </div>
                            {blocker.reports.length > 0 && (
                              <div className="mt-4 border-t border-slate-800 pt-3">
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reports</p>
                                <div className="mt-2 space-y-2">
                                  {blocker.reports.map((report) => (
                                    <div key={`${blocker.id}-${report.label}`} className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                                      <p className="text-sm font-medium text-slate-200">{report.label}</p>
                                      <p className="mt-1 text-xs leading-5 text-slate-500">{report.note}{report.path ? ` · ${report.path}` : ''}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Other app areas</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">These still matter, but they are not the current top beta blockers.</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {(detail.cockpit.secondaryAreas ?? []).map((area) => (
                            <div key={area.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-100">{area.title}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${area.status === 'ok' ? 'border-emerald-400/30 text-emerald-200' : area.status === 'needs_work' ? 'border-amber-400/30 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{area.status.replace('_', ' ')}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{area.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Reports / history</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">Plain-English trail of what we tried, what failed, what worked, and what not to repeat.</p>
                        <div className="mt-4 space-y-2">
                          {(detail.cockpit.reports ?? []).map((report) => (
                            <div key={report.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                              <p className="text-sm font-medium text-slate-100">{report.label}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{report.note}{report.path ? ` · ${report.path}` : ''}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <details className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-200">Technical source / freshness details</summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {detail.cockpit.sections.map((section) => (
                          <div key={section.title} className={`rounded-2xl border p-4 ${cockpitTone(section.status)}`}>
                            <h3 className="font-semibold text-current">{section.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-current/90">{section.body}</p>
                            {section.evidence && <p className="mt-3 rounded-xl border border-current/15 bg-black/10 px-3 py-2 text-xs leading-5 text-current/80"><span className="font-semibold">Evidence: </span>{section.evidence}</p>}
                            {section.nextAction && <p className="mt-2 text-xs leading-5 text-current/75"><span className="font-semibold">Next: </span>{section.nextAction}</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-blue-200">Current truth</p>
                          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-50">{detail.cockpit.summary}</p>
                        </div>
                        <span className="rounded-full border border-blue-300/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">{freshnessLabel(detail.cockpit.freshness)}</span>
                      </div>
                    </div>

                    {detail.cockpit.warnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Read before trusting this page</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50">
                          {detail.cockpit.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                      {detail.cockpit.sections.map((section) => (
                        <div key={section.title} className={`rounded-2xl border p-4 ${cockpitTone(section.status)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-current">{section.title}</h3>
                            <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{section.status}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-current/90">{section.body}</p>
                          {section.evidence && <p className="mt-3 rounded-xl border border-current/15 bg-black/10 px-3 py-2 text-xs leading-5 text-current/80"><span className="font-semibold">Evidence: </span>{section.evidence}</p>}
                          {section.nextAction && <p className="mt-2 text-xs leading-5 text-current/75"><span className="font-semibold">Next: </span>{section.nextAction}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : <EmptyState message="No live cockpit has been configured for this project yet." />}
            </Panel>

            {!isSelfTape && (
              <Panel title="Work Queue" subtitle="Grouped by status for this project.">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">Open items: {visibleWorkItems.filter((item) => item.status !== 'done').length}</p>
                  <button onClick={() => { setShowAddForm((v) => !v); setEditingId(null); setDraft(EMPTY_FORM); }} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">Add item</button>
                </div>
                {showAddForm && <div className="mb-4"><WorkItemEditor value={draft} onChange={setDraft} onSave={() => void saveNewItem()} onCancel={() => { setShowAddForm(false); setDraft(EMPTY_FORM); }} /></div>}
                <div className="space-y-5">
                  {WORK_ITEM_COLUMNS.map((column) => (
                    <div key={column.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{column.label}</h3>
                        <span className="text-xs text-slate-500">{groupedItems[column.id].length}</span>
                      </div>
                      <div className="space-y-3">
                        {groupedItems[column.id].map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            {editingId === item.id ? (
                              <WorkItemEditor value={draft} onChange={setDraft} onSave={() => void saveEdit()} onCancel={() => { setEditingId(null); setDraft(EMPTY_FORM); }} />
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <input type="checkbox" checked={item.status === 'done'} onChange={(e) => void updateItem(item.id, { status: e.target.checked ? 'done' : 'todo' })} className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-500" />
                                    <button onClick={() => startEdit(item)} className="text-left">
                                      <p className="font-medium text-slate-100">{item.title}</p>
                                      {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
                                    </button>
                                  </div>
                                  <button onClick={() => void deleteItem(item.id)} className="text-sm text-slate-500 hover:text-rose-300">✕</button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <span className={`rounded-full border px-2.5 py-1 ${priorityTone(item.priority)}`}>{`P${item.priority}`}</span>
                                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">{item.assigned_agent ?? 'Unassigned'}</span>
                                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">{column.label}</span>
                                </div>
                                {item.status === 'blocked' && item.blocker_reason && <p className="mt-3 text-sm text-amber-300">Blocked: {item.blocker_reason}</p>}
                              </>
                            )}
                          </div>
                        ))}
                        {groupedItems[column.id].length === 0 && <EmptyState message={`No ${column.label.toLowerCase()} items.`} />}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Cron Jobs" subtitle="Automation linked to this project.">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <select defaultValue="" onChange={(e) => { void linkCron(e.target.value); e.currentTarget.value = ''; }} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                  <option value="">Link cron job…</option>
                  {availableCronJobs.map((job) => <option key={job.id} value={job.id}>{job.name || job.id}</option>)}
                </select>
                <span className="text-sm text-slate-500">{detail.cron_jobs.length} linked</span>
              </div>
              <div className="space-y-3">
                {detail.cron_jobs.map((job) => {
                  const lastStatus = job.state?.lastStatus ?? job.state?.lastRunStatus ?? 'unknown';
                  return (
                    <div key={job.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div>
                        <p className="font-medium text-slate-100">{job.name || job.id}</p>
                        <p className="mt-1 text-sm text-slate-400">{formatSchedule(job.schedule)}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full border px-2.5 py-1 ${statusTone(lastStatus)}`}>{lastStatus}</span>
                          {job.state?.lastRunAtMs && <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">Last run {new Date(job.state.lastRunAtMs).toLocaleString()}</span>}
                        </div>
                      </div>
                      <button onClick={() => void unlinkCron(job.id)} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:text-white">Unlink</button>
                    </div>
                  );
                })}
                {detail.cron_jobs.length === 0 && <EmptyState message="No cron jobs linked to this project." />}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
