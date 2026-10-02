import { AudioPlayer } from '../audio/AudioPlayer';
import { AudioStreamer } from '../audio/AudioStreamer';
import { stateManager } from '../state/StateManager';
import { toolManager } from '../tools/ToolManager';
import { ServerToClientMessage } from '../types/live';
import { IncomingFunctionCall, OutgoingFunctionResponse } from '../types/tools';
import { buildMyraaSystemInstruction, EMOTIONAL_MOODS } from './liveConfig';

/**
 * Manages the persistent full-duplex Gemini Live session via the server WebSocket bridge,
 * coordinating microphone capture (16 kHz PCM16), audio output playback (24 kHz PCM16),
 * instant barge-in interruptions, and modular tool execution.
 */
export class LiveSession {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private audioPlayer: AudioPlayer;
  private isIntentionalDisconnect = false;
  private isSetupComplete = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 2;
  private reconnectTimer: number | null = null;
  private onTranscriptCallback: ((role: 'user' | 'aira', text: string) => void) | null = null;

  public setOnTranscriptCallback(cb: (role: 'user' | 'aira', text: string) => void): void {
    this.onTranscriptCallback = cb;
  }

  public isSessionActive(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete);
  }

  public sendSilentContextUpdate(contextText: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: 'clientContent',
        text: contextText,
        turnComplete: false,
      })
    );
  }

  constructor() {
    this.audioPlayer = new AudioPlayer({
      onPlaybackStart: () => {
        const snap = stateManager.getSnapshot();
        if (snap.isConnected && snap.state !== 'speaking') {
          stateManager.transitionTo('speaking', 'Audio output playback started');
        }
      },
      onPlaybackEnd: () => {
        const snap = stateManager.getSnapshot();
        if (snap.state === 'speaking' || snap.state === 'interrupted') {
          stateManager.transitionTo('listening', 'Audio output finished; listening for user');
        }
      },
      onError: (msg) => {
        stateManager.addDebugLog('audio', 'player_error', msg);
      },
    });

    this.audioStreamer = new AudioStreamer({
      deviceId: stateManager.getSnapshot().settings.selectedMicrophoneId,
      bargeInSensitivity: stateManager.getSnapshot().settings.bargeInSensitivity,
      onAudioChunk: (base64Pcm16) => {
        this.sendAudioChunk(base64Pcm16);
      },
      onVoiceActivityStart: () => {
        // Client-side instant acoustic barge-in if Myraa is currently speaking
        if (this.audioPlayer.isPlaying()) {
          stateManager.addDebugLog(
            'audio',
            'client_barge_in',
            'Detected user speech while Myraa was speaking — halting output immediately'
          );
          this.handleInterruption('User spoke over assistant output (client VAD)');
        }
      },
      onError: (err) => {
        this.disconnect(false);
        stateManager.setError(err.code, err.userMessage, err.technicalDetail, true);
      },
    });
  }

  public getInputAnalyser(): AnalyserNode | null {
    return this.audioStreamer.getAnalyser();
  }

  public getOutputAnalyser(): AnalyserNode | null {
    return this.audioPlayer.getAnalyser();
  }

  private lastSyncedMood = stateManager.getSnapshot().settings.emotionalMood;
  private lastSyncedNickname = stateManager.getSnapshot().settings.partnerNickname;
  private lastSyncedLang = stateManager.getSnapshot().settings.languageStyle;

  public syncSettings(): void {
    const { settings } = stateManager.getSnapshot();
    this.audioPlayer.setVolume(settings.outputVolume);
    this.audioStreamer.updateConfig({
      deviceId: settings.selectedMicrophoneId,
      bargeInSensitivity: settings.bargeInSensitivity,
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
    });

    if (
      this.isSessionActive() &&
      (settings.emotionalMood !== this.lastSyncedMood ||
        settings.partnerNickname !== this.lastSyncedNickname ||
        settings.languageStyle !== this.lastSyncedLang)
    ) {
      const moodObj =
        EMOTIONAL_MOODS.find((m) => m.id === settings.emotionalMood) ||
        EMOTIONAL_MOODS[0];
      this.sendSilentContextUpdate(
        `[LIVE EMOTIONAL MOOD SHIFT]: Immediately shift your girlfriend emotional state to "${moodObj.label}" (${moodObj.hinglishTag}). ${moodObj.promptDirective} Call your partner "${settings.partnerNickname || 'Jaan'}" and speak in ${settings.languageStyle.toUpperCase()} style.`
      );
    }

    this.lastSyncedMood = settings.emotionalMood;
    this.lastSyncedNickname = settings.partnerNickname;
    this.lastSyncedLang = settings.languageStyle;
  }

  /**
   * Connects to Gemini Live, initializes 24kHz AudioPlayer and 16kHz AudioStreamer,
   * and starts continuous bidirectional voice streaming.
   */
  public async connect(): Promise<void> {
    const snap = stateManager.getSnapshot();
    if (snap.isConnecting || snap.isConnected) {
      return;
    }

    this.isIntentionalDisconnect = false;
    this.isSetupComplete = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    stateManager.transitionTo('connecting', 'Initializing audio & Gemini Live session');

    try {
      // 1. Unlock 24 kHz output AudioContext inside user tap gesture
      await this.audioPlayer.initialize();
      this.audioPlayer.setVolume(snap.settings.outputVolume);

      // 2. Request microphone permission and initialize 16 kHz capture before opening live stream
      this.audioStreamer.updateConfig({
        deviceId: snap.settings.selectedMicrophoneId,
        bargeInSensitivity: snap.settings.bargeInSensitivity,
        echoCancellation: snap.settings.echoCancellation,
        noiseSuppression: snap.settings.noiseSuppression,
        autoGainControl: snap.settings.autoGainControl,
      });

      const micStarted = await this.audioStreamer.start();
      if (!micStarted) {
        // Error state already set by AudioStreamer.onError
        return;
      }

      // 3. Open WebSocket bridge to server (/ws/live)
      this.openWebSocket();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.cleanupResources();
      stateManager.setError(
        'SESSION_INIT_ERROR',
        'Could not start the voice session. Please check your audio devices and try again.',
        msg,
        true
      );
    }
  }

  private openWebSocket(): void {
    const { settings } = stateManager.getSnapshot();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        stateManager.addDebugLog('live', 'ws_open', `Connected to ${wsUrl}`);
        this.lastSyncedMood = settings.emotionalMood;
        this.lastSyncedNickname = settings.partnerNickname;
        this.lastSyncedLang = settings.languageStyle;
        // Send setup configuration with model, voice, emotional girlfriend system instruction, and registered tools
        const setupPayload = {
          type: 'setup',
          model: settings.model,
          voiceName: settings.voiceName,
          systemInstruction: buildMyraaSystemInstruction(settings),
          tools: toolManager.getFunctionDeclarations(),
        };
        ws.send(JSON.stringify(setupPayload));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerToClientMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          stateManager.addDebugLog(
            'error',
            'ws_parse_error',
            err instanceof Error ? err.message : 'Invalid JSON from server'
          );
        }
      };

      ws.onerror = () => {
        stateManager.addDebugLog('error', 'ws_error', 'WebSocket transport error');
      };

      ws.onclose = (closeEvent: CloseEvent) => {
        stateManager.addDebugLog(
          'live',
          'ws_close',
          `Code: ${closeEvent.code}, Reason: ${closeEvent.reason || 'none'}`
        );

        if (this.isIntentionalDisconnect) {
          return;
        }

        // If we were connected and dropped unexpectedly, attempt transparent reconnect
        if (
          this.isSetupComplete &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          stateManager.transitionTo(
            'connecting',
            `Reconnecting session (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          this.reconnectTimer = window.setTimeout(() => {
            if (!this.isIntentionalDisconnect) {
              this.openWebSocket();
            }
          }, 900);
          return;
        }

        const currentSnap = stateManager.getSnapshot();
        if (currentSnap.state !== 'error') {
          this.cleanupResources();
          stateManager.transitionTo('disconnected', 'Live session closed');
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.cleanupResources();
      stateManager.setError(
        'WEBSOCKET_ERROR',
        'Unable to connect to the Myraa real-time audio server.',
        msg,
        true
      );
    }
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case 'setupComplete': {
        this.isSetupComplete = true;
        this.reconnectAttempts = 0;
        if (msg.model) {
          stateManager.setSessionMetadata(msg.model, msg.sessionId || null);
        }
        stateManager.transitionTo('connected', `Session ready (${msg.model || 'Gemini Live'})`);
        stateManager.transitionTo('listening', 'Microphone active — listening for speech');

        const { settings } = stateManager.getSnapshot();
        if (settings.autoGreetOnConnect) {
          const nick = settings.partnerNickname?.trim() || 'Jaan';
          this.sendTextPrompt(
            `[CALL CONNECTED]: Greet ${nick} warmly and affectionately in 1-2 short sentences according to your current mood!`
          );
        }
        break;
      }

      case 'audio': {
        if (msg.data) {
          this.audioPlayer.enqueuePcm16Chunk(msg.data);
        }
        break;
      }

      case 'interrupted': {
        this.handleInterruption('Gemini Live server detected user barge-in');
        break;
      }

      case 'turnComplete': {
        stateManager.addDebugLog('live', 'turn_complete', 'Model turn generation completed');
        if (!this.audioPlayer.isPlaying()) {
          const snap = stateManager.getSnapshot();
          if (snap.isConnected && snap.state !== 'listening') {
            stateManager.transitionTo('listening', 'Turn complete');
          }
        }
        break;
      }

      case 'toolCall': {
        if (msg.functionCalls && msg.functionCalls.length > 0) {
          void this.handleToolCalls(msg.functionCalls);
        }
        break;
      }

      case 'toolCallCancellation': {
        stateManager.addDebugLog(
          'tool',
          'tool_cancelled',
          `Cancelled tool call IDs: ${(msg.ids || []).join(', ')}`
        );
        break;
      }

      case 'inputTranscription': {
        if (msg.text) {
          stateManager.addDebugLog('transcript', 'user_voice', msg.text);
          this.onTranscriptCallback?.('user', msg.text);
        }
        break;
      }

      case 'outputTranscription': {
        if (msg.text) {
          stateManager.addDebugLog('transcript', 'myraa_voice', msg.text);
          this.onTranscriptCallback?.('aira', msg.text);
        }
        break;
      }

      case 'debugText': {
        if (msg.text) {
          stateManager.addDebugLog('live', 'model_internal_text', msg.text);
        }
        break;
      }

      case 'debugEvent': {
        stateManager.addDebugLog(
          'live',
          msg.event || 'server_event',
          msg.detail || ''
        );
        break;
      }

      case 'error': {
        const code = String(msg.code || 'LIVE_API_ERROR');
        const rawMessage = msg.message || 'An error occurred in the Gemini Live session.';
        let friendlyMessage = rawMessage;

        if (
          code === 'API_KEY_MISSING' ||
          rawMessage.toLowerCase().includes('api key') ||
          rawMessage.includes('403') ||
          rawMessage.includes('401')
        ) {
          friendlyMessage =
            'Gemini API key is missing or invalid. Please verify GEMINI_API_KEY in Settings > Secrets or your .env file.';
        }

        this.cleanupResources();
        stateManager.setError(code, friendlyMessage, rawMessage, true);
        break;
      }

      case 'sessionClosed': {
        if (!this.isIntentionalDisconnect) {
          this.cleanupResources();
          stateManager.transitionTo(
            'disconnected',
            msg.reason || 'Gemini Live session ended'
          );
        }
        break;
      }
    }
  }

  /**
   * Stops current audio response playback immediately, clears queued chunks,
   * and keeps microphone streaming active so user's interruption is processed seamlessly.
   */
  public handleInterruption(reason = 'Interrupted by user'): void {
    const wasPlaying = this.audioPlayer.isPlaying();
    this.audioPlayer.interrupt();

    if (wasPlaying) {
      stateManager.transitionTo('interrupted', reason);
      window.setTimeout(() => {
        const snap = stateManager.getSnapshot();
        if (snap.state === 'interrupted') {
          stateManager.transitionTo('listening', 'Resumed listening after barge-in');
        }
      }, 180);
    }
  }

  private async handleToolCalls(calls: IncomingFunctionCall[]): Promise<void> {
    const outgoingResponses: OutgoingFunctionResponse[] = [];

    for (const call of calls) {
      const callId = call.id || `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const startTime = performance.now();

      stateManager.recordToolStart(callId, call.name, call.args || {});

      const { result, functionResponse } = await toolManager.executeFunctionCall({
        ...call,
        id: call.id,
      });

      const durationMs = Math.round(performance.now() - startTime);
      stateManager.recordToolComplete(
        callId,
        result.success ? 'completed' : 'failed',
        result.summary,
        result.actionCard,
        durationMs
      );

      outgoingResponses.push(functionResponse);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && outgoingResponses.length > 0) {
      this.ws.send(
        JSON.stringify({
          type: 'toolResponse',
          functionResponses: outgoingResponses,
        })
      );
    }
  }

  private sendAudioChunk(base64Pcm16: string): void {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete
    ) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: 'audio',
        data: base64Pcm16,
      })
    );
  }

  /**
   * Allows triggering a quick spoken prompt or tool test over the active session.
   */
  public sendTextPrompt(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      return;
    }
    this.handleInterruption('User triggered quick prompt');
    this.ws.send(
      JSON.stringify({
        type: 'clientContent',
        text,
        turnComplete: true,
      })
    );
  }

  public disconnect(updateState = true): void {
    this.isIntentionalDisconnect = true;
    this.isSetupComplete = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupResources();
    if (updateState) {
      stateManager.transitionTo('disconnected', 'User disconnected session');
    }
  }

  private cleanupResources(): void {
    this.audioStreamer.stop();
    this.audioPlayer.interrupt();

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close(1000, 'Client disconnecting');
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

export const liveSession = new LiveSession();
