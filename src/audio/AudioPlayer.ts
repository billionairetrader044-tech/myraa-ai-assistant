import { base64ToInt16, pcm16ToFloat32 } from './audioUtils';

const OUTPUT_SAMPLE_RATE = 24000;

export interface AudioPlayerCallbacks {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (message: string) => void;
}

/**
 * Low-latency streaming PCM16 (24 kHz) audio player using a single persistent AudioContext.
 * Supports gapless sequential chunk scheduling and immediate interruption (barge-in).
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime = 0;
  private isCurrentlyPlaying = false;
  private volume = 0.95;
  private callbacks: AudioPlayerCallbacks;

  constructor(callbacks: AudioPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Initializes or resumes the shared 24 kHz AudioContext.
   * Call this inside a user gesture (e.g., button tap) so browser autoplay policies unlock audio.
   */
  public async initialize(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      this.audioContext = new AudioCtx({
        sampleRate: OUTPUT_SAMPLE_RATE,
        latencyHint: 'interactive',
      });

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;

      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getOutputSampleRate(): number {
    return OUTPUT_SAMPLE_RATE;
  }

  public isPlaying(): boolean {
    return this.isCurrentlyPlaying && this.activeSources.size > 0;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.015
      );
    }
  }

  /**
   * Enqueues a base64-encoded 24 kHz 16-bit mono PCM audio chunk for immediate gapless playback.
   */
  public enqueuePcm16Chunk(base64Pcm: string): void {
    try {
      if (!this.audioContext || !this.analyserNode) {
        // Lazy-init if not yet initialized
        void this.initialize();
      }
      if (!this.audioContext || !this.analyserNode) return;

      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }

      const int16Data = base64ToInt16(base64Pcm);
      if (int16Data.length === 0) return;

      const float32Data = pcm16ToFloat32(int16Data);

      // Apply micro fade-in/out (8 samples) to prevent sub-frame boundary clicks
      const fadeSamples = Math.min(8, Math.floor(float32Data.length / 4));
      for (let i = 0; i < fadeSamples; i++) {
        const factor = i / fadeSamples;
        float32Data[i] *= factor;
        float32Data[float32Data.length - 1 - i] *= factor;
      }

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Data.length,
        OUTPUT_SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyserNode);

      const now = this.audioContext.currentTime;
      // Schedule with a tiny 15ms safety lookahead if starting from idle
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.015;
      }

      const startAt = this.nextStartTime;
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.add(source);
      if (!this.isCurrentlyPlaying) {
        this.isCurrentlyPlaying = true;
        this.callbacks.onPlaybackStart?.();
      }

      source.onended = () => {
        this.activeSources.delete(source);
        try {
          source.disconnect();
        } catch {
          // Ignore
        }
        if (this.activeSources.size === 0 && this.isCurrentlyPlaying) {
          this.isCurrentlyPlaying = false;
          this.callbacks.onPlaybackEnd?.();
        }
      };

      source.start(startAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio chunk decode error';
      this.callbacks.onError?.(msg);
    }
  }

  /**
   * Immediately halts all playing and queued audio chunks (used when user interrupts / barges in).
   */
  public interrupt(): void {
    if (this.activeSources.size === 0 && !this.isCurrentlyPlaying) {
      this.nextStartTime = 0;
      return;
    }

    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch {
        // Ignore if already stopped
      }
    }

    this.activeSources.clear();
    this.nextStartTime = this.audioContext ? this.audioContext.currentTime : 0;

    if (this.isCurrentlyPlaying) {
      this.isCurrentlyPlaying = false;
      this.callbacks.onPlaybackEnd?.();
    }
  }

  /**
   * Releases all audio resources when the application unmounts.
   */
  public dispose(): void {
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.gainNode = null;
  }
}
