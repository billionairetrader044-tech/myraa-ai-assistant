import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { liveSession } from '../live/LiveSession';
import { stateManager, StateSnapshot } from '../state/StateManager';
import { MyraaSettings } from '../types/live';

export function useLiveSession() {
  const snapshot: StateSnapshot = useSyncExternalStore(
    stateManager.subscribe,
    stateManager.getSnapshot
  );

  // Check backend API configuration status once on mount
  useEffect(() => {
    let active = true;
    fetch('/api/status')
      .then((res) => res.json())
      .then((data: { apiConfigured?: boolean }) => {
        if (active && typeof data.apiConfigured === 'boolean') {
          stateManager.setApiConfiguredOnServer(data.apiConfigured);
        }
      })
      .catch(() => {
        if (active) {
          stateManager.setApiConfiguredOnServer(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(async () => {
    await liveSession.connect();
  }, []);

  const disconnect = useCallback(() => {
    liveSession.disconnect(true);
  }, []);

  const toggleConnection = useCallback(async () => {
    const current = stateManager.getSnapshot();
    if (current.isConnected || current.isConnecting) {
      liveSession.disconnect(true);
    } else {
      await liveSession.connect();
    }
  }, []);

  const interrupt = useCallback(() => {
    liveSession.handleInterruption('Manual user barge-in trigger');
  }, []);

  const sendVoiceCommand = useCallback((prompt: string) => {
    liveSession.sendTextPrompt(prompt);
  }, []);

  const updateSettings = useCallback((partial: Partial<MyraaSettings>) => {
    stateManager.updateSettings(partial);
    liveSession.syncSettings();
  }, []);

  const clearError = useCallback(() => {
    stateManager.clearError();
  }, []);

  const dismissActionCard = useCallback(() => {
    stateManager.dismissActionCard();
  }, []);

  const clearDebugLogs = useCallback(() => {
    stateManager.clearDebugLogs();
  }, []);

  return {
    ...snapshot,
    connect,
    disconnect,
    toggleConnection,
    interrupt,
    sendVoiceCommand,
    updateSettings,
    clearError,
    dismissActionCard,
    clearDebugLogs,
  };
}
