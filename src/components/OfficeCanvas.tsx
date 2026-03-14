interface OfficeAgent {
  id: string;
  name: string;
  position_x: number;
  position_y: number;
  state: string;
  current_task: string | null;
  task_progress: number;
  color: string;
}

const CELL = 28;

export function OfficeCanvas({ agents }: { agents: OfficeAgent[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto h-[520px] min-w-[820px] rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_32%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] p-8">
        <div className="absolute left-1/2 top-10 h-16 w-28 -translate-x-1/2 rounded-2xl border border-sky-400/30 bg-sky-300/20" />
        <Desk label="Dev" color="#808080" x={64} y={112} />
        <Desk label="Mildred" color="#008080" x={556} y={112} />
        <Desk label="Content" color="#800080" x={64} y={332} />
        <Desk label="Research" color="#8B4513" x={556} y={332} />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-950/80 px-5 py-3 text-sm text-slate-300">Reports inbox</div>

        {agents.map((agent) => (
          <div
            key={agent.id}
            className="absolute w-36 -translate-x-1/2 -translate-y-1/2"
            style={{ left: agent.position_x * CELL + 32, top: agent.position_y * CELL + 48 }}
          >
            <div className="rounded-2xl border border-slate-700 bg-slate-950/85 p-3 shadow-lg">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: agent.color }} />
                <p className="text-sm font-medium text-slate-100">{agent.name}</p>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{agent.state}</p>
              <p className="mt-2 line-clamp-2 text-xs text-slate-300">{agent.current_task || 'Watching for work'}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${agent.task_progress || 0}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Desk({ label, color, x, y }: { label: string; color: string; x: number; y: number }) {
  return (
    <div className="absolute rounded-[24px] border border-slate-700 bg-slate-950/80 p-4" style={{ left: x, top: y, width: 200 }}>
      <div className="mb-3 h-12 rounded-2xl border border-slate-700 bg-slate-900" />
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-slate-100">{label}</p>
      </div>
    </div>
  );
}
