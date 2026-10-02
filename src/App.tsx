import React, { useState } from 'react';
import { CommandBar } from './components/CommandBar';
import { ConnectionButton } from './components/ConnectionButton';
import { ConversationFeed } from './components/ConversationFeed';
import { DebugPanel } from './components/DebugPanel';
import { MyraaOrb } from './components/MyraaOrb';
import { SettingsPanel, SettingsSectionTab } from './components/SettingsPanel';
import { StatusIndicator } from './components/StatusIndicator';
import { ThisPcModal } from './components/ThisPcModal';
import { ToolActionHud } from './components/ToolActionHud';
import { VoiceVisualizer } from './components/VoiceVisualizer';
import { AttachmentManager } from './core/AttachmentManager';
import { useAiraContext } from './hooks/useAiraContext';
import { useLiveSession } from './hooks/useLiveSession';
import { hexToRgbString } from './live/liveConfig';
import { UploadCloud, Square, Layers, Sliders } from 'lucide-react';

export default function App() {
  const {
    state,
    activeModel,
    sessionId,
    sessionStartedAt,
    error,
    settings,
    recentActions,
    activeActionCard,
    debugLogs,
    apiConfiguredOnServer,
    isConnected,
    isConnecting,
    isSpeaking,
    connect,
    toggleConnection,
    interrupt,
    sendVoiceCommand,
    updateSettings,
    dismissActionCard,
    clearDebugLogs,
  } = useLiveSession();

  const {
    attachments,
    conversation,
    isProcessingCommand,
    backend,
    addAttachment,
    removeAttachment,
    sendCommand,
    resolveConfirmation,
    triggerGlobalStop,
    updateSecuritySettings,
  } = useAiraContext();

  const [showMultimodalDock, setShowMultimodalDock] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsSectionTab>('colors');
  const [isActionsDrawerOpen, setIsActionsDrawerOpen] = useState(false);
  const [thisPcModalTab, setThisPcModalTab] = useState<
    'this_pc' | 'browser' | 'screenshot' | null
  >(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const openSettingsAt = (tab: SettingsSectionTab) => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    setShowMultimodalDock(true);
    for (let i = 0; i < files.length; i++) {
      const att = await AttachmentManager.fromBrowserFile(files[i]);
      await addAttachment(att);
    }
  };

  const pendingConfirmations = backend?.pendingConfirmations || [];
  const activePlan = backend?.activePlan || null;

  const primaryHex = settings.customPrimaryColor || '#f43f5e';
  const secondaryHex = settings.customSecondaryColor || '#d946ef';
  const bgHex = settings.customBgColor || '#09060e';
  const primaryRgb = hexToRgbString(primaryHex, '244, 63, 94');
  const secondaryRgb = hexToRgbString(secondaryHex, '217, 70, 239');
  const assistantName = settings.assistantName?.trim() || 'Myraa';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => void handleDrop(e)}
      style={{ backgroundColor: bgHex }}
      className="min-h-screen w-full text-slate-100 flex flex-col justify-between relative overflow-x-hidden transition-colors duration-300"
    >
      {/* Dynamic Custom Ambient Glow */}
      <div
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle at 50% 34%, rgba(${primaryRgb}, 0.14), rgba(${secondaryRgb}, 0.07) 44%, transparent 74%)`,
        }}
        className="pointer-events-none fixed inset-0"
      />

      {/* Fullscreen Drag-and-Drop Overlay */}
      {isDraggingOver && (
        <div
          style={{ borderColor: primaryHex }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md border-2 border-dashed flex flex-col items-center justify-center p-6 text-center"
        >
          <UploadCloud
            style={{ color: primaryHex }}
            className="w-16 h-16 mb-3 animate-bounce"
          />
          <h2 className="text-2xl font-display font-bold text-white">
            Drop File, Photo, or Screenshot for {assistantName}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            Share anything with {assistantName} and talk to her about it
          </p>
        </div>
      )}

      {/* Top Bar Contract: 3 Zones (Brand Wordmark — Clean Nav Links — Primary Actions) */}
      <header className="relative z-20 w-full max-w-6xl mx-auto flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setIsSettingsOpen(false);
            setThisPcModalTab(null);
          }}
          className="text-xl font-display font-bold tracking-tight text-slate-50"
        >
          {assistantName}
        </a>

        {/* Zone 2: Clean Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300/80">
          <button
            type="button"
            onClick={() => openSettingsAt('colors')}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Colors & Theme
          </button>
          <button
            type="button"
            onClick={() => openSettingsAt('persona')}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Her Mood & Persona
          </button>
          <button
            type="button"
            onClick={() => openSettingsAt('audio')}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Voice & Audio
          </button>
          <button
            type="button"
            onClick={() => {
              setThisPcModalTab('this_pc');
              setShowMultimodalDock(true);
            }}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            This PC & Browser
          </button>
        </nav>

        {/* Zone 3: Settings & Call Actions */}
        <div className="flex items-center gap-2.5">
          {(isSpeaking ||
            isProcessingCommand ||
            pendingConfirmations.length > 0) && (
            <button
              type="button"
              onClick={() => void triggerGlobalStop()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg bg-red-500/25 text-red-200 border border-red-500/50 hover:bg-red-500/35 cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openSettingsAt('colors')}
            title="Customize Colors, Persona, Audio & Settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium rounded-lg bg-white/[0.06] text-slate-200 border border-white/10 hover:text-white hover:bg-white/[0.12] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sliders
              style={{ color: primaryHex }}
              className="w-3.5 h-3.5 shrink-0"
            />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMultimodalDock((prev) => !prev)}
            title="Switch between Pure Voice Call Mode and Multimodal + Chat Bar"
            style={
              showMultimodalDock
                ? {
                    backgroundColor: `${primaryHex}28`,
                    borderColor: `${primaryHex}80`,
                  }
                : undefined
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              showMultimodalDock
                ? 'text-white'
                : 'bg-white/[0.05] text-slate-200 border-white/10 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showMultimodalDock ? 'Voice Call Only' : '+ Chat & PC'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void toggleConnection()}
            style={
              !isConnected && !isConnecting
                ? { backgroundColor: primaryHex }
                : undefined
            }
            className={`px-4 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              isConnected
                ? 'bg-red-500/20 text-red-200 border border-red-500/40 hover:bg-red-500/30'
                : isConnecting
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-white hover:opacity-90'
            }`}
          >
            {isConnected
              ? 'End Call'
              : isConnecting
                ? 'Calling...'
                : `Call ${assistantName}`}
          </button>
        </div>
      </header>

      {/* Main Focal Voice Interaction Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 gap-4">
        {/* Central Custom-Colored Heartbeat & Voice Core */}
        <MyraaOrb
          state={state}
          assistantName={assistantName}
          partnerNickname={settings.partnerNickname}
          emotionalMood={settings.emotionalMood}
          customPrimaryColor={primaryHex}
          customSecondaryColor={secondaryHex}
          glowIntensity={settings.glowIntensity}
          orbScale={settings.orbScale}
          particleStyle={settings.particleStyle}
          visualizerEnabled={settings.visualizerEnabled}
          animationsEnabled={settings.animationsEnabled}
          onPress={() => void toggleConnection()}
        />

        {/* State Heading, Emotional Mood Selector & Telemetry Readout */}
        <StatusIndicator
          state={state}
          assistantName={assistantName}
          emotionalMood={settings.emotionalMood}
          partnerNickname={settings.partnerNickname}
          customPrimaryColor={primaryHex}
          showMoodBar={settings.showMoodBar}
          showSessionTimer={settings.showSessionTimer}
          error={error}
          sessionStartedAt={sessionStartedAt}
          activeVoiceName={settings.voiceName}
          onSelectMood={(mood) => updateSettings({ emotionalMood: mood })}
          onRetry={() => void connect()}
        />

        {/* Real-Time Web Audio AnalyserNode Waveform */}
        <VoiceVisualizer
          state={state}
          enabled={settings.visualizerEnabled}
          animationsEnabled={settings.animationsEnabled}
          customPrimaryColor={primaryHex}
          customSecondaryColor={secondaryHex}
        />

        {/* Non-Chat Tool Execution HUD Card */}
        <ToolActionHud
          activeCard={activeActionCard}
          recentActions={recentActions}
          showDrawer={isActionsDrawerOpen}
          onCloseCard={dismissActionCard}
          onCloseDrawer={() => setIsActionsDrawerOpen(false)}
        />

        {/* Confirmation Cards & Multimodal Feed */}
        {(showMultimodalDock ||
          pendingConfirmations.length > 0 ||
          activePlan) && (
          <ConversationFeed
            conversation={showMultimodalDock ? conversation : []}
            pendingConfirmations={pendingConfirmations}
            activePlan={activePlan}
            onResolveConfirmation={resolveConfirmation}
            onStopAll={triggerGlobalStop}
          />
        )}

        {/* Optional Developer Debug Console (hidden by default) */}
        <DebugPanel
          isOpen={settings.debugModeEnabled}
          state={state}
          activeModel={activeModel}
          sessionId={sessionId}
          error={error}
          logs={debugLogs}
          recentActions={recentActions}
          onClearLogs={clearDebugLogs}
          onClose={() => updateSettings({ debugModeEnabled: false })}
        />
      </main>

      {/* Bottom Dock */}
      <footer className="relative z-20 w-full pb-5 pt-2 flex flex-col items-center gap-3">
        {showMultimodalDock ? (
          <CommandBar
            state={state}
            isConnected={isConnected}
            isProcessingCommand={isProcessingCommand}
            customPrimaryColor={primaryHex}
            attachments={attachments}
            onAddAttachment={addAttachment}
            onRemoveAttachment={removeAttachment}
            onSendCommand={(text, speakAloud) =>
              sendCommand(text, 'text', speakAloud)
            }
            onToggleVoice={() => void toggleConnection()}
            onStopAll={triggerGlobalStop}
            onOpenThisPcModal={(tab) => setThisPcModalTab(tab)}
          />
        ) : (
          <ConnectionButton
            isConnected={isConnected}
            isSpeaking={isSpeaking}
            showQuickPrompts={settings.showQuickPrompts}
            customPrimaryColor={primaryHex}
            onInterrupt={interrupt}
            onQuickVoicePrompt={sendVoiceCommand}
          />
        )}
      </footer>

      {/* This PC, Browser Context & Screenshot Picker Modal */}
      <ThisPcModal
        isOpen={thisPcModalTab !== null}
        initialTab={thisPcModalTab || 'this_pc'}
        allowedDirectories={
          backend?.allowedDirectories || [
            'Desktop',
            'Downloads',
            'Documents',
            'Projects',
            'Pictures',
            'Videos',
          ]
        }
        currentWebpage={backend?.currentWebpage}
        onAttach={async (att) => {
          setShowMultimodalDock(true);
          await addAttachment(att);
        }}
        onClose={() => setThisPcModalTab(null)}
      />

      {/* Comprehensive Colors, Persona, Audio & General Settings Slide-Over */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        initialSection={settingsTab}
        state={state}
        settings={settings}
        apiConfiguredOnServer={apiConfiguredOnServer}
        backend={backend}
        onUpdateSettings={updateSettings}
        onUpdateSecuritySettings={updateSecuritySettings}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
