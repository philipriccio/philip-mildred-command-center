const CATEGORIES = [
  { key: 'writing', label: 'Writing', note: 'Hardest / protect first', tone: 'bg-red-500' },
  { key: 'reading', label: 'Reading', note: 'Hawco + CT leverage', tone: 'bg-amber-400' },
  { key: 'workout', label: 'Workout', note: 'Daily must', tone: 'bg-emerald-400' },
  { key: 'acting', label: 'Auditions / acting', note: 'Craft + career', tone: 'bg-purple-400' },
  { key: 'networking', label: 'Networking', note: 'Relationship leverage', tone: 'bg-sky-400' },
  { key: 'tv', label: 'TV / industry watching', note: 'Hawco development work', tone: 'bg-indigo-400' },
];

export function DeepWorkHealthPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Creative / Deep Work Health</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">Rolling weekly view</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            This is accountability without guilt: did the work only Philip can do get protected while Mildred moved the rest?
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">Private signal</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((category) => (
          <div key={category.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${category.tone}`} />
              <p className="font-medium text-slate-100">{category.label}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">{category.note}</p>
            <div className="mt-4 grid grid-cols-7 gap-1" aria-label={`${category.label} weekly tracking placeholders`}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <div key={`${category.key}-${day}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/80 py-1 text-center text-[10px] text-slate-500">
                  {day}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Next step: connect this panel to <code className="rounded bg-slate-950 px-1 py-0.5">memory/protected-work-log.md</code> so known completions and misses render automatically.
      </p>
    </section>
  );
}
