import React, { useCallback, useRef } from 'react';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import { hexToRgbString } from '../live/liveConfig';
import { AudioMetrics } from '../types/audio';
import { AssistantState } from '../types/live';

interface VoiceVisualizerProps {
  state: AssistantState;
  enabled: boolean;
  animationsEnabled: boolean;
  customPrimaryColor?: string;
  customSecondaryColor?: string;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  state,
  enabled,
  animationsEnabled,
  customPrimaryColor = '#f43f5e',
  customSecondaryColor = '#d946ef',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(40));

  const drawWaveform = useCallback(
    (
      metrics: AudioMetrics,
      activeSource: 'input' | 'output' | 'idle',
      timestamp: number
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 480;
      const height = canvas.clientHeight || 76;

      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const barCount = 40;
      const smoothedBars = smoothedBarsRef.current;

      const prefersReducedMotion =
        !animationsEnabled ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      // Baseline subtle horizon axis
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, centerY);
      ctx.lineTo(width - 16, centerY);
      ctx.stroke();

      if (!enabled) {
        ctx.restore();
        return;
      }

      const freqBins = metrics.frequencyBins;
      const timeData = metrics.timeDomainData;

      // Determine active color scheme
      const isSpeaking = state === 'speaking' || activeSource === 'output';
      const isListening =
        state === 'listening' ||
        state === 'connected' ||
        state === 'interrupted';

      // Draw symmetric mirrored frequency bars
      const totalBarAreaWidth = Math.min(width - 32, 420);
      const startX = (width - totalBarAreaWidth) / 2;
      const stepX = totalBarAreaWidth / barCount;
      const barWidth = Math.max(2.5, stepX * 0.46);

      for (let i = 0; i < barCount; i++) {
        // Mirror index from center outward so vocal fundamentals sit in the center
        const distFromCenter = Math.abs(i - (barCount - 1) / 2);
        const normalizedDist = distFromCenter / (barCount / 2);
        const binIndex = Math.min(
          freqBins.length - 1,
          Math.floor(normalizedDist * 42) + 1
        );

        let targetHeight = 2;
        if (isSpeaking || isListening) {
          const rawVal = (freqBins[binIndex] || 0) / 255;
          const envelope = 1 - normalizedDist * 0.55;
          targetHeight = Math.max(
            2,
            rawVal * (height * 0.82) * envelope +
              ( prefersReducedMotion
                ? 0
                : Math.sin(timestamp * 0.006 + i * 0.35) * 1.8 )
          );
        } else if (state === 'connecting' && !prefersReducedMotion) {
          targetHeight =
            3 +
            Math.max(0, Math.sin(timestamp * 0.008 + i * 0.3)) * (height * 0.25);
        }

        smoothedBars[i] += (targetHeight - smoothedBars[i]) * 0.28;
        const barH = Math.max(2, smoothedBars[i]);

        const x = startX + i * stepX + (stepX - barWidth) / 2;
        const y = centerY - barH / 2;

        const primaryRgb = hexToRgbString(customPrimaryColor, '244, 63, 94');
        const secondaryRgb = hexToRgbString(customSecondaryColor, '217, 70, 239');

        if (isSpeaking) {
          ctx.fillStyle = `rgba(${secondaryRgb}, ${0.5 + Math.min(0.5, barH / height)})`;
        } else if (isListening) {
          ctx.fillStyle = `rgba(${primaryRgb}, ${0.45 + Math.min(0.55, barH / height)})`;
        } else if (state === 'connecting') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
        } else {
          ctx.fillStyle = `rgba(${primaryRgb}, 0.24)`;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
        ctx.fill();
      }

      // Overlay smooth real-time oscilloscope wave when active audio is present
      if ((isSpeaking || isListening) && metrics.rms > 0.01 && !prefersReducedMotion) {
        const primaryRgb = hexToRgbString(customPrimaryColor, '244, 63, 94');
        const secondaryRgb = hexToRgbString(customSecondaryColor, '217, 70, 239');
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isSpeaking
          ? `rgba(${secondaryRgb}, 0.82)`
          : `rgba(${primaryRgb}, 0.78)`;

        const sliceWidth = totalBarAreaWidth / (timeData.length - 1);
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          const x = startX + i * sliceWidth;
          const y = centerY + v * (height * 0.42);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      ctx.restore();
    },
    [
      animationsEnabled,
      customPrimaryColor,
      customSecondaryColor,
      enabled,
      state,
    ]
  );

  useAudioVisualizer(state, enabled, drawWaveform);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="w-full h-16 sm:h-20 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};
