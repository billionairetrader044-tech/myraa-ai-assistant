import React, { useState } from 'react';
import {
  AssistantError,
  AssistantState,
  DebugLogEntry,
  ToolExecutionRecord,
} from '../types/live';
import { Trash2, X, Play, CheckCircle2 } from 'lucide-react';

interface DebugPanelProps {
  isOpen: boolean;
  state: AssistantState;
  activeModel: string;
  sessionId: string | null;
  error: AssistantError | null;
  logs: DebugLogEntry[];
  recentActions: ToolExecutionRecord[];
  onClearLogs: () => void;
  onClose: () => void;
}

interface TestCaseResult {
  name: string;
  passed: boolean;
  detail: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  state,
  activeModel,
  sessionId,
  error,
  logs,
  recentActions,
  onClearLogs,
  onClose,
}) => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [runningTests, setRunningTests] = useState(false);

  if (!isOpen) return null;

  const isConnected =
    state === 'connected' ||
    state === 'listening' ||
    state === 'speaking' ||
    state === 'interrupted' ||
    state === 'thinking' ||
    state === 'executing';

  const runNonDestructiveTestSuite = async () => {
    setRunningTests(true);
    const results: TestCaseResult[] = [];

    try {
      const sysRes = await fetch('/api/aira/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_system_info', args: {} }),
      }).then((r) => r.json());
      results.push({
        name: '1. Tool Validation & System Telemetry',
        passed: Boolean(sysRes.ok && sysRes.outcome?.status === 'SUCCESS'),
        detail: sysRes.outcome?.summary?.slice(0, 90) || 'Verified',
      });

      const fileRes = await fetch('/api/aira/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'search_files',
          args: { directory: 'Downloads', query: 'pdf' },
        }),
      }).then((r) => r.json());
      results.push({
        name: '2. Safe File Search Operations',
        passed: Boolean(fileRes.ok && fileRes.outcome?.status === 'SUCCESS'),
        detail: fileRes.outcome?.summary?.slice(0, 90) || 'Verified',
      });

      const webRes = await fetch('/api/aira/browser/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.wikipedia.org' }),
      }).then((r) => r.json());
      results.push({
        name: '3. Browser Webpage Observation Layer',
        passed: Boolean(webRes.ok && webRes.inspection?.url),
        detail: `Inspected ${webRes.inspection?.title || 'Wikipedia'}`,
      });

      const permRes = await fetch('/api/aira/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'organize_desktop',
          args: { mode: 'confirm' },
        }),
      }).then((r) => r.json());
      const confCreated = permRes.outcome?.status === 'AWAITING_CONFIRMATION';
      results.push({
        name: '4. Permission & Confirmation Gate (CONFIRM Tier)',
        passed: confCreated,
        detail: confCreated
          ? 'Correctly intercepted bulk file movement for user approval'
          : 'Unexpected status',
      });

      const stopRes = await fetch('/api/aira/stop', {
        method: 'POST',
      }).then((r) => r.json());
      results.push({
        name: '5. Stop / Cancellation System',
        passed: Boolean(stopRes.ok && stopRes.stopped),
        detail: stopRes.message || 'Halted active operations',
      });

      const errRes = await fetch('/api/aira/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'switch_window',
          args: { targetWindow: 'NonExistentApp_999' },
        }),
      }).then((r) => r.json());
      results.push({
        name: '6. Controlled Error Recovery (No Infinite Retry)',
        passed: Boolean(
          errRes.outcome?.status === 'FAILED' &&
            errRes.outcome?.summary?.includes('launch')
        ),
        detail: errRes.outcome?.summary || 'Handled gracefully',
      });
    } finally {
      setTestResults(results);
      setRunningTests(false);
    }
  };

  return (
    <section
      aria-label="Developer Diagnostics & Test Suite"
      className="w-full max-w-3xl mx-auto mt-2 rounded-2xl bg-slate-950/95 border border-white/15 p-4 text-xs font-mono text-slate-300 shadow-2xl space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-semibold uppercase tracking-wider text-[10px]">
            Myraa Diagnostics
          </span>
          <span className="text-slate-400">
            Connection:{' '}
            <strong className={isConnected ? 'text-emerald-400' : 'text-slate-300'}>
              {isConnected ? 'CONNECTED' : 'STANDBY'}
            </strong>
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400">
            State: <strong className="text-slate-100 uppercase">{state}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={runningTests}
            onClick={() => void runNonDestructiveTestSuite()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
          >
            <Play className="w-3 h-3" />
            <span>{runningTests ? 'Running...' : 'Run Tests'}</span>
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio Pipeline & Session Specs (Section 24) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-white/[0.06] text-[11px]">
        <div>
          <span className="text-slate-500 block">Mic Status</span>
          <span className="text-slate-200">
            {isConnected ? 'Active Streaming' : 'Idle'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Audio Input</span>
          <span className="text-cyan-300">PCM16 · 16 kHz · Mono</span>
        </div>
        <div>
          <span className="text-slate-500 block">Audio Output</span>
          <span className="text-indigo-300">PCM16 · 24 kHz · Mono</span>
        </div>
        <div>
          <span className="text-slate-500 block">Model / Calls</span>
          <span className="text-slate-200 truncate block">
            {activeModel} ({recentActions.length})
          </span>
        </div>
      </div>

      {/* Test Suite Results */}
      {testResults.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
            Automated Verification Suite ({testResults.filter((t) => t.passed).length}/{testResults.length} Passed)
          </div>
          {testResults.map((t) => (
            <div key={t.name} className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-200">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    t.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                />
                {t.name}
              </span>
              <span className="text-slate-400 truncate max-w-[260px]">
                {t.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Session & Error Metadata */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <div>
          Session ID: <span className="text-slate-200">{sessionId || 'none'}</span>
        </div>
        <div>
          Tool Executions: <span className="text-slate-200">{recentActions.length}</span>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-200 text-[11px]">
          <strong>[{error.code}]</strong> {error.userMessage}
        </div>
      )}

      {/* Event Stream */}
      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
        {logs.map((log) => {
          const timeStr = new Date(log.timestamp).toISOString().slice(11, 23);
          return (
            <div
              key={log.id}
              className="flex items-start gap-2 text-[11px] leading-relaxed border-b border-white/[0.04] pb-1"
            >
              <span className="text-slate-500 shrink-0">{timeStr}</span>
              <span className="uppercase font-semibold shrink-0 w-16 text-cyan-400">
                [{log.category}]
              </span>
              <span className="text-slate-200 font-medium shrink-0">
                {log.event}
              </span>
              <span className="text-slate-400 break-all">{log.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
