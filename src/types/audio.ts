export interface AudioFormatSpec {
  sampleRate: number;
  channels: number;
  encoding: 'PCM16_LE';
  mimeType: string;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface AudioMetrics {
  /** Normalized RMS amplitude [0.0, 1.0] */
  rms: number;
  /** Peak sample amplitude [0.0, 1.0] */
  peak: number;
  /** Low-frequency energy band [0.0, 1.0] */
  bassEnergy: number;
  /** Mid-frequency vocal energy band [0.0, 1.0] */
  midEnergy: number;
  /** High-frequency harmonic energy band [0.0, 1.0] */
  trebleEnergy: number;
  /** Frequency spectrum bins (0-255) */
  frequencyBins: Uint8Array;
  /** Time-domain waveform samples (0-255, 128 = zero crossing) */
  timeDomainData: Uint8Array;
}

export interface AudioStreamerConfig {
  deviceId?: string;
  targetSampleRate?: number;
  chunkSize?: number;
  bargeInSensitivity?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  onAudioChunk: (base64Pcm16: string, rms: number) => void;
  onVoiceActivityStart?: () => void;
  onError: (error: AudioPipelineError) => void;
}

export interface AudioPipelineError {
  code:
    | 'MIC_PERMISSION_DENIED'
    | 'MIC_UNAVAILABLE'
    | 'BROWSER_UNSUPPORTED'
    | 'AUDIO_CONTEXT_ERROR'
    | 'AUDIO_DECODE_ERROR'
    | 'DEVICE_ERROR';
  userMessage: string;
  technicalDetail?: string;
}
