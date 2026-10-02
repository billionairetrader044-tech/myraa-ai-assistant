import { ActionCardPayload, IncomingFunctionCall } from './tools';

export type AssistantState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type PrebuiltVoiceName = 'Kore' | 'Zephyr' | 'Aoede' | 'Puck' | 'Charon' | 'Fenrir';

export type EmotionalMood =
  | 'romantic'
  | 'playful'
  | 'caring'
  | 'missing_you'
  | 'excited';

export type LanguageStyle = 'hinglish' | 'urdu_hindi' | 'english' | 'hindi';

export type ParticleStyle = 'hearts' | 'stars' | 'orbs' | 'none';

export type ResponseLengthStyle = 'short' | 'balanced' | 'expressive';

export interface AssistantError {
  code: string;
  userMessage: string;
  technicalDetail?: string;
  recoverable: boolean;
  timestamp: number;
}

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  category: 'state' | 'audio' | 'live' | 'tool' | 'error' | 'transcript';
  event: string;
  detail: string;
  payload?: unknown;
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  summary?: string;
  actionCard?: ActionCardPayload;
  timestamp: number;
  durationMs?: number;
}

export interface MyraaSettings {
  model: string;
  voiceName: PrebuiltVoiceName;
  selectedMicrophoneId: string;
  visualizerEnabled: boolean;
  animationsEnabled: boolean;
  debugModeEnabled: boolean;
  bargeInSensitivity: number; // 0.01 to 0.15
  outputVolume: number; // 0.0 to 1.0
  // Persona & Emotional Settings
  assistantName: string;
  emotionalMood: EmotionalMood;
  partnerNickname: string;
  languageStyle: LanguageStyle;
  affectionLevel: number; // 10 to 100
  responseLength: ResponseLengthStyle;
  customInstructions: string;
  autoGreetOnConnect: boolean;
  // Color & Appearance Settings
  themePresetId: string;
  customPrimaryColor: string; // Hex e.g. #f43f5e
  customSecondaryColor: string; // Hex e.g. #d946ef
  customBgColor: string; // Hex e.g. #09060e
  glowIntensity: number; // 0.2 to 1.5
  orbScale: number; // 0.8 to 1.25
  particleStyle: ParticleStyle;
  // Audio Processing & General UI Settings
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  showQuickPrompts: boolean;
  showMoodBar: boolean;
  showSessionTimer: boolean;
}

export interface ServerToClientMessage {
  type:
    | 'setupComplete'
    | 'audio'
    | 'interrupted'
    | 'turnComplete'
    | 'toolCall'
    | 'toolCallCancellation'
    | 'inputTranscription'
    | 'outputTranscription'
    | 'debugText'
    | 'debugEvent'
    | 'error'
    | 'sessionClosed';
  model?: string;
  sessionId?: string | null;
  data?: string;
  mimeType?: string;
  functionCalls?: IncomingFunctionCall[];
  ids?: string[];
  text?: string;
  finished?: boolean;
  event?: string;
  detail?: string;
  code?: string | number;
  message?: string;
  reason?: string;
}
