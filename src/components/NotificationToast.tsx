export interface NotificationToastItem {
  id: string;
  title: string;
  body: string;
  tone: 'red' | 'amber' | 'purple';
}

interface NotificationToastProps {
  notifications: NotificationToastItem[];
  onDismiss?: (id: string) => void;
}

const toneClassMap: Record<NotificationToastItem['tone'], string> = {
  red: 'border-red-500/40 bg-red-950/90 text-red-100',
  amber: 'border-amber-500/40 bg-amber-950/90 text-amber-100',
  purple: 'border-purple-500/40 bg-purple-950/90 text-purple-100',
};

const iconMap: Record<NotificationToastItem['tone'], string> = {
  red: '🔴',
  amber: '⚠️',
  purple: '🟣',
};

export function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto animate-in slide-in-from-right-5 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-sm transition-all duration-300 ${toneClassMap[notification.tone]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-sm">{iconMap[notification.tone]}</span>
              <div>
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="mt-0.5 text-xs text-slate-300">{notification.body}</p>
              </div>
            </div>
            {onDismiss && (
              <button
                onClick={() => onDismiss(notification.id)}
                className="mt-0.5 text-xs text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
