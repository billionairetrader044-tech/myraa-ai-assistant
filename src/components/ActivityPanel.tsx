import React from 'react';
import { AiraBackendSnapshot } from '../types/aira';
import {
  X,
  Activity,
  Download,
  Monitor,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface ActivityPanelProps {
  isOpen: boolean;
  apiConfiguredOnServer: boolean | null;
  backend: AiraBackendSnapshot | null;
  onExecuteQuickTool: (tool: string, args: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  isOpen,
  apiConfiguredOnServer,
  backend,
  onExecuteQuickTool,
  onClose,
}) => {
  if (!isOpen) return null;

  const activities = backend?.activities || [];
  const openWindows = backend?.openWindows || [];
  const browserTabs = backend?.browserTabs || [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AIRA Activity and Agent Telemetry"
    >
      <div className="relative w-full max-w-lg bg-[#0A0E1A] border-l border-white/10 h-full flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-display font-bold text-slate-100">
                Agent Activity & Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Real-time Windows Agent, Browser Agent & Action Log
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity panel"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6 flex-1">
          {/* 1. Desktop Agent Status Matrix (Section 29) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5 text-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Sub-Agent Connection Status
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-300">AIRA Cloud / AI</span>
                <span className="font-mono text-emerald-400">
                  ● {apiConfiguredOnServer ? 'Connected' : 'Local Mode'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-300">Windows Agent</span>
                <span
                  className={`font-mono ${
                    backend?.windowsAgentOnline ? 'text-emerald-400' : 'text-cyan-400'
                  }`}
                >
                  {backend?.windowsAgentOnline ? '● Connected' : '● Sandbox Ready'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-300">Browser Agent</span>
                <span className="font-mono text-emerald-400">
                  ● {(backend?.configuredBrowser || 'chrome').toUpperCase()}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-300">Auth Token</span>
                <span className="font-mono text-slate-400">
                  {backend?.localSessionToken || 'Active'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <span className="text-[11px] text-slate-400">
                Run native Python companion on Windows 10/11:
              </span>
              <a
                href="/api/aira/download-windows-agent"
                download="aira_windows_agent.py"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Windows Agent</span>
              </a>
            </div>
          </div>

          {/* 2. Open Windows Manager (Section 17) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Active Windows ({openWindows.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {openWindows.map((win) => (
                <div
                  key={win.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.07] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Monitor
                      className={`w-4 h-4 shrink-0 ${
                        win.focused ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="truncate">
                      <span className="text-slate-200 font-medium">
                        {win.title}
                      </span>
                      <span className="ml-2 text-[10px] font-mono text-slate-400">
                        [{win.state}]
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!win.focused && (
                      <button
                        type="button"
                        onClick={() =>
                          void onExecuteQuickTool('switch_window', {
                            targetWindow: win.app,
                          })
                        }
                        className="px-2 py-1 rounded bg-white/10 hover:bg-cyan-400 hover:text-slate-950 text-[10px] font-semibold cursor-pointer"
                      >
                        Focus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void onExecuteQuickTool('minimize_window', {
                          windowTitle: win.title,
                        })
                      }
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[10px] cursor-pointer"
                    >
                      Min
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Active Browser Tabs */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Browser Agent Tabs ({browserTabs.length})
            </span>
            <div className="space-y-1.5">
              {browserTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.07] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                    <div className="truncate">
                      <span className="font-medium text-slate-200">
                        {tab.title}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">
                        {tab.url}
                      </span>
                    </div>
                  </div>
                  {tab.active && (
                    <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                      ACTIVE
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Structured Action Log Timeline (Section 23 & 38) */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Structured Action Log ({activities.length})
            </span>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.06] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {act.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : act.status === 'FAILED' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="font-mono text-[11px] text-cyan-300 font-semibold">
                        {act.timeFormatted} · {act.component}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {act.status}
                    </span>
                  </div>

                  <div className="text-slate-100 font-medium">{act.event}</div>

                  {(act.tool || act.target) && (
                    <div className="text-[11px] font-mono text-slate-400">
                      {act.tool ? `Tool: ${act.tool}` : ''}{' '}
                      {act.target ? `· Target: ${act.target}` : ''}
                    </div>
                  )}

                  {act.result && (
                    <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-white/5">
                      {act.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
