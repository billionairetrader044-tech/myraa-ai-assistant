import { AudioDeviceOption, AudioMetrics } from '../types/audio';

export function checkBrowserAudioSupport(): {
  supported: boolean;
  reason?: string;
} {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Browser window environment unavailable.' };
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return {
      supported: false,
      reason: 'Your browser does not support the Web Audio API.',
    };
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      supported: false,
      reason:
        'Microphone capture (navigator.mediaDevices.getUserMedia) is not available. Ensure you are using HTTPS or localhost.',
    };
  }
  return { supported: true };
}

export async function getMicrophoneDevices(): Promise<AudioDeviceOption[]> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, idx) => ({
        deviceId: d.deviceId || `mic-${idx}`,
        label: d.label || `Microphone ${idx + 1}`,
        kind: 'audioinput' as const,
      }));
  } catch {
    return [];
  }
}

/**
 * Downsamples or resamples Float32 audio data from `inputSampleRate` to `targetSampleRate` (16000 Hz)
 * using box-averaging anti-aliasing filter when downsampling.
 */
export function resampleAudioBuffer(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): Float32Array {
  if (inputSampleRate === targetSampleRate || input.length === 0) {
    return input;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  if (ratio > 1) {
    // Downsampling with box filter to prevent aliasing
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < outputLength) {
      const nextOffsetBuffer = Math.min(
        input.length,
        Math.round((offsetResult + 1) * ratio)
      );
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
        accum += input[i];
        count++;
      }
      output[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
  } else {
    // Upsampling with linear interpolation
    for (let i = 0; i < outputLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      const s0 = input[index] ?? 0;
      const s1 = input[Math.min(input.length - 1, index + 1)] ?? s0;
      output[i] = s0 + frac * (s1 - s0);
    }
  }

  return output;
}

/**
 * Converts normalized Float32Array [-1.0, 1.0] into 16-bit signed PCM (Int16Array).
 */
export function float32ToPcm16(float32Data: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Converts 16-bit signed PCM (Int16Array) into normalized Float32Array [-1.0, 1.0].
 */
export function pcm16ToFloat32(pcm16Data: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16Data.length);
  for (let i = 0; i < pcm16Data.length; i++) {
    const int = pcm16Data[i];
    float32[i] = int < 0 ? int / 0x8000 : int / 0x7fff;
  }
  return float32;
}

/**
 * Encodes an Int16Array buffer (little-endian) into a Base64 string.
 */
export function int16ToBase64(int16Data: Int16Array): string {
  const bytes = new Uint8Array(
    int16Data.buffer,
    int16Data.byteOffset,
    int16Data.byteLength
  );
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string of 16-bit little-endian PCM bytes into an Int16Array.
 */
export function base64ToInt16(base64: string): Int16Array {
  const binaryString = atob(base64);
  const byteLength = binaryString.length;
  // Ensure even byte length for 16-bit samples
  const alignedLength = byteLength - (byteLength % 2);
  const bytes = new Uint8Array(alignedLength);
  for (let i = 0; i < alignedLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Calculates RMS amplitude of a Float32 audio frame.
 */
export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const val = samples[i];
    sumSquares += val * val;
  }
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Extracts real-time frequency & time-domain metrics from a Web Audio AnalyserNode.
 */
export function extractAudioMetrics(
  analyser: AnalyserNode | null,
  freqData: Uint8Array,
  timeData: Uint8Array
): AudioMetrics {
  if (!analyser) {
    freqData.fill(0);
    timeData.fill(128);
    return {
      rms: 0,
      peak: 0,
      bassEnergy: 0,
      midEnergy: 0,
      trebleEnergy: 0,
      frequencyBins: freqData,
      timeDomainData: timeData,
    };
  }

  analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>);

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128;
    const abs = Math.abs(normalized);
    if (abs > peak) peak = abs;
    sumSquares += normalized * normalized;
  }
  const rms = Math.min(1, Math.sqrt(sumSquares / timeData.length));

  const binCount = freqData.length;
  const bassEnd = Math.max(1, Math.floor(binCount * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(binCount * 0.45));

  let bassSum = 0;
  for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
  const bassEnergy = bassSum / (bassEnd * 255);

  let midSum = 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += freqData[i];
  const midEnergy = midSum / ((midEnd - bassEnd) * 255);

  let trebleSum = 0;
  for (let i = midEnd; i < binCount; i++) trebleSum += freqData[i];
  const trebleEnergy = trebleSum / (Math.max(1, binCount - midEnd) * 255);

  return {
    rms,
    peak,
    bassEnergy,
    midEnergy,
    trebleEnergy,
    frequencyBins: freqData,
    timeDomainData: timeData,
  };
}
