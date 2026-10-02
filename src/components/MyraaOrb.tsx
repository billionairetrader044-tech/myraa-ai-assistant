import React, { useCallback, useEffect, useRef } from 'react';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import { hexToRgbString } from '../live/liveConfig';
import { AudioMetrics } from '../types/audio';
import { AssistantState, EmotionalMood, ParticleStyle } from '../types/live';
import { Heart, Mic, AlertTriangle, Sparkles, Volume2 } from 'lucide-react';

interface MyraaOrbProps {
  state: AssistantState;
  assistantName?: string;
  partnerNickname?: string;
  emotionalMood?: EmotionalMood;
  customPrimaryColor?: string;
  customSecondaryColor?: string;
  glowIntensity?: number;
  orbScale?: number;
  particleStyle?: ParticleStyle;
  visualizerEnabled: boolean;
  animationsEnabled: boolean;
  onPress: () => void;
}

interface OrbitalParticle {
  angle: number;
  radiusOffset: number;
  speed: number;
  size: number;
  alpha: number;
  isSpecial: boolean;
}

function drawMicroHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, topCurveHeight);
  ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
  ctx.bezierCurveTo(
    -size / 2,
    (size + topCurveHeight) / 2,
    0,
    (size + topCurveHeight) / 1.4,
    0,
    size
  );
  ctx.bezierCurveTo(
    0,
    (size + topCurveHeight) / 1.4,
    size / 2,
    (size + topCurveHeight) / 2,
    size / 2,
    topCurveHeight
  );
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMicroStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    const midAngle = angle + Math.PI / 4;
    ctx.lineTo(
      Math.cos(midAngle) * (radius * 0.35),
      Math.sin(midAngle) * (radius * 0.35)
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const MyraaOrb: React.FC<MyraaOrbProps> = ({
  state,
  assistantName = 'Myraa',
  partnerNickname = 'Jaan',
  customPrimaryColor = '#f43f5e',
  customSecondaryColor = '#d946ef',
  glowIntensity = 1.0,
  orbScale = 1.0,
  particleStyle = 'hearts',
  visualizerEnabled,
  animationsEnabled,
  onPress,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedRmsRef = useRef<number>(0);
  const smoothedBassRef = useRef<number>(0);
  const smoothedMidRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const particlesRef = useRef<OrbitalParticle[]>([]);

  useEffect(() => {
    const count = 28;
    const list: OrbitalParticle[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        angle: (Math.PI * 2 * i) / count + Math.random() * 0.4,
        radiusOffset: 0.78 + Math.random() * 0.38,
        speed: (0.003 + Math.random() * 0.006) * (i % 2 === 0 ? 1 : -1),
        size: 1.4 + Math.random() * 2.0,
        alpha: 0.28 + Math.random() * 0.55,
        isSpecial: i % 3 === 0,
      });
    }
    particlesRef.current = list;
  }, []);

  const renderOrbFrame = useCallback(
    (
      metrics: AudioMetrics,
      _activeSource: 'input' | 'output' | 'idle',
      timestamp: number
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth || 320;
      const displayHeight = canvas.clientHeight || 320;

      if (
        canvas.width !== Math.floor(displayWidth * dpr) ||
        canvas.height !== Math.floor(displayHeight * dpr)
      ) {
        canvas.width = Math.floor(displayWidth * dpr);
        canvas.height = Math.floor(displayHeight * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const cx = displayWidth / 2;
      const cy = displayHeight / 2;
      const baseRadius =
        Math.min(displayWidth, displayHeight) * 0.27 * Math.max(0.75, Math.min(1.3, orbScale));

      const targetRms = visualizerEnabled ? metrics.rms : 0;
      const targetBass = visualizerEnabled ? metrics.bassEnergy : 0;
      const targetMid = visualizerEnabled ? metrics.midEnergy : 0;

      smoothedRmsRef.current += (targetRms - smoothedRmsRef.current) * 0.22;
      smoothedBassRef.current += (targetBass - smoothedBassRef.current) * 0.18;
      smoothedMidRef.current += (targetMid - smoothedMidRef.current) * 0.2;

      const rms = smoothedRmsRef.current;
      const bass = smoothedBassRef.current;
      const mid = smoothedMidRef.current;

      const prefersReducedMotion =
        !animationsEnabled ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (!prefersReducedMotion) {
        const speedMultiplier =
          state === 'speaking'
            ? 1.85 + rms * 3.6
            : state === 'listening' || state === 'connected'
              ? 1.15 + rms * 2.5
              : state === 'connecting'
                ? 2.2
                : 0.5;
        phaseRef.current += 0.018 * speedMultiplier;
      }

      const phase = phaseRef.current;

      // User-customized primary & secondary RGB colors
      let primaryRgb = hexToRgbString(customPrimaryColor, '244, 63, 94');
      let secondaryRgb = hexToRgbString(customSecondaryColor, '217, 70, 239');
      let accentRgb = primaryRgb;

      if (state === 'speaking') {
        accentRgb = secondaryRgb;
      } else if (state === 'connecting') {
        accentRgb = '251, 191, 36';
      } else if (state === 'error') {
        primaryRgb = '239, 68, 68';
        secondaryRgb = '190, 18, 60';
        accentRgb = '252, 165, 165';
      }

      const heartbeat =
        Math.pow(Math.sin(timestamp * 0.0032), 6) * 0.035 +
        Math.pow(Math.sin(timestamp * 0.0032 - 0.45), 6) * 0.02;

      const breathScale = prefersReducedMotion
        ? 1
        : state === 'disconnected'
          ? 1 + heartbeat
          : state === 'connecting'
            ? 1 + Math.sin(timestamp * 0.005) * 0.05
            : 1 + heartbeat * 0.8 + rms * 0.38 + bass * 0.15;

      const dynamicRadius = baseRadius * breathScale;

      // 1. Outer ambient radial glow scaled by glowIntensity
      const outerGlowRadius = dynamicRadius * (1.85 + rms * 0.65) * Math.max(0.6, glowIntensity);
      const ambientGrad = ctx.createRadialGradient(
        cx,
        cy,
        dynamicRadius * 0.2,
        cx,
        cy,
        outerGlowRadius
      );
      const baseGlowAlpha =
        (state === 'disconnected' ? 0.18 : 0.32 + Math.min(0.45, rms * 1.15)) *
        Math.min(1.4, glowIntensity);
      const glowOpacity = Math.min(0.88, Math.max(0.05, baseGlowAlpha));

      ambientGrad.addColorStop(0, `rgba(${primaryRgb}, ${glowOpacity})`);
      ambientGrad.addColorStop(
        0.5,
        `rgba(${secondaryRgb}, ${glowOpacity * 0.48})`
      );
      ambientGrad.addColorStop(1, 'rgba(6, 8, 15, 0)');

      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Precision orbital rings
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${primaryRgb}, ${
        state === 'disconnected' ? 0.22 : 0.35
      })`;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.48, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed rotating aura ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase * 0.35);
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = `rgba(${secondaryRgb}, ${
        state === 'disconnected' ? 0.2 : 0.42
      })`;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Reactive harmonic wave lobes (when listening or speaking)
      if (
        (state === 'listening' ||
          state === 'connected' ||
          state === 'speaking' ||
          state === 'interrupted') &&
        !prefersReducedMotion
      ) {
        const freqBins = metrics.frequencyBins;
        const points = 64;

        for (let layer = 0; layer < 2; layer++) {
          ctx.beginPath();
          const layerColor = layer === 0 ? primaryRgb : secondaryRgb;
          const layerAlpha = layer === 0 ? 0.62 : 0.4;
          ctx.strokeStyle = `rgba(${layerColor}, ${layerAlpha})`;
          ctx.lineWidth = layer === 0 ? 2.2 : 1.35;

          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const binIdx = Math.floor(((i % (points / 2)) / (points / 2)) * 48);
            const binVal = (freqBins[binIdx] || 0) / 255;

            const waveDeform =
              Math.sin(
                angle * (4 + layer * 2) + phase * (layer === 0 ? 1.4 : -1.1)
              ) *
              (4 + rms * 26 + binVal * 18);

            const r = dynamicRadius * (1.06 + layer * 0.08) + waveDeform;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // 4. Configurable Orbital Particles (hearts | stars | orbs | none)
      if (!prefersReducedMotion && particleStyle !== 'none') {
        const particles = particlesRef.current;
        for (const p of particles) {
          p.angle += p.speed * (1 + rms * 4 + mid * 2);
          const pr =
            baseRadius * p.radiusOffset +
            (state === 'speaking' || state === 'listening' ? rms * 28 : 0);
          const px = cx + Math.cos(p.angle) * pr;
          const py = cy + Math.sin(p.angle) * pr;

          ctx.fillStyle = `rgba(${p.isSpecial ? secondaryRgb : primaryRgb}, ${
            p.alpha * (state === 'disconnected' ? 0.45 : 0.9)
          })`;

          if (particleStyle === 'hearts' && p.isSpecial) {
            drawMicroHeart(ctx, px, py - 3, p.size * 3.2 * (1 + rms * 0.6));
          } else if (particleStyle === 'stars' && p.isSpecial) {
            drawMicroStar(ctx, px, py, p.size * 2.6 * (1 + rms * 0.6));
          } else {
            ctx.beginPath();
            ctx.arc(px, py, p.size * (1 + rms * 0.8), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 5. Core sphere gradient
      const coreGrad = ctx.createRadialGradient(
        cx - dynamicRadius * 0.25,
        cy - dynamicRadius * 0.25,
        dynamicRadius * 0.08,
        cx,
        cy,
        dynamicRadius
      );

      if (state === 'disconnected') {
        coreGrad.addColorStop(0, `rgba(${primaryRgb}, 0.28)`);
        coreGrad.addColorStop(0.7, 'rgba(15, 10, 24, 0.94)');
        coreGrad.addColorStop(1, `rgba(${secondaryRgb}, 0.38)`);
      } else {
        coreGrad.addColorStop(0, `rgba(${secondaryRgb}, 0.5)`);
        coreGrad.addColorStop(0.55, `rgba(${primaryRgb}, 0.34)`);
        coreGrad.addColorStop(0.88, 'rgba(15, 10, 24, 0.92)');
        coreGrad.addColorStop(1, `rgba(${primaryRgb}, 0.75)`);
      }

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core border rim
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(${primaryRgb}, ${
        state === 'disconnected' ? 0.48 : 0.85
      })`;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    },
    [
      animationsEnabled,
      customPrimaryColor,
      customSecondaryColor,
      glowIntensity,
      orbScale,
      particleStyle,
      state,
      visualizerEnabled,
    ]
  );

  useAudioVisualizer(state, visualizerEnabled, renderOrbFrame);

  const nick = partnerNickname?.trim() || 'Jaan';

  const getAriaLabel = () => {
    switch (state) {
      case 'disconnected':
        return `Call ${assistantName}`;
      case 'connecting':
        return `Calling ${assistantName} — tap to cancel`;
      case 'connected':
      case 'listening':
        return `${assistantName} is listening to you — tap to end call`;
      case 'speaking':
        return `${assistantName} is speaking — speak to interrupt or tap to end call`;
      case 'interrupted':
        return `Interrupted — ${assistantName} is listening to you`;
      case 'error':
        return `Call interrupted — tap to reconnect with ${assistantName}`;
    }
  };

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Interactive Central Heartbeat Orb Button */}
      <button
        type="button"
        onClick={onPress}
        aria-label={getAriaLabel()}
        className="group relative flex items-center justify-center w-60 h-60 sm:w-72 sm:h-72 rounded-full cursor-pointer focus:outline-none transition-transform duration-200 active:scale-[0.97]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Center Core Icon & Micro Status */}
        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
          <div
            style={{
              borderColor:
                state === 'error' ? '#ef4444' : `${customPrimaryColor}88`,
              boxShadow:
                state === 'disconnected'
                  ? `0 0 22px ${customPrimaryColor}33`
                  : `0 0 30px ${customPrimaryColor}66`,
            }}
            className="flex items-center justify-center w-16 h-16 rounded-full border bg-black/45 backdrop-blur-md text-white transition-all duration-300 group-hover:scale-105"
          >
            {state === 'disconnected' && (
              <Heart
                style={{ color: customPrimaryColor }}
                className="w-7 h-7 fill-current/30"
              />
            )}
            {(state === 'connecting' ||
              state === 'thinking' ||
              state === 'executing') && (
              <Sparkles
                style={{ color: customSecondaryColor }}
                className="w-7 h-7 animate-spin"
              />
            )}
            {(state === 'listening' ||
              state === 'connected' ||
              state === 'interrupted') && (
              <Mic style={{ color: customPrimaryColor }} className="w-7 h-7" />
            )}
            {state === 'speaking' && (
              <Volume2
                style={{ color: customSecondaryColor }}
                className="w-7 h-7"
              />
            )}
            {state === 'error' && (
              <AlertTriangle className="w-7 h-7 text-red-400" />
            )}
          </div>

          <span className="mt-2.5 text-[11px] font-mono tracking-widest uppercase text-slate-200/85 group-hover:text-white transition-colors">
            {state === 'disconnected'
              ? `Tap to Call ${assistantName}`
              : state === 'connecting'
                ? `Calling ${nick}...`
                : state === 'thinking'
                  ? 'Feeling...'
                  : state === 'executing'
                    ? 'Doing it for you'
                    : state === 'speaking'
                      ? `${assistantName} Speaking`
                      : state === 'error'
                        ? 'Tap to Reconnect'
                        : `Listening, ${nick}`}
          </span>
        </div>
      </button>
    </div>
  );
};
