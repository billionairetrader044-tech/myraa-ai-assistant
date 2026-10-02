import {
  AssistantError,
  AssistantState,
  DebugLogEntry,
  MyraaSettings,
  ToolExecutionRecord,
} from '../types/live';
import { ActionCardPayload } from '../types/tools';

const SETTINGS_STORAGE_KEY = 'myraa_gf_settings_v3';

export const DEFAULT_SETTINGS: MyraaSettings = {
  model: 'gemini-3.1-flash-live-preview',
  voiceName: 'Aoede',
  selectedMicrophoneId: 'default',
  visualizerEnabled: true,
  animationsEnabled: true,
  debugModeEnabled: false,
  bargeInSensitivity: 0.045,
  outputVolume: 0.95,
  // Persona & Emotional Settings
  assistantName: 'Myraa',
  emotionalMood: 'romantic',
  partnerNickname: 'Jaan',
  languageStyle: 'hinglish',
  affectionLevel: 92,
  responseLength: 'balanced',
  customInstructions: '',
  autoGreetOnConnect: true,
  // Color & Appearance Settings
  themePresetId: 'rose_romance',
  customPrimaryColor: '#f43f5e',
  customSecondaryColor: '#d946ef',
  customBgColor: '#09060e',
  glowIntensity: 1.0,
  orbScale: 1.0,
  particleStyle: 'hearts',
  // Audio Processing & General UI Settings
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  showQuickPrompts: true,
  showMoodBar: true,
  showSessionTimer: true,
};

export interface StateSnapshot {
  state: AssistantState;
  activeModel: string;
  sessionId: string | null;
  sessionStartedAt: number | null;
  error: AssistantError | null;
  settings: MyraaSettings;
  recentActions: ToolExecutionRecord[];
  activeActionCard: ActionCardPayload | null;
  debugLogs: DebugLogEntry[];
  apiConfiguredOnServer: boolean | null;
  // Derived flags strictly computed from centralized `state`
  readonly isDisconnected: boolean;
  readonly isConnecting: boolean;
  readonly isConnected: boolean;
  readonly isListening: boolean;
  readonly isSpeaking: boolean;
  readonly isInterrupted: boolean;
  readonly isError: boolean;
}

type StateListener = () => void;

class StateManagerImpl {
  private currentState: AssistantState = 'disconnected';
  private activeModel: string = DEFAULT_SETTINGS.model;
  private sessionId: string | null = null;
  private sessionStartedAt: number | null = null;
  private error: AssistantError | null = null;
  private settings: MyraaSettings = this.loadSettings();
  private recentActions: ToolExecutionRecord[] = [];
  private activeActionCard: ActionCardPayload | null = null;
  private debugLogs: DebugLogEntry[] = [];
  private apiConfiguredOnServer: boolean | null = null;
  private listeners: Set<StateListener> = new Set();
  private snapshot: StateSnapshot;

  constructor() {
    this.snapshot = this.buildSnapshot();
  }

  private loadSettings(): MyraaSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<MyraaSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(nextSettings: MyraaSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } catch {
      // Ignore storage quota issues
    }
  }

  private buildSnapshot(): StateSnapshot {
    const s = this.currentState;
    return {
      state: s,
      activeModel: this.activeModel,
      sessionId: this.sessionId,
      sessionStartedAt: this.sessionStartedAt,
      error: this.error,
      settings: this.settings,
      recentActions: this.recentActions,
      activeActionCard: this.activeActionCard,
      debugLogs: this.debugLogs,
      apiConfiguredOnServer: this.apiConfiguredOnServer,
      isDisconnected: s === 'disconnected',
      isConnecting: s === 'connecting',
      isConnected:
        s === 'connected' ||
        s === 'listening' ||
        s === 'thinking' ||
        s === 'executing' ||
        s === 'speaking' ||
        s === 'interrupted',
      isListening: s === 'listening' || s === 'connected',
      isSpeaking: s === 'speaking',
      isInterrupted: s === 'interrupted',
      isError: s === 'error',
    };
  }

  private notify(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSnapshot = (): StateSnapshot => {
    return this.snapshot;
  };

  public subscribe = (listener: StateListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public transitionTo(nextState: AssistantState, reason?: string): void {
    const prevState = this.currentState;
    if (prevState === nextState && nextState !== 'error') {
      return;
    }

    this.currentState = nextState;

    if (nextState === 'connecting') {
      this.error = null;
    } else if (nextState === 'connected' && !this.sessionStartedAt) {
      this.sessionStartedAt = Date.now();
    } else if (nextState === 'disconnected') {
      this.sessionStartedAt = null;
      this.sessionId = null;
    }

    this.addDebugLog(
      'state',
      `${prevState} → ${nextState}`,
      reason || `Transitioned assistant state to ${nextState}`
    );
    this.notify();
  }

  public setError(
    code: string,
    userMessage: string,
    technicalDetail?: string,
    recoverable = true
  ): void {
    this.error = {
      code,
      userMessage,
      technicalDetail,
      recoverable,
      timestamp: Date.now(),
    };
    this.currentState = 'error';
    this.sessionStartedAt = null;
    this.addDebugLog('error', code, `${userMessage} (${technicalDetail || 'no extra detail'})`);
    this.notify();
  }

  public clearError(): void {
    if (this.error) {
      this.error = null;
      if (this.currentState === 'error') {
        this.currentState = 'disconnected';
      }
      this.notify();
    }
  }

  public setSessionMetadata(model: string, sessionId: string | null): void {
    this.activeModel = model;
    this.sessionId = sessionId;
    this.notify();
  }

  public setApiConfiguredOnServer(configured: boolean): void {
    this.apiConfiguredOnServer = configured;
    this.notify();
  }

  public updateSettings(partial: Partial<MyraaSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    if (partial.model && this.currentState === 'disconnected') {
      this.activeModel = partial.model;
    }
    this.saveSettings(this.settings);
    this.addDebugLog('state', 'settings_updated', JSON.stringify(partial));
    this.notify();
  }

  public recordToolStart(id: string, toolName: string, args: Record<string, unknown>): void {
    const record: ToolExecutionRecord = {
      id,
      toolName,
      args,
      status: 'running',
      timestamp: Date.now(),
    };
    this.recentActions = [record, ...this.recentActions].slice(0, 12);
    this.addDebugLog('tool', `invoke:${toolName}`, `Args: ${JSON.stringify(args)}`);
    this.notify();
  }

  public recordToolComplete(
    id: string,
    status: 'completed' | 'failed',
    summary: string,
    actionCard?: ActionCardPayload,
    durationMs?: number
  ): void {
    this.recentActions = this.recentActions.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            summary,
            actionCard,
            durationMs,
          }
        : item
    );
    if (actionCard) {
      this.activeActionCard = actionCard;
    }
    this.addDebugLog('tool', `result:${status}`, summary);
    this.notify();
  }

  public dismissActionCard(): void {
    this.activeActionCard = null;
    this.notify();
  }

  public setActiveActionCard(card: ActionCardPayload | null): void {
    this.activeActionCard = card;
    this.notify();
  }

  public addDebugLog(
    category: DebugLogEntry['category'],
    event: string,
    detail: string,
    payload?: unknown
  ): void {
    const entry: DebugLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      category,
      event,
      detail,
      payload,
    };
    this.debugLogs = [entry, ...this.debugLogs].slice(0, 120);
    // Only trigger full React notify for debug logs if debug mode is open or called externally
    if (this.settings.debugModeEnabled) {
      this.snapshot = this.buildSnapshot();
      for (const listener of this.listeners) {
        listener();
      }
    }
  }

  public clearDebugLogs(): void {
    this.debugLogs = [];
    this.notify();
  }
}

export const stateManager = new StateManagerImpl();
