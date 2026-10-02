import { useEffect, useRef } from 'react';
import { extractAudioMetrics } from '../audio/audioUtils';
import { liveSession } from '../live/LiveSession';
import { AudioMetrics } from '../types/audio';
import { AssistantState } from '../types/live';

export type VisualizerFrameCallback = (
  metrics: AudioMetrics,
  activeSource: 'input' | 'output' | 'idle',
  timestamp: number
) => void;

/**
 * High-performance requestAnimationFrame hook that samples real Web Audio API AnalyserNodes
 * (microphone input when listening, 24kHz PCM output when Myraa is speaking)
 * without causing React component re-renders.
 */
export function useAudioVisualizer(
  state: AssistantState,
  enabled: boolean,
  onFrame: VisualizerFrameCallback
) {
  const onFrameRef = useRef<VisualizerFrameCallback>(onFrame);
  onFrameRef.current = onFrame;

  const stateRef = useRef<AssistantState>(state);
  stateRef.current = state;

  useEffect(() => {
    const freqBuffer = new Uint8Array(256);
    const timeBuffer = new Uint8Array(256);
    timeBuffer.fill(128);

    let rafId = 0;

    const tick = (timestamp: number) => {
      const currentState = stateRef.current;

      if (!enabled) {
        freqBuffer.fill(0);
        timeBuffer.fill(128);
        onFrameRef.current(
          {
            rms: 0,
            peak: 0,
            bassEnergy: 0,
            midEnergy: 0,
            trebleEnergy: 0,
            frequencyBins: freqBuffer,
            timeDomainData: timeBuffer,
          },
          'idle',
          timestamp
        );
        rafId = requestAnimationFrame(tick);
        return;
      }

      let analyser: AnalyserNode | null = null;
      let activeSource: 'input' | 'output' | 'idle' = 'idle';

      if (currentState === 'speaking') {
        analyser = liveSession.getOutputAnalyser();
        activeSource = 'output';
      } else if (
        currentState === 'listening' ||
        currentState === 'connected' ||
        currentState === 'interrupted'
      ) {
        analyser = liveSession.getInputAnalyser();
        activeSource = 'input';
      }

      const metrics = extractAudioMetrics(analyser, freqBuffer, timeBuffer);
      onFrameRef.current(metrics, activeSource, timestamp);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled]);
}
