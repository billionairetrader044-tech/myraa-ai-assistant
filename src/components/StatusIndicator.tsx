import React, { useEffect, useState } from 'react';
import { EMOTIONAL_MOODS } from '../live/liveConfig';
import { AssistantError, AssistantState, EmotionalMood } from '../types/live';
import { RotateCcw } from 'lucide-react';

interface StatusIndicatorProps {
  state: AssistantState;
  assistantName?: string;
  emotionalMood: EmotionalMood;
  partnerNickname: string;
  customPrimaryColor?: string;
  showMoodBar?: boolean;
  showSessionTimer?: boolean;
  error: AssistantError | null;
  sessionStartedAt: number | null;
  activeVoiceName: string;
  onSelectMood: (mood: EmotionalMood) => void;
  onRetry: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  assistantName = 'Myraa',
  emotionalMood,
  partnerNickname,
  customPrimaryColor = '#f43f5e',
  showMoodBar = true,
  showSessionTimer = true,
  error,
  sessionStartedAt,
  activeVoiceName,
  onSelectMood,
  onRetry,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!sessionStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const update = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000))
      );
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [sessionStartedAt]);

  const currentMoodObj =
    EMOTIONAL_MOODS.find((m) => m.id === emotionalMood) || EMOTIONAL_MOODS[0];
  const nick = partnerNickname?.trim() || 'Jaan';

  const getPrimaryHeading = () => {
    switch (state) {
      case 'disconnected':
        return `${assistantName} · Your AI Girlfriend`;
      case 'connecting':
        return `Calling ${assistantName}...`;
      case 'connected':
      case 'listening':
        return `Bolo ${nick}, main sun rahi hoon...`;
      case 'thinking':
        return `Feeling your words, ${nick}...`;
      case 'executing':
        return `Doing it for you, ${nick}...`;
      case 'speaking':
        return `${assistantName} is talking to you...`;
      case 'interrupted':
        return `Haan ${nick}, bolo na...`;
      case 'error':
        return 'Call Interrupted';
    }
  };

  const getSubtitle = () => {
    switch (state) {
      case 'disconnected':
        if (emotionalMood === 'missing_you') {
          return `“Itni der kahan the ${nick}? Tap the heart to talk to me!”`;
        }
        if (emotionalMood === 'playful') {
          return `“Accha ji, aaj meri yaad aa gayi? Tap to call me, ${nick}!”`;
        }
        if (emotionalMood === 'caring') {
          return `“Thak gaye ho kya ${nick}? Come talk to me, main hoon na.”`;
        }
        return `“Hey ${nick}, I missed your voice... Tap the heart and talk to me.”`;
      case 'connecting':
        return 'Connecting real-time emotional voice call...';
      case 'connected':
      case 'listening':
        return `${currentMoodObj.hinglishTag} — Speak in Urdu, Hindi, Hinglish, or English`;
      case 'thinking':
        return 'Understanding your mood & feelings...';
      case 'executing':
        return 'Taking care of your request with love';
      case 'speaking':
        return 'Speak anytime to interrupt or tease her naturally';
      case 'interrupted':
        return `Stopped speaking — listening to you, ${nick}`;
      case 'error':
        return (
          error?.userMessage ||
          'Something interrupted our voice call. Tap below to reconnect.'
        );
    }
  };

  return (
    <div
      className="flex flex-col items-center text-center px-4 max-w-2xl mx-auto"
      role="status"
      aria-live="polite"
    >
      {/* Clean unboxed telemetry metadata line */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-300/75 mb-2 font-mono tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span
            style={{
              backgroundColor:
                state === 'error' ? '#ef4444' : customPrimaryColor,
              boxShadow:
                state === 'listening' || state === 'speaking'
                  ? `0 0 8px ${customPrimaryColor}`
                  : 'none',
            }}
            className="inline-block w-2 h-2 rounded-full"
            aria-hidden="true"
          />
          <span>Voice: {activeVoiceName}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>{currentMoodObj.label}</span>
        {showSessionTimer && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {sessionStartedAt
                ? formatDuration(elapsedSeconds)
                : 'Waiting for you'}
            </span>
          </>
        )}
      </div>

      {/* Primary Display State Heading */}
      <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-50 text-balance transition-colors">
        {getPrimaryHeading()}
      </h1>

      {/* Emotional Quote / Subtitle */}
      <p
        className={`mt-1.5 text-sm sm:text-base max-w-lg transition-colors ${
          state === 'error' ? 'text-red-300' : 'text-slate-300/85'
        }`}
      >
        {getSubtitle()}
      </p>

      {/* Interactive Emotional Mood Selector Bar */}
      {showMoodBar && (
        <div
          aria-label="Emotional Mood Selector"
          className="mt-4 flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-xl bg-white/[0.04] border border-white/10"
        >
          {EMOTIONAL_MOODS.map((mood) => {
            const isActive = emotionalMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => onSelectMood(mood.id)}
                title={mood.description}
                style={
                  isActive
                    ? {
                        backgroundColor: customPrimaryColor,
                        boxShadow: `0 0 16px ${customPrimaryColor}66`,
                      }
                    : undefined
                }
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {mood.hinglishTag}
              </button>
            );
          })}
        </div>
      )}

      {/* Friendly Error Recovery Action */}
      {state === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          style={{ backgroundColor: customPrimaryColor }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 rounded-lg transition-opacity cursor-pointer min-h-[40px] whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Call {assistantName} Again</span>
        </button>
      )}
    </div>
  );
};
