import type React from 'react';

const STATUSES = [
  { id: 'backlog', label: 'Backlog', tone: 'bg-slate-700 text-slate-100 border-slate-600' },
  { id: 'ready', label: 'Ready', tone: 'bg-blue-500/15 text-blue-200 border-blue-400/40' },
  { id: 'in_progress', label: 'In Progress', tone: 'bg-amber-500/15 text-amber-200 border-amber-400/40' },
  { id: 'verification', label: 'Verification', tone: 'bg-purple-500/15 text-purple-200 border-purple-400/40' },
  { id: 'complete', label: 'Complete', tone: 'bg-green-500/15 text-green-200 border-green-400/40' },
] as const;

export type StatusId = (typeof STATUSES)[number]['id'];
export { STATUSES };

export function statusMeta(status: StatusId) {
  return STATUSES.find((item) => item.id === status) ?? STATUSES[0];
}

export function formatDateTime(value?: number | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function formatShortDate(value?: number | null) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleDateString();
}

export function ConnectionBadge({ label, online }: { label: string; online: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {label}
    </div>
  );
}

export function AlertCard({ title, body, tone }: { title: string; body: string; tone: 'red' | 'amber' }) {
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

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">{message}</div>;
}

export function StatusBadge({ status }: { status: StatusId }) {
  const meta = statusMeta(status);
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>;
}

export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-sm font-medium text-slate-100">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="mb-2 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}
