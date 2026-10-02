import React, { useEffect, useState } from 'react';
import {
  deleteStoredReminder,
  loadStoredReminders,
  toggleReminderCompleted,
} from '../tools/createReminder';
import { ToolExecutionRecord } from '../types/live';
import { ActionCardPayload, ReminderItem } from '../types/tools';
import {
  ExternalLink,
  Globe,
  Search,
  Clock,
  Bell,
  AppWindow,
  X,
  Check,
  Trash2,
} from 'lucide-react';

interface ToolActionHudProps {
  activeCard: ActionCardPayload | null;
  recentActions: ToolExecutionRecord[];
  showDrawer: boolean;
  onCloseCard: () => void;
  onCloseDrawer: () => void;
}

export const ToolActionHud: React.FC<ToolActionHudProps> = ({
  activeCard,
  recentActions,
  showDrawer,
  onCloseCard,
  onCloseDrawer,
}) => {
  const [reminders, setReminders] = useState<ReminderItem[]>(() =>
    loadStoredReminders()
  );

  useEffect(() => {
    const refresh = () => {
      setReminders(loadStoredReminders());
    };
    window.addEventListener('myraa:reminders-updated', refresh);
    return () => window.removeEventListener('myraa:reminders-updated', refresh);
  }, [activeCard, showDrawer]);

  const getIcon = (type: ActionCardPayload['type']) => {
    switch (type) {
      case 'website':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'search':
        return <Search className="w-4 h-4 text-indigo-400" />;
      case 'time':
        return <Clock className="w-4 h-4 text-emerald-400" />;
      case 'reminder':
        return <Bell className="w-4 h-4 text-amber-400" />;
      case 'application':
        return <AppWindow className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <>
      {/* Live Floating Action Card (appears when Myraa executes a tool) */}
      {activeCard && (
        <div className="w-full max-w-md mx-auto px-4 animate-fadeIn">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/85 backdrop-blur-xl border border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.05] shrink-0">
                {getIcon(activeCard.type)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {activeCard.title}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {activeCard.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeCard.url && (
                <a
                  href={activeCard.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={onCloseCard}
                aria-label="Dismiss action card"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions & Reminders Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0A0E1A] border-l border-white/10 h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-100">
                  Voice Actions & Reminders
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Executed browser tools & saved voice reminders
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close actions drawer"
                className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Saved Reminders Section */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-3">
                01. Saved Voice Reminders ({reminders.length})
              </h3>
              {reminders.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 border border-dashed border-white/10 rounded-xl text-center">
                  No reminders yet. Say “Remind me to call Alex at 4 PM” while
                  connected.
                </p>
              ) : (
                <div className="space-y-2">
                  {reminders.map((rem) => (
                    <div
                      key={rem.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-white/[0.07]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setReminders(toggleReminderCompleted(rem.id))
                        }
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div
                          className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 transition-colors ${
                            rem.completed
                              ? 'bg-cyan-400 border-cyan-400 text-slate-950'
                              : 'border-slate-600'
                          }`}
                        >
                          {rem.completed && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              rem.completed
                                ? 'line-through text-slate-500'
                                : 'text-slate-200'
                            }`}
                          >
                            {rem.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            {rem.scheduledFor} · {rem.priority}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReminders(deleteStoredReminder(rem.id))
                        }
                        aria-label="Delete reminder"
                        className="p-2 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Tool Invocations */}
            <div className="mt-8">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-3">
                02. Recent Tool Invocations ({recentActions.length})
              </h3>
              {recentActions.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 border border-dashed border-white/10 rounded-xl text-center">
                  No tools invoked in this session yet. Try saying “Open
                  YouTube” or “What time is it in Tokyo?”.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {recentActions.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.07]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
                        <span className="text-cyan-300 font-medium">
                          {act.toolName}
                        </span>
                        <span>
                          {act.status}
                          {act.durationMs !== undefined
                            ? ` · ${act.durationMs}ms`
                            : ''}
                        </span>
                      </div>
                      {act.summary && (
                        <p className="mt-1 text-xs text-slate-300">
                          {act.summary}
                        </p>
                      )}
                      {act.actionCard?.url && (
                        <a
                          href={act.actionCard.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
                        >
                          <span>Launch {act.actionCard.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
