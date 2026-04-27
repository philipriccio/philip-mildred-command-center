import { useEffect, useState } from 'react';
import { selfTapeOpsData } from '../selfTapeOperatingSystem';
import type { OpsStatus, SelfTapeLiveStatus } from '../types';
import { Panel } from './ui';

const statusStyles: Record<OpsStatus, string> = {
  green: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  yellow: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  red: 'border-rose-400/50 bg-rose-500/10 text-rose-100',
};

const dotStyles: Record<OpsStatus, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-rose-400',
};

const packetStatusStyles: Record<string, string> = {
  ready: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  in_progress: 'border-blue-400/30 bg-blue-500/10 text-blue-100',
  waiting: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  blocked: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
};

function StatusPill({ status }: { status: OpsStatus }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[status]}`}>
      <span className={`h-2 w-2 rounded-full ${dotStyles[status]}`} />
      {status}
    </span>
  );
}

function AuthorityColumn({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em]">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

export function SelfTapeOpsPage({ apiBase }: { apiBase: string }) {
  const data = selfTapeOpsData;
  const [liveStatus, setLiveStatus] = useState<SelfTapeLiveStatus | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/selftape/status`)
      .then((response) => {
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        return response.json() as Promise<SelfTapeLiveStatus>;
      })
      .then((status) => {
        if (!cancelled) setLiveStatus(status);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLiveError(error instanceof Error ? error.message : 'Status unavailable');
      });
    return () => { cancelled = true; };
  }, [apiBase]);

  const redCount = data.journey.filter((item) => item.status === 'red').length;
  const yellowCount = data.journey.filter((item) => item.status === 'yellow').length;
  const greenCount = data.journey.filter((item) => item.status === 'green').length;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-orange-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/40 p-6 shadow-2xl shadow-orange-950/20">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-orange-300/80">Self-e-Tape operating system</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{data.northStar.goal}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{data.northStar.strategy}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/80 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Current phase</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{data.northStar.phase}</p>
            <div className="mt-5 rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Mildred recommendation</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{data.northStar.currentRecommendation}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-100/80">Red trust gates</p>
          <p className="mt-2 text-3xl font-semibold text-rose-100">{redCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-100/80">Needs device/product proof</p>
          <p className="mt-2 text-3xl font-semibold text-amber-100">{yellowCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-100/80">Green lanes</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-100">{greenCount}</p>
        </div>
      </section>

      <Panel title="Live build edge" subtitle="Current repo/build state from SelfTapeApp, plus the next recommended action.">
        {liveStatus ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Branch</p>
                <p className="mt-2 font-semibold text-slate-100">{liveStatus.branch ?? 'unknown'}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Head / build</p>
                <p className="mt-2 font-semibold text-slate-100">{liveStatus.head ?? 'unknown'} · {liveStatus.buildNumber ?? '—'}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${liveStatus.dirty ? 'border-amber-400/30 bg-amber-500/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Working tree</p>
                <p className="mt-2 font-semibold text-slate-100">{liveStatus.dirty ? 'Dirty — clean before build' : 'Clean'}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${liveStatus.easIncident.active ? 'border-rose-400/30 bg-rose-500/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Expo/EAS</p>
                <p className="mt-2 font-semibold text-slate-100">{liveStatus.easIncident.active ? 'Incident active' : 'No active iOS incident detected'}</p>
                {liveStatus.easIncident.summary && <p className="mt-1 text-xs text-slate-400">{liveStatus.easIncident.summary}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Recommended next action</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{liveStatus.recommendedAction}</p>
              {liveStatus.buildAttempts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {liveStatus.buildAttempts.map((attempt) => (
                    <div key={`${attempt.build}-${attempt.status}`} className="rounded-xl border border-slate-700/70 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                      <span className="font-semibold text-slate-100">Build {attempt.build}</span> — {attempt.status}{attempt.note ? ` · ${attempt.note}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            {liveError ? `Live status unavailable: ${liveError}` : 'Loading live Self-e-Tape status…'}
          </div>
        )}
      </Panel>

      <Panel title="Actor journey health" subtitle="The app must win every step from sides to submission-ready tape.">
        <div className="grid gap-3">
          {data.journey.map((item) => (
            <div key={item.step} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-100">{item.step}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.evidence}</p>
                </div>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">Next: </span>{item.nextAction}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Authority boundaries" subtitle="This is how I move without overstepping.">
          <div className="grid gap-4">
            <AuthorityColumn title="Green — I can move" tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-100" items={data.authority.green} />
            <AuthorityColumn title="Yellow — I prepare, you approve" tone="border-amber-500/30 bg-amber-500/10 text-amber-100" items={data.authority.yellow} />
            <AuthorityColumn title="Red — explicit approval only" tone="border-rose-500/30 bg-rose-500/10 text-rose-100" items={data.authority.red} />
          </div>
        </Panel>

        <Panel title="Proactive loops" subtitle="The recurring reviews that keep me moving toward the north star.">
          <div className="space-y-3">
            {data.proactiveLoops.map((loop) => (
              <div key={loop.name} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-100">{loop.name}</h3>
                  <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-200">{loop.cadence}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{loop.output}</p>
                <p className="mt-2 text-xs text-slate-500">Trigger: {loop.trigger}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Decisions needed" subtitle="These are the points where I should prepare the recommendation, but Philip owns the call.">
          <div className="space-y-3">
            {data.decisions.map((decision) => (
              <div key={decision.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="font-semibold text-slate-100">{decision.title}</h3>
                <p className="mt-2 text-sm text-slate-400">Needed from: {decision.neededFrom}</p>
                <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm leading-6 text-slate-200">
                  <span className="font-medium text-slate-100">Recommendation: </span>{decision.recommendation}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Timing: {decision.timing}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Action packets" subtitle="Work I can move, hold, or bring for approval without waiting for a vague prompt.">
          <div className="space-y-3">
            {data.actionPackets.map((packet) => (
              <div key={packet.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-100">{packet.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Owner: {packet.owner}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${packetStatusStyles[packet.status] ?? 'border-slate-700 bg-slate-800 text-slate-200'}`}>{packet.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{packet.nextStep}</p>
                {packet.approvalNeeded && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Approval needed</p>}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Watched signals" subtitle="The signals I should keep scanning so I can come to Philip with strategy instead of waiting.">
        <div className="grid gap-3 lg:grid-cols-2">
          {data.watchedSignals.map((signal) => (
            <div key={signal.signal} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="font-semibold text-slate-100">{signal.signal}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{signal.whyItMatters}</p>
              <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300"><span className="font-medium text-slate-100">Response: </span>{signal.response}</p>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Risks I am watching">
          <div className="space-y-3">
            {data.risks.map((risk) => (
              <div key={risk.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-100">{risk.title}</h3>
                  <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs uppercase tracking-wide text-rose-100">{risk.severity}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">Owner: {risk.owner}</p>
                <p className="mt-2 text-sm text-slate-300">{risk.status}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Strategic opportunities">
          <div className="space-y-3">
            {data.opportunities.map((opportunity) => (
              <div key={opportunity.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-100">{opportunity.title}</h3>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">{opportunity.impact} impact</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{opportunity.nextAction}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
