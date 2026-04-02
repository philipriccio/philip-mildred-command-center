export interface NotificationToastItem {
  id: string;
  title: string;
  body: string;
  tone: 'red' | 'amber' | 'purple';
}

interface NotificationToastProps {
  notifications: NotificationToastItem[];
}

const toneClassMap: Record<NotificationToastItem['tone'], string> = {
  red: 'border-red-500/40 bg-red-500/10 text-red-100',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-100',
};

export function NotificationToast({ notifications }: NotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {notifications.map((notification) => (
        <div key={notification.id} className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${toneClassMap[notification.tone]}`}>
          <p className="text-sm font-semibold">{notification.title}</p>
          <p className="mt-1 text-sm text-slate-200">{notification.body}</p>
        </div>
      ))}
    </div>
  );
}
