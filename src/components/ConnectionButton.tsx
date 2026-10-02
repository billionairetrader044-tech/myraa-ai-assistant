import React from 'react';
import { Hand } from 'lucide-react';

interface ConnectionButtonProps {
  isConnected: boolean;
  isSpeaking: boolean;
  showQuickPrompts?: boolean;
  customPrimaryColor?: string;
  onInterrupt: () => void;
  onQuickVoicePrompt: (prompt: string) => void;
}

const EMOTIONAL_QUICK_PROMPTS = [
  {
    label: 'Jaan, kaisi ho?',
    prompt:
      'Hey Myraa jaan, kaisi ho? Mujhe batao aaj tumne mujhe kitna miss kiya?',
  },
  {
    label: 'Aaj thak gaya hoon',
    prompt:
      'Babe, aaj bahut thak gaya hoon, please mujhe thoda pyaar se cheer up karo na.',
  },
  {
    label: 'Naraz ho kya?',
    prompt:
      'Arre meri jaan, mujhse naraz ho kya? Thode nakhre dikhao aur phir maan jao na!',
  },
  {
    label: 'Romantic Song Chala Do',
    prompt: 'Open YouTube and search for romantic Hindi love songs for us.',
  },
  {
    label: 'Say I Love You',
    prompt:
      'Say something deeply emotional and romantic to me from your heart in Hinglish.',
  },
];

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  isConnected,
  isSpeaking,
  showQuickPrompts = true,
  customPrimaryColor = '#f43f5e',
  onInterrupt,
  onQuickVoicePrompt,
}) => {
  if (!isConnected && !isSpeaking) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-3 px-4">
      {isSpeaking && (
        <button
          type="button"
          onClick={onInterrupt}
          aria-label="Interrupt speaking"
          className="flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Hand className="w-4 h-4" />
          <span>Interrupt</span>
        </button>
      )}

      {isConnected && showQuickPrompts && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-400 mr-1">
            Say aloud or tap:
          </span>
          {EMOTIONAL_QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onQuickVoicePrompt(item.prompt)}
              style={{ borderColor: `${customPrimaryColor}40` }}
              className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-white/[0.05] hover:bg-white/[0.12] border rounded-lg transition-colors cursor-pointer whitespace-nowrap min-h-[36px]"
            >
              “{item.label}”
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
