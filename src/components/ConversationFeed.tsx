import React from 'react';
import {
  ActiveTaskPlan,
  ConversationTurn,
  PendingConfirmation,
} from '../types/aira';
import { formatBytes } from '../core/AttachmentManager';
import {
  ShieldAlert,
  Check,
  X,
  Volume2,
  Folder,
  FileText,
  Globe,
  CheckCircle2,
  Loader2,
  Square,
} from 'lucide-react';

interface ConversationFeedProps {
  conversation: ConversationTurn[];
  pendingConfirmations: PendingConfirmation[];
  activePlan: ActiveTaskPlan | null;
  onResolveConfirmation: (id: string, approved: boolean) => Promise<void>;
  onStopAll: () => Promise<void>;
}

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  conversation,
  pendingConfirmations,
  activePlan,
  onResolveConfirmation,
  onStopAll,
}) => {
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.03;
      window.speechSynthesis.speak(utter);
    }
  };

  if (
    conversation.length === 0 &&
    pendingConfirmations.length === 0 &&
    !activePlan
  ) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 space-y-3">
      {/* 1. Prominent ACTION REQUEST Confirmation Cards (Section 22 & 36) */}
      {pendingConfirmations.map((conf) => (
        <div
          key={conf.id}
          className="p-4 rounded-2xl bg-amber-950/40 border border-amber-400/50 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>ACTION REQUEST — {conf.permissionLevel}</span>
            </div>
            <span className="text-[11px] font-mono text-amber-200/80">
              Tool: {conf.tool}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-black/35 p-3 rounded-xl border border-white/10">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">
                Action
              </span>
              <span className="font-semibold text-slate-100">
                {conf.actionTitle}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">
                Target
              </span>
              <span className="font-mono text-cyan-300 break-all">
                {conf.target}
              </span>
            </div>
            {conf.itemCount !== undefined && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">
                  Items Affected
                </span>
                <span className="font-mono font-semibold text-slate-100">
                  {conf.itemCount}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            {conf.details}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void onResolveConfirmation(conf.id, false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={() => void onResolveConfirmation(conf.id, true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          </div>
        </div>
      ))}

      {/* 2. Structured Multi-Step Task Plan Progress (Section 25 & 26) */}
      {activePlan && activePlan.steps.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-400 font-semibold">
              TASK PLAN: {activePlan.goal}
            </div>
            {activePlan.status === 'EXECUTING' ? (
              <button
                type="button"
                onClick={() => void onStopAll()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[11px] font-semibold cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300">
                {activePlan.status}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {activePlan.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/[0.05]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {step.status === 'EXECUTING' ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        step.status === 'SUCCESS'
                          ? 'text-emerald-400'
                          : step.status === 'AWAITING_CONFIRMATION'
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }`}
                    />
                  )}
                  <span className="text-slate-200 truncate">
                    {step.stepNumber}. {step.description}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Multimodal Conversation Feed (Voice + Command Box + Attachments) */}
      {conversation.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
          {conversation.slice(-6).map((turn) => (
            <div
              key={turn.id}
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-slate-900/65 border-white/10 text-slate-200'
                  : 'bg-[#0B1324]/90 border-cyan-500/30 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${
                    turn.role === 'user' ? 'text-slate-400' : 'text-cyan-400'
                  }`}
                >
                  {turn.role === 'user'
                    ? `You (${turn.modality})`
                    : `AIRA (${turn.status || 'RESPONSE'})`}
                </span>

                {turn.role === 'aira' && (
                  <button
                    type="button"
                    onClick={() => speakText(turn.text)}
                    title="Speak response aloud"
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak</span>
                  </button>
                )}
              </div>

              <div className="whitespace-pre-wrap">{turn.text}</div>

              {/* Render Attached Context Cards inside User Turn (Section 16 & 25) */}
              {turn.attachments && turn.attachments.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {turn.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-white/10"
                    >
                      {att.dataUrl ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-12 h-12 rounded-lg object-cover border border-white/10"
                        />
                      ) : att.kind === 'folder' ? (
                        <Folder className="w-5 h-5 text-amber-400" />
                      ) : att.kind === 'browser' ? (
                        <Globe className="w-5 h-5 text-cyan-400" />
                      ) : (
                        <FileText className="w-5 h-5 text-emerald-400" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-100">
                          {att.name}
                        </div>
                        {att.folderOverview ? (
                          <div className="text-[10px] font-mono text-slate-400">
                            Files: {att.folderOverview.totalFiles} · Folders:{' '}
                            {att.folderOverview.totalFolders} · Code:{' '}
                            {att.folderOverview.categories.Code} · Images:{' '}
                            {att.folderOverview.categories.Images} · Docs:{' '}
                            {att.folderOverview.categories.Documents}
                          </div>
                        ) : att.webpageContext ? (
                          <div className="text-[10px] font-mono text-cyan-400">
                            {att.webpageContext.url}
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-slate-400">
                            {formatBytes(att.sizeBytes)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
