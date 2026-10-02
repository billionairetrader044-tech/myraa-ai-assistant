import {
  AiraBackendSnapshot,
  AttachmentPayload,
  ConversationTurn,
  PermissionLevel,
} from '../types/aira';
import { liveSession } from '../live/LiveSession';
import { stateManager } from '../state/StateManager';

type ContextListener = () => void;

export interface AiraContextState {
  attachments: AttachmentPayload[];
  conversation: ConversationTurn[];
  isProcessingCommand: boolean;
  backend: AiraBackendSnapshot | null;
}

class ContextManagerImpl {
  private attachments: AttachmentPayload[] = [];
  private conversation: ConversationTurn[] = [];
  private isProcessingCommand = false;
  private backend: AiraBackendSnapshot | null = null;
  private listeners: Set<ContextListener> = new Set();
  private snapshot: AiraContextState;

  constructor() {
    this.snapshot = this.buildSnapshot();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        liveSession.setOnTranscriptCallback((role, text) => {
          this.recordVoiceTranscriptTurn(role, text);
        });
      }, 0);
      window.addEventListener('aira:refresh-state', () => {
        void this.refreshBackendState();
      });
    }
  }

  private buildSnapshot(): AiraContextState {
    return {
      attachments: this.attachments,
      conversation: this.conversation,
      isProcessingCommand: this.isProcessingCommand,
      backend: this.backend,
    };
  }

  private notify(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): AiraContextState => {
    return this.snapshot;
  };

  public subscribe = (listener: ContextListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public async refreshBackendState(): Promise<void> {
    try {
      const res = await fetch('/api/aira/state');
      const data = (await res.json()) as AiraBackendSnapshot & {
        ok?: boolean;
        apiConfigured?: boolean;
      };
      if (data && data.ok) {
        this.backend = data;
        if (typeof data.apiConfigured === 'boolean') {
          stateManager.setApiConfiguredOnServer(data.apiConfigured);
        }
        this.notify();
      }
    } catch {
      // Ignore transient network errors
    }
  }

  /**
   * Adds an attachment from + Menu or Drag-and-Drop, syncs it with backend ContextManager,
   * and pushes a context notification to the active Gemini Live voice session if connected!
   */
  public async addAttachment(attachment: AttachmentPayload): Promise<void> {
    this.attachments = [...this.attachments, attachment];
    this.notify();
    await this.syncAttachmentsWithServerAndVoice();
  }

  public async removeAttachment(id: string): Promise<void> {
    this.attachments = this.attachments.filter((a) => a.id !== id);
    this.notify();
    await this.syncAttachmentsWithServerAndVoice();
  }

  public async clearAttachments(): Promise<void> {
    this.attachments = [];
    this.notify();
    await this.syncAttachmentsWithServerAndVoice();
  }

  private async syncAttachmentsWithServerAndVoice(): Promise<void> {
    try {
      const res = await fetch('/api/aira/context/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: this.attachments }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        snapshot?: AiraBackendSnapshot;
      };
      if (data?.snapshot) {
        this.backend = data.snapshot;
        this.notify();
      }
    } catch {
      // Ignore sync error
    }

    // Also inform active Gemini Live voice session about current attachments so voice commands ("Explain this", "What's in this folder?") work immediately!
    if (this.attachments.length > 0 && stateManager.getSnapshot().isConnected) {
      const contextSummary = this.attachments
        .map((att) => {
          if (att.folderOverview) {
            const fo = att.folderOverview;
            return `[Attached Folder: ${fo.folderName} (${fo.totalFiles} files, ${fo.totalFolders} folders. Breakdown: ${JSON.stringify(
              fo.categories
            )}. Files: ${fo.files
              .slice(0, 15)
              .map((f) => f.name)
              .join(', ')})]`;
          }
          if (att.webpageContext) {
            return `[Attached Browser Page: ${att.webpageContext.title} (${att.webpageContext.url}) — Headings: ${att.webpageContext.headings.join(
              ', '
            )} | Text: ${att.webpageContext.visibleTextSnippet.slice(0, 300)}]`;
          }
          if (att.textContent) {
            return `[Attached ${att.kind}: ${att.name} — Content: ${att.textContent.slice(0, 800)}]`;
          }
          return `[Attached ${att.kind}: ${att.name}]`;
        })
        .join('\n');

      liveSession.sendSilentContextUpdate(
        `[SYSTEM CONTEXT UPDATE — User just attached to AIRA]:\n${contextSummary}\nWhen the user says "this", "this file", "this folder", "this image", or "this page", refer directly to this attached context.`
      );
    }
  }

  /**
   * Sends a typed or voice-triggered command through the unified AIRA Multimodal Agent Orchestrator.
   */
  public async sendCommand(
    commandText: string,
    modality: 'text' | 'voice' | 'multimodal' = 'text',
    speakResponseAloud = false
  ): Promise<void> {
    const trimmed = commandText.trim();
    if (!trimmed && this.attachments.length === 0) return;

    const currentAttachmentsCopy = [...this.attachments];
    const userTurn: ConversationTurn = {
      id: `turn-u-${Date.now()}`,
      role: 'user',
      modality: currentAttachmentsCopy.length > 0 ? 'multimodal' : modality,
      text: trimmed || `Analyze attached: ${currentAttachmentsCopy.map((a) => a.name).join(', ')}`,
      attachments: currentAttachmentsCopy.length > 0 ? currentAttachmentsCopy : undefined,
      timestamp: Date.now(),
    };

    this.conversation = [...this.conversation, userTurn];
    this.isProcessingCommand = true;

    const prevAssistantState = stateManager.getSnapshot().state;
    if (prevAssistantState === 'disconnected' || prevAssistantState === 'listening') {
      stateManager.transitionTo('thinking', 'AIRA analyzing multimodal command & context');
    }
    this.notify();

    try {
      const res = await fetch('/api/aira/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmed,
          attachments: currentAttachmentsCopy,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        reply?: string;
        status?: ConversationTurn['status'];
        plan?: ConversationTurn['plan'];
        toolResults?: Array<{
          urlToOpen?: string;
          tool: string;
          summary: string;
        }>;
        snapshot?: AiraBackendSnapshot;
        error?: string;
      };

      if (data.snapshot) {
        this.backend = data.snapshot;
      }

      // If any tool returned a safe URL to launch (e.g., Open YouTube, Search Google, Open WhatsApp Web), launch via anchor
      if (data.toolResults) {
        for (const tr of data.toolResults) {
          if (tr.urlToOpen) {
            try {
              const a = document.createElement('a');
              a.href = tr.urlToOpen;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.className = 'hidden';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } catch {
              // Ignore popup block
            }
          }
        }
      }

      const replyText = data.reply || data.error || 'Completed command.';
      const airaTurn: ConversationTurn = {
        id: `turn-a-${Date.now()}`,
        role: 'aira',
        modality,
        text: replyText,
        plan: data.plan,
        status: data.status || 'SUCCESS',
        timestamp: Date.now(),
      };

      this.conversation = [...this.conversation, airaTurn];

      // If Live Voice session is connected or speakResponseAloud is requested, let voice or browser speech output respond
      if (stateManager.getSnapshot().isConnected && modality === 'text') {
        liveSession.sendSilentContextUpdate(
          `[USER TYPED COMMAND]: "${trimmed}"\n[AIRA EXECUTED RESULT]: "${replyText}"`
        );
      } else if (speakResponseAloud && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(replyText.slice(0, 320));
        utter.rate = 1.04;
        window.speechSynthesis.speak(utter);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Command execution failed';
      this.conversation = [
        ...this.conversation,
        {
          id: `turn-err-${Date.now()}`,
          role: 'aira',
          modality,
          text: `Error processing command: ${errMsg}`,
          status: 'FAILED',
          timestamp: Date.now(),
        },
      ];
    } finally {
      this.isProcessingCommand = false;
      const curState = stateManager.getSnapshot().state;
      if (curState === 'thinking' || curState === 'executing') {
        stateManager.transitionTo(
          liveSession.isSessionActive() ? 'listening' : 'disconnected',
          'Finished command execution'
        );
      }
      this.notify();
    }
  }

  public recordVoiceTranscriptTurn(role: 'user' | 'aira', text: string): void {
    const cleaned = text.trim();
    if (!cleaned) return;
    const last = this.conversation[this.conversation.length - 1];
    if (last && last.role === role && last.modality === 'voice' && Date.now() - last.timestamp < 4500) {
      last.text = `${last.text} ${cleaned}`.trim();
      this.notify();
      return;
    }
    this.conversation = [
      ...this.conversation,
      {
        id: `turn-v-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        role,
        modality: 'voice',
        text: cleaned,
        attachments:
          role === 'user' && this.attachments.length > 0
            ? [...this.attachments]
            : undefined,
        timestamp: Date.now(),
      },
    ];
    this.notify();
  }

  public async resolveConfirmation(confirmationId: string, approved: boolean): Promise<void> {
    stateManager.transitionTo('executing', approved ? 'Executing approved action' : 'Cancelling action');
    try {
      const res = await fetch('/api/aira/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationId, approved }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        outcome?: { summary: string; status: ConversationTurn['status']; urlToOpen?: string };
        snapshot?: AiraBackendSnapshot;
      };
      if (data.snapshot) {
        this.backend = data.snapshot;
      }
      if (data.outcome?.urlToOpen) {
        try {
          const a = document.createElement('a');
          a.href = data.outcome.urlToOpen;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'hidden';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {
          // Ignore
        }
      }
      if (data.outcome) {
        this.conversation = [
          ...this.conversation,
          {
            id: `turn-conf-${Date.now()}`,
            role: 'aira',
            modality: 'text',
            text: data.outcome.summary,
            status: data.outcome.status,
            timestamp: Date.now(),
          },
        ];
      }
    } finally {
      stateManager.transitionTo(
        liveSession.isSessionActive() ? 'listening' : 'disconnected',
        'Confirmation resolved'
      );
      this.notify();
    }
  }

  public async triggerGlobalStop(): Promise<void> {
    // 1. Stop voice output immediately if speaking
    liveSession.handleInterruption('User pressed global STOP');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 2. Stop backend active tasks and pending confirmations
    try {
      const res = await fetch('/api/aira/stop', { method: 'POST' });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        snapshot?: AiraBackendSnapshot;
      };
      if (data.snapshot) {
        this.backend = data.snapshot;
      }
      this.conversation = [
        ...this.conversation,
        {
          id: `turn-stop-${Date.now()}`,
          role: 'aira',
          modality: 'text',
          text: data.message || 'Stopped active tasks and audio playback.',
          status: 'CANCELLED',
          timestamp: Date.now(),
        },
      ];
    } catch {
      // Ignore
    }
    this.isProcessingCommand = false;
    this.notify();
  }

  public async updateSecurityAndAgentSettings(payload: {
    permissionOverrides?: Record<string, PermissionLevel>;
    allowedDirectories?: string[];
    autoOrganizeConfirmed?: boolean;
    trustedWhatsappAutoSend?: boolean;
    startWithWindows?: boolean;
    configuredBrowser?: 'chrome' | 'edge' | 'firefox';
  }): Promise<void> {
    const res = await fetch('/api/aira/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; snapshot?: AiraBackendSnapshot };
    if (data.snapshot) {
      this.backend = data.snapshot;
      this.notify();
    }
  }
}

export const contextManager = new ContextManagerImpl();
