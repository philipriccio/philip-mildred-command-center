import { useCallback, useEffect, useState } from 'react';

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  agent_id: string;
  agent_name: string;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  url: string | null;
  category: string;
  collected: number;
  collected_at: number | null;
  created_at: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  report: '📊',
  document: '📄',
  screenshot: '📸',
  build: '🔨',
  contract: '📝',
  script: '🎬',
  design: '🎨',
  general: '📥',
};

function formatTime(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const diff = now.getTime() - ms;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export function InboxDrawer({
  apiBase,
  isOpen,
  onClose,
}: {
  apiBase: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/inbox`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      void fetchItems();
    }
  }, [isOpen, fetchItems]);

  const collectItem = async (id: string) => {
    await fetch(`${apiBase}/api/inbox/${id}/collect`, { method: 'POST' });
    setItems(prev => prev.map(i => i.id === id ? { ...i, collected: 1, collected_at: Date.now() } : i));
  };

  if (!isOpen) return null;

  const uncollected = items.filter(i => !i.collected);
  const collected = items.filter(i => i.collected);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-500">Philip&apos;s Office</p>
            <h2 className="text-lg font-semibold text-slate-100">📥 Inbox</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {loading && <p className="text-sm text-slate-500">Loading...</p>}

          {/* Uncollected items */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wide text-amber-200">New deliverables</h3>
              <span className="text-xs text-slate-500">{uncollected.length}</span>
            </div>
            {uncollected.length === 0 && !loading && (
              <p className="text-sm text-slate-500">Your inbox is empty. Agents will drop deliverables here for you to collect.</p>
            )}
            <div className="space-y-3">
              {uncollected.map(item => (
                <DeliverableCard key={item.id} item={item} apiBase={apiBase} onCollect={collectItem} />
              ))}
            </div>
          </section>

          {/* Collected */}
          {collected.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">Collected</h3>
                <span className="text-xs text-slate-500">{collected.length}</span>
              </div>
              <div className="space-y-2">
                {collected.map(item => (
                  <DeliverableCard key={item.id} item={item} apiBase={apiBase} collected />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function DeliverableCard({
  item,
  apiBase,
  onCollect,
  collected = false,
}: {
  item: Deliverable;
  apiBase: string;
  onCollect?: (id: string) => void;
  collected?: boolean;
}) {
  const icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.general;
  const hasFile = !!item.file_path;
  const hasUrl = !!item.url;

  return (
    <article className={`rounded-2xl border p-4 ${
      collected
        ? 'border-slate-800/50 bg-slate-900/40 opacity-60'
        : 'border-amber-400/25 bg-amber-500/10'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-100">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-slate-300">{item.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>From: {item.agent_name}</span>
            <span>{formatTime(item.created_at)}</span>
            {item.file_size ? <span>{formatSize(item.file_size)}</span> : null}
            {item.file_name ? <span>{item.file_name}</span> : null}
          </div>
        </div>
      </div>

      {!collected && (
        <div className="mt-3 flex gap-2">
          {hasFile && (
            <a
              href={`${apiBase}/api/inbox/${item.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              ⬇ Download
            </a>
          )}
          {hasUrl && (
            <a
              href={item.url!}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              🔗 Open
            </a>
          )}
          {onCollect && (
            <button
              onClick={() => onCollect(item.id)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
            >
              ✓ Collected
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// Hook for polling inbox count (for the canvas badge)
export function useInboxCount(apiBase: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${apiBase}/api/inbox/count`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch { /* ignore */ }
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [apiBase]);

  return count;
}
