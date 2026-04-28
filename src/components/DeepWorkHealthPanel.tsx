const CATEGORIES = [
  {
    key: 'writing',
    label: 'Writing',
    goal: 'Protect focused pages / rewrite progress',
    time: 'unknown',
    progress: 'No confirmed writing time logged yet this week.',
    tone: 'border-red-500/30 bg-red-500/10 text-red-100',
  },
  {
    key: 'reading',
    label: 'Reading',
    goal: 'Hawco + Company Theatre development leverage',
    time: 'unknown',
    progress: 'No confirmed reading progress logged yet this week.',
    tone: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  },
  {
    key: 'workout',
    label: 'Workout',
    goal: 'Daily physical maintenance',
    time: 'unknown',
    progress: 'No confirmed workouts logged yet this week.',
    tone: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  },
  {
    key: 'acting',
    label: 'Auditions / acting',
    goal: 'Craft + career opportunities',
    time: 'unknown',
    progress: 'No confirmed audition or acting-work progress logged yet.',
    tone: 'border-purple-400/30 bg-purple-400/10 text-purple-100',
  },
  {
    key: 'networking',
    label: 'Networking',
    goal: 'High-leverage relationships',
    time: 'unknown',
    progress: 'No confirmed networking progress logged yet this week.',
    tone: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  },
  {
    key: 'tv',
    label: 'TV / industry watching',
    goal: 'Legitimate Hawco development work',
    time: 'unknown',
    progress: 'No confirmed industry-watching progress logged yet this week.',
    tone: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-100',
  },
];

export function DeepWorkHealthPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Creative / Deep Work Health</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">Weekly time + progress</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            This is not a daily checkbox scorecard. It tracks whether time and meaningful progress are being protected for the work only Philip can do.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">This week</span>
          <span className="mt-1 block font-medium text-slate-100">No confirmed entries yet</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {CATEGORIES.map((category) => (
          <div key={category.key} className={`rounded-2xl border p-4 ${category.tone}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{category.label}</p>
                <p className="mt-1 text-xs opacity-75">{category.goal}</p>
              </div>
              <div className="rounded-xl border border-current/20 bg-black/20 px-3 py-2 text-right">
                <span className="block text-[10px] uppercase tracking-[0.2em] opacity-70">Time</span>
                <span className="text-sm font-semibold">{category.time}</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-current/15 bg-black/15 p-3 text-sm leading-6 opacity-90">
              {category.progress}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">
        <span className="font-medium text-slate-200">Next wiring step: </span>
        connect this panel to <code className="rounded bg-slate-900 px-1 py-0.5">memory/protected-work-log.md</code> or a backend store so time/progress updates automatically from known context and Philip reports.
      </div>
    </section>
  );
}
