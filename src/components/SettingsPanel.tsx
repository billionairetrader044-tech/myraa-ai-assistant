import React, { useEffect, useState } from 'react';
import { getMicrophoneDevices } from '../audio/audioUtils';
import {
  AVAILABLE_LIVE_MODELS,
  AVAILABLE_VOICES,
  EMOTIONAL_MOODS,
  THEME_COLOR_PRESETS,
} from '../live/liveConfig';
import { DEFAULT_SETTINGS } from '../state/StateManager';
import { AudioDeviceOption } from '../types/audio';
import {
  AssistantState,
  EmotionalMood,
  LanguageStyle,
  MyraaSettings,
  ParticleStyle,
  PrebuiltVoiceName,
  ResponseLengthStyle,
} from '../types/live';
import { AiraBackendSnapshot, PermissionLevel } from '../types/aira';
import {
  X,
  RefreshCw,
  Palette,
  Heart,
  Volume2,
  Sliders,
  RotateCcw,
  Folder,
  Globe,
} from 'lucide-react';

export type SettingsSectionTab = 'colors' | 'persona' | 'audio' | 'general';

interface SettingsPanelProps {
  isOpen: boolean;
  initialSection?: SettingsSectionTab;
  state: AssistantState;
  settings: MyraaSettings;
  apiConfiguredOnServer: boolean | null;
  backend: AiraBackendSnapshot | null;
  onUpdateSettings: (partial: Partial<MyraaSettings>) => void;
  onUpdateSecuritySettings: (payload: {
    permissionOverrides?: Record<string, PermissionLevel>;
    allowedDirectories?: string[];
    autoOrganizeConfirmed?: boolean;
    trustedWhatsappAutoSend?: boolean;
    startWithWindows?: boolean;
    configuredBrowser?: 'chrome' | 'edge' | 'firefox';
  }) => Promise<void>;
  onClose: () => void;
}

const ALL_SAFE_DIRS = [
  'Desktop',
  'Downloads',
  'Documents',
  'Projects',
  'Pictures',
  'Videos',
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  initialSection = 'colors',
  state,
  settings,
  apiConfiguredOnServer,
  backend,
  onUpdateSettings,
  onUpdateSecuritySettings,
  onClose,
}) => {
  const [microphones, setMicrophones] = useState<AudioDeviceOption[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionTab>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);

  const refreshDevices = async () => {
    setLoadingDevices(true);
    const list = await getMicrophoneDevices();
    setMicrophones(list);
    setLoadingDevices(false);
  };

  useEffect(() => {
    if (isOpen) {
      void refreshDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allowedDirs = backend?.allowedDirectories || ALL_SAFE_DIRS;
  const primaryHex = settings.customPrimaryColor || '#f43f5e';

  const toggleDirectory = (dir: string) => {
    const exists = allowedDirs.includes(dir);
    const next = exists
      ? allowedDirs.filter((d) => d !== dir)
      : [...allowedDirs, dir];
    void onUpdateSecuritySettings({ allowedDirectories: next });
  };

  const applyThemePreset = (presetId: string) => {
    const preset = THEME_COLOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onUpdateSettings({
      themePresetId: preset.id,
      customPrimaryColor: preset.primaryHex,
      customSecondaryColor: preset.secondaryHex,
      customBgColor: preset.bgHex,
    });
  };

  const handleResetAllSettings = () => {
    onUpdateSettings({ ...DEFAULT_SETTINGS });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings & Color Customization"
    >
      <div className="relative w-full max-w-lg bg-[#0B0914] border-l border-white/10 h-full flex flex-col p-6 overflow-y-auto text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-100">
              {settings.assistantName || 'Myraa'} · Settings & Customization
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Custom Colors · Emotional Persona · Voice & Audio · General Preferences
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Category Tabs */}
        <div className="mt-4 grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveSection('colors')}
            style={
              activeSection === 'colors'
                ? {
                    backgroundColor: `${primaryHex}28`,
                    borderColor: `${primaryHex}80`,
                  }
                : undefined
            }
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'colors'
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span>Colors</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('persona')}
            style={
              activeSection === 'persona'
                ? {
                    backgroundColor: `${primaryHex}28`,
                    borderColor: `${primaryHex}80`,
                  }
                : undefined
            }
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'persona'
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5 shrink-0" />
            <span>Persona</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('audio')}
            style={
              activeSection === 'audio'
                ? {
                    backgroundColor: `${primaryHex}28`,
                    borderColor: `${primaryHex}80`,
                  }
                : undefined
            }
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'audio'
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('general')}
            style={
              activeSection === 'general'
                ? {
                    backgroundColor: `${primaryHex}28`,
                    borderColor: `${primaryHex}80`,
                  }
                : undefined
            }
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'general'
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>General</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="mt-5 space-y-6 flex-1 text-xs">
          {/* TAB 1: COLORS & APPEARANCE */}
          {activeSection === 'colors' && (
            <>
              {/* 01. Theme Color Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2.5">
                  01. Theme Color Presets (1-Click)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_COLOR_PRESETS.map((preset) => {
                    const isSelected = settings.themePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyThemePreset(preset.id)}
                        style={
                          isSelected
                            ? {
                                borderColor: preset.primaryHex,
                                backgroundColor: `${preset.primaryHex}18`,
                              }
                            : undefined
                        }
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white'
                            : 'bg-slate-900/60 border-white/[0.08] text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center -space-x-1.5 shrink-0">
                          <span
                            style={{ backgroundColor: preset.primaryHex }}
                            className="w-4 h-4 rounded-full border border-black/40"
                          />
                          <span
                            style={{ backgroundColor: preset.secondaryHex }}
                            className="w-4 h-4 rounded-full border border-black/40"
                          />
                        </span>
                        <span className="font-medium truncate">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 02. Custom Color Pickers */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3.5">
                <div className="text-xs font-semibold text-slate-200">
                  02. Custom Color Adjustment (Pick Any Color)
                </div>

                {/* Primary Orb & Button Color */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Primary Orb & Accent Color
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Main core ring, buttons, and active highlights
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-300 uppercase">
                      {settings.customPrimaryColor}
                    </span>
                    <input
                      type="color"
                      aria-label="Primary Orb and Accent Color"
                      value={settings.customPrimaryColor || '#f43f5e'}
                      onChange={(e) =>
                        onUpdateSettings({
                          themePresetId: 'custom',
                          customPrimaryColor: e.target.value,
                        })
                      }
                      className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Secondary Glow & Waveform Color */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Secondary Aura & Speaking Wave Color
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Outer glow gradient and voice waveform color
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-300 uppercase">
                      {settings.customSecondaryColor}
                    </span>
                    <input
                      type="color"
                      aria-label="Secondary Aura and Wave Color"
                      value={settings.customSecondaryColor || '#d946ef'}
                      onChange={(e) =>
                        onUpdateSettings({
                          themePresetId: 'custom',
                          customSecondaryColor: e.target.value,
                        })
                      }
                      className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                {/* Background Canvas Color */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Background Canvas Color
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Main app backdrop color
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-300 uppercase">
                      {settings.customBgColor}
                    </span>
                    <input
                      type="color"
                      aria-label="Background Canvas Color"
                      value={settings.customBgColor || '#09060e'}
                      onChange={(e) =>
                        onUpdateSettings({
                          themePresetId: 'custom',
                          customBgColor: e.target.value,
                        })
                      }
                      className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 03. Orb Particle Style */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  03. Floating Particle Style
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'hearts', label: 'Hearts' },
                      { id: 'stars', label: 'Stars' },
                      { id: 'orbs', label: 'Soft Dots' },
                      { id: 'none', label: 'None' },
                    ] as Array<{ id: ParticleStyle; label: string }>
                  ).map((p) => {
                    const active = settings.particleStyle === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ particleStyle: p.id })
                        }
                        style={
                          active
                            ? {
                                borderColor: primaryHex,
                                backgroundColor: `${primaryHex}22`,
                              }
                            : undefined
                        }
                        className={`py-2 px-2 rounded-xl font-medium border text-center transition-colors cursor-pointer ${
                          active
                            ? 'text-white'
                            : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 04. Glow Intensity & Orb Size Sliders */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-medium">
                      Aura Glow Intensity
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round((settings.glowIntensity ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.05"
                    value={settings.glowIntensity ?? 1}
                    onChange={(e) =>
                      onUpdateSettings({
                        glowIntensity: parseFloat(e.target.value),
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-medium">
                      Central Orb Scale (Size)
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round((settings.orbScale ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.25"
                    step="0.05"
                    value={settings.orbScale ?? 1}
                    onChange={(e) =>
                      onUpdateSettings({
                        orbScale: parseFloat(e.target.value),
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Voice Waveform Visualizer
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Show real-time frequency bars below the central orb
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.visualizerEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ visualizerEnabled: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Smooth 60fps Orb Motion & Heartbeat
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Animate wave lobes, rings, and floating particles
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.animationsEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ animationsEnabled: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </>
          )}

          {/* TAB 2: PERSONA & EMOTIONAL MOOD */}
          {activeSection === 'persona' && (
            <>
              {/* 01. Names & Language */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="assistant-name"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Her Name
                    </label>
                    <input
                      id="assistant-name"
                      type="text"
                      value={settings.assistantName || 'Myraa'}
                      onChange={(e) =>
                        onUpdateSettings({ assistantName: e.target.value })
                      }
                      placeholder="Myraa, Aira, Zara..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-100 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="partner-nickname"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      What She Calls You
                    </label>
                    <input
                      id="partner-nickname"
                      type="text"
                      value={settings.partnerNickname || 'Jaan'}
                      onChange={(e) =>
                        onUpdateSettings({ partnerNickname: e.target.value })
                      }
                      placeholder="Jaan, Baby, Shona..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-100 focus:outline-none focus:border-white/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="lang-style"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Speaking Language
                    </label>
                    <select
                      id="lang-style"
                      value={settings.languageStyle || 'hinglish'}
                      onChange={(e) =>
                        onUpdateSettings({
                          languageStyle: e.target.value as LanguageStyle,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-100"
                    >
                      <option value="hinglish">Hinglish (Hindi/Urdu + English)</option>
                      <option value="urdu_hindi">Sweet Urdu / Hindi</option>
                      <option value="hindi">Romantic Hindi</option>
                      <option value="english">Warm English</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="response-length"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Reply Style & Length
                    </label>
                    <select
                      id="response-length"
                      value={settings.responseLength || 'balanced'}
                      onChange={(e) =>
                        onUpdateSettings({
                          responseLength: e.target.value as ResponseLengthStyle,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-100"
                    >
                      <option value="short">Short & Snappy (1–2 lines)</option>
                      <option value="balanced">Balanced & Natural</option>
                      <option value="expressive">Deep & Expressive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 02. Emotional Mood Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  02. Emotional Mood (Live Switchable)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {EMOTIONAL_MOODS.map((mood) => {
                    const active = settings.emotionalMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            emotionalMood: mood.id as EmotionalMood,
                          })
                        }
                        style={
                          active
                            ? {
                                borderColor: primaryHex,
                                backgroundColor: `${primaryHex}20`,
                              }
                            : undefined
                        }
                        className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${
                          active
                            ? 'text-slate-100'
                            : 'bg-slate-900/60 border-white/[0.07] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {mood.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-300">
                            {mood.hinglishTag}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {mood.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 03. Emotional Intensity & Auto-Greet */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-medium">
                      Emotional & Romantic Intensity
                    </span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      {settings.affectionLevel ?? 92}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={settings.affectionLevel ?? 92}
                    onChange={(e) =>
                      onUpdateSettings({
                        affectionLevel: parseInt(e.target.value, 10),
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Speak First When Call Connects (Auto-Greet)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      She greets you warmly as soon as the voice call starts
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoGreetOnConnect ?? true}
                    onChange={(e) =>
                      onUpdateSettings({
                        autoGreetOnConnect: e.target.checked,
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <div className="pt-2 border-t border-white/[0.06]">
                  <label
                    htmlFor="custom-instructions"
                    className="block text-slate-200 font-medium mb-1.5"
                  >
                    Custom Memory / Extra Instructions
                  </label>
                  <textarea
                    id="custom-instructions"
                    rows={3}
                    value={settings.customInstructions || ''}
                    onChange={(e) =>
                      onUpdateSettings({ customInstructions: e.target.value })
                    }
                    placeholder="Add special details you want her to remember (e.g., 'Remind me to drink water, ask about my trading day, be extra sweet at night')..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 3: VOICE & AUDIO */}
          {activeSection === 'audio' && (
            <>
              {/* 01. Voice Tone */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2.5">
                  01. Voice Tone Persona
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_VOICES.map((voice) => {
                    const active = settings.voiceName === voice.id;
                    return (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            voiceName: voice.id as PrebuiltVoiceName,
                          })
                        }
                        style={
                          active
                            ? {
                                borderColor: primaryHex,
                                backgroundColor: `${primaryHex}20`,
                              }
                            : undefined
                        }
                        className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${
                          active
                            ? 'text-slate-100'
                            : 'bg-slate-900/60 border-white/[0.07] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-sm font-semibold">{voice.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                          {voice.character}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 02. Gemini Live Model & Microphone */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-4">
                <div>
                  <label
                    htmlFor="model-select"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Real-Time Voice AI Model
                  </label>
                  <select
                    id="model-select"
                    value={settings.model}
                    onChange={(e) =>
                      onUpdateSettings({ model: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-200"
                  >
                    {AVAILABLE_LIVE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.badge})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="mic-select"
                      className="text-xs font-semibold text-slate-300"
                    >
                      Microphone Input Device
                    </label>
                    <button
                      type="button"
                      onClick={() => void refreshDevices()}
                      className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${
                          loadingDevices ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <select
                    id="mic-select"
                    value={settings.selectedMicrophoneId}
                    onChange={(e) =>
                      onUpdateSettings({ selectedMicrophoneId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-sm text-slate-200"
                  >
                    <option value="default">System Default Microphone</option>
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 03. Volume, Barge-In & Studio Audio Filters */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-medium">
                      Output Voice Volume
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(settings.outputVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={settings.outputVolume}
                    onChange={(e) =>
                      onUpdateSettings({
                        outputVolume: parseFloat(e.target.value),
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-medium">
                      Interruption (Barge-In) Sensitivity
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {settings.bargeInSensitivity.toFixed(3)} RMS
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.015"
                    max="0.12"
                    step="0.005"
                    value={settings.bargeInSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({
                        bargeInSensitivity: parseFloat(e.target.value),
                      })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Echo Cancellation
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Prevents speaker audio from feeding back into your mic
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.echoCancellation ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ echoCancellation: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Background Noise Suppression
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Filters fan noise and background hum for clearer speech
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.noiseSuppression ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ noiseSuppression: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Auto Gain Control (Mic Boost)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Automatically balances soft whispers and loud speech
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoGainControl ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ autoGainControl: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </>
          )}

          {/* TAB 4: GENERAL & SYSTEM */}
          {activeSection === 'general' && (
            <div className="space-y-4">
              {/* 01. Home Screen Display Controls */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3">
                <div className="font-semibold text-slate-200">
                  01. Interface & Display Preferences
                </div>

                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Show Mood Bar on Home Screen
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Display the 5 emotional mood buttons under the title
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showMoodBar ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ showMoodBar: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Show Quick Voice Suggestion Chips
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Display quick phrases during an active call
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showQuickPrompts ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ showQuickPrompts: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Show Call Duration Timer
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Display live call elapsed timer in the status line
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showSessionTimer ?? true}
                    onChange={(e) =>
                      onUpdateSettings({ showSessionTimer: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-white/[0.06] cursor-pointer">
                  <div>
                    <div className="text-slate-200 font-medium">
                      Developer Diagnostics Console
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Show technical live session logs on the main screen
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.debugModeEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ debugModeEnabled: e.target.checked })
                    }
                    style={{ accentColor: primaryHex }}
                    className="w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              {/* 02. Browser & Safe Folders */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Globe className="w-4 h-4" />
                  <span>Preferred Browser Provider</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['chrome', 'edge', 'firefox'] as const).map((b) => {
                    const active = (backend?.configuredBrowser || 'chrome') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() =>
                          void onUpdateSecuritySettings({ configuredBrowser: b })
                        }
                        style={
                          active
                            ? {
                                borderColor: primaryHex,
                                backgroundColor: `${primaryHex}22`,
                              }
                            : undefined
                        }
                        className={`py-2 px-3 rounded-xl font-semibold uppercase text-center border transition-colors cursor-pointer ${
                          active
                            ? 'text-white'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Folder className="w-4 h-4" />
                  <span>Authorized Safe Folders</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SAFE_DIRS.map((dir) => {
                    const enabled = allowedDirs.includes(dir);
                    return (
                      <label
                        key={dir}
                        style={
                          enabled
                            ? {
                                borderColor: `${primaryHex}66`,
                                backgroundColor: `${primaryHex}15`,
                              }
                            : undefined
                        }
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer ${
                          enabled
                            ? 'text-slate-100'
                            : 'bg-slate-950 border-white/10 text-slate-500'
                        }`}
                      >
                        <span className="font-medium">{dir}</span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleDirectory(dir)}
                          style={{ accentColor: primaryHex }}
                          className="w-4 h-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 03. Connection Status & Reset to Defaults */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session State</span>
                  <span className="font-mono text-slate-200 uppercase">
                    {state}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Server API Status</span>
                  <span
                    className={`font-mono ${
                      apiConfiguredOnServer === false
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {apiConfiguredOnServer === null
                      ? 'Checking...'
                      : apiConfiguredOnServer
                        ? 'Connected'
                        : 'Local Mode'}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={handleResetAllSettings}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Colors & Settings to Default</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
