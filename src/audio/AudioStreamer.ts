import { AudioPipelineError, AudioStreamerConfig } from '../types/audio';
import {
  calculateRms,
  checkBrowserAudioSupport,
  float32ToPcm16,
  int16ToBase64,
  resampleAudioBuffer,
} from './audioUtils';

const TARGET_SAMPLE_RATE = 16000;
const WORKLET_PROCESSOR_NAME = 'myraa-pcm-capture-processor';

const WORKLET_CODE = `
class MyraaPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.writeIndex++] = channelData[i];
      if (this.writeIndex >= this.bufferSize) {
        const chunk = this.buffer.slice(0, this.bufferSize);
        this.port.postMessage(chunk, [chunk.buffer]);
        this.writeIndex = 0;
      }
    }
    return true;
  }
}
registerProcessor('${WORKLET_PROCESSOR_NAME}', MyraaPcmCaptureProcessor);
`;

/**
 * Captures browser microphone input, resamples to 16 kHz mono PCM16,
 * exposes an AnalyserNode for real-time visualization, and detects voice activity for barge-in.
 */
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private isStreaming = false;
  private config: AudioStreamerConfig;

  // Voice Activity Detection (VAD) state for instant barge-in
  private consecutiveVoiceFrames = 0;
  private lastBargeInTriggeredAt = 0;

  constructor(config: AudioStreamerConfig) {
    this.config = config;
  }

  public updateConfig(partial: Partial<AudioStreamerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getInputSampleRate(): number {
    return this.audioContext?.sampleRate || TARGET_SAMPLE_RATE;
  }

  public getIsStreaming(): boolean {
    return this.isStreaming;
  }

  public async start(): Promise<boolean> {
    if (this.isStreaming) {
      return true;
    }

    const support = checkBrowserAudioSupport();
    if (!support.supported) {
      this.config.onError({
        code: 'BROWSER_UNSUPPORTED',
        userMessage:
          support.reason || 'Your browser does not support microphone streaming.',
      });
      return false;
    }

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: this.config.echoCancellation ?? true,
        noiseSuppression: this.config.noiseSuppression ?? true,
        autoGainControl: this.config.autoGainControl ?? true,
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
      };

      if (
        this.config.deviceId &&
        this.config.deviceId !== 'default' &&
        this.config.deviceId.trim() !== ''
      ) {
        audioConstraints.deviceId = { exact: this.config.deviceId };
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (firstErr) {
        // If specific deviceId failed, retry with default device before failing
        if (audioConstraints.deviceId) {
          delete audioConstraints.deviceId;
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false,
          });
        } else {
          throw firstErr;
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      const errName = errorObj?.name || '';
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'SecurityError'
      ) {
        this.config.onError({
          code: 'MIC_PERMISSION_DENIED',
          userMessage:
            "I couldn't access your microphone. Please check your browser microphone permission.",
          technicalDetail: errorObj?.message,
        });
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError'
      ) {
        this.config.onError({
          code: 'MIC_UNAVAILABLE',
          userMessage:
            'No microphone was detected on your device. Please connect a microphone and try again.',
          technicalDetail: errorObj?.message,
        });
      } else {
        this.config.onError({
          code: 'DEVICE_ERROR',
          userMessage:
            'Could not initialize your microphone. It may be in use by another application.',
          technicalDetail: errorObj?.message,
        });
      }
      return false;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      this.audioContext = new AudioCtx({
        sampleRate: TARGET_SAMPLE_RATE,
        latencyHint: 'interactive',
      });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.78;

      this.silentGainNode = this.audioContext.createGain();
      this.silentGainNode.gain.value = 0;

      this.sourceNode.connect(this.analyserNode);

      // Prefer low-latency AudioWorkletNode with fallback to ScriptProcessorNode
      let workletAttached = false;
      if (this.audioContext.audioWorklet) {
        try {
          const blob = new Blob([WORKLET_CODE], {
            type: 'application/javascript',
          });
          const workletUrl = URL.createObjectURL(blob);
          await this.audioContext.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          this.workletNode = new AudioWorkletNode(
            this.audioContext,
            WORKLET_PROCESSOR_NAME
          );
          this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
            if (!this.isStreaming) return;
            this.processFloat32Chunk(event.data);
          };

          this.analyserNode.connect(this.workletNode);
          this.workletNode.connect(this.silentGainNode);
          this.silentGainNode.connect(this.audioContext.destination);
          workletAttached = true;
        } catch {
          workletAttached = false;
        }
      }

      if (!workletAttached) {
        const bufferSize = 2048;
        this.scriptProcessorNode = this.audioContext.createScriptProcessor(
          bufferSize,
          1,
          1
        );
        this.scriptProcessorNode.onaudioprocess = (event: AudioProcessingEvent) => {
          if (!this.isStreaming) return;
          const inputData = event.inputBuffer.getChannelData(0);
          this.processFloat32Chunk(new Float32Array(inputData));
        };
        this.analyserNode.connect(this.scriptProcessorNode);
        this.scriptProcessorNode.connect(this.silentGainNode);
        this.silentGainNode.connect(this.audioContext.destination);
      }

      this.isStreaming = true;
      this.consecutiveVoiceFrames = 0;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stop();
      const pipelineErr: AudioPipelineError = {
        code: 'AUDIO_CONTEXT_ERROR',
        userMessage: 'Failed to initialize the browser audio processing pipeline.',
        technicalDetail: msg,
      };
      this.config.onError(pipelineErr);
      return false;
    }
  }

  private processFloat32Chunk(rawFloat32: Float32Array): void {
    if (!this.audioContext || !this.isStreaming) return;

    const actualSampleRate = this.audioContext.sampleRate;
    const resampled =
      actualSampleRate !== TARGET_SAMPLE_RATE
        ? resampleAudioBuffer(rawFloat32, actualSampleRate, TARGET_SAMPLE_RATE)
        : rawFloat32;

    const rms = calculateRms(resampled);
    const threshold = this.config.bargeInSensitivity ?? 0.045;

    // Detect sustained vocal energy (2 consecutive chunks ~250ms) for instant client-side barge-in
    if (rms > threshold) {
      this.consecutiveVoiceFrames++;
      const now = Date.now();
      if (
        this.consecutiveVoiceFrames >= 2 &&
        now - this.lastBargeInTriggeredAt > 600
      ) {
        this.lastBargeInTriggeredAt = now;
        this.config.onVoiceActivityStart?.();
      }
    } else {
      this.consecutiveVoiceFrames = 0;
    }

    const pcm16 = float32ToPcm16(resampled);
    const base64Pcm = int16ToBase64(pcm16);

    this.config.onAudioChunk(base64Pcm, rms);
  }

  public stop(): void {
    this.isStreaming = false;
    this.consecutiveVoiceFrames = 0;

    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.workletNode = null;
    }

    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.onaudioprocess = null;
        this.scriptProcessorNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.scriptProcessorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore
      }
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // Ignore
      }
      this.analyserNode = null;
    }

    if (this.silentGainNode) {
      try {
        this.silentGainNode.disconnect();
      } catch {
        // Ignore
      }
      this.silentGainNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      }
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
