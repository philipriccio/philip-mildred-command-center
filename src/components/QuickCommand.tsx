import { useCallback, useRef, useState } from 'react';

interface QuickCommandProps {
  apiBase: string;
  onSent?: (agent: string, message: string) => void;
}

const AGENTS = [
  { id: 'main', name: 'Mildred', color: '#14b8a6', shortcut: 'm' },
  { id: 'dev', name: 'Dev', color: '#6b7280', shortcut: 'd' },
  { id: 'janet', name: 'Janet', color: '#d97706', shortcut: 'j' },
];

export function QuickCommand({ apiBase, onSent }: QuickCommandProps) {
  const [message, setMessage] = useState('');
  const [targetAgent, setTargetAgent] = useState('main');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendCommand = useCallback(async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    setLastResult(null);

    try {
      const res = await fetch(`${apiBase}/api/gateway/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: targetAgent,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setLastResult({ ok: true, text: `Sent to ${AGENTS.find(a => a.id === targetAgent)?.name ?? targetAgent}` });
        onSent?.(targetAgent, message.trim());
        setMessage('');
      } else {
        setLastResult({ ok: false, text: data.error ?? 'Send failed' });
      }
    } catch (err) {
      setLastResult({ ok: false, text: String(err) });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [apiBase, message, targetAgent, sending, onSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    }
    // Ctrl+1/2/3 to switch agent
    if (e.ctrlKey && e.key >= '1' && e.key <= '3') {
      e.preventDefault();
      setTargetAgent(AGENTS[parseInt(e.key) - 1]?.id ?? 'main');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Quick Command</h3>
        <div className="flex gap-1">
          {AGENTS.map((agent, i) => (
            <button
              key={agent.id}
              onClick={() => setTargetAgent(agent.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                targetAgent === agent.id
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={targetAgent === agent.id ? { backgroundColor: agent.color + '30', color: agent.color } : undefined}
              title={`Ctrl+${i + 1}`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${AGENTS.find(a => a.id === targetAgent)?.name ?? 'agent'}...`}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
          disabled={sending}
        />
        <button
          onClick={sendCommand}
          disabled={!message.trim() || sending}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>

      {lastResult && (
        <p className={`mt-2 text-xs ${lastResult.ok ? 'text-green-400' : 'text-red-400'}`}>
          {lastResult.text}
        </p>
      )}

      <p className="mt-2 text-[10px] text-slate-600">
        Enter to send · Ctrl+1/2/3 switch agent
      </p>
    </div>
  );
}
