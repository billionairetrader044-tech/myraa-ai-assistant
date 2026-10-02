import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { contextManager, AiraContextState } from '../core/ContextManager';
import { AttachmentPayload, PermissionLevel } from '../types/aira';

export function useAiraContext() {
  const snapshot: AiraContextState = useSyncExternalStore(
    contextManager.subscribe,
    contextManager.getSnapshot
  );

  useEffect(() => {
    void contextManager.refreshBackendState();
  }, []);

  const addAttachment = useCallback(async (att: AttachmentPayload) => {
    await contextManager.addAttachment(att);
  }, []);

  const removeAttachment = useCallback(async (id: string) => {
    await contextManager.removeAttachment(id);
  }, []);

  const clearAttachments = useCallback(async () => {
    await contextManager.clearAttachments();
  }, []);

  const sendCommand = useCallback(
    async (
      text: string,
      modality: 'text' | 'voice' | 'multimodal' = 'text',
      speakAloud = false
    ) => {
      await contextManager.sendCommand(text, modality, speakAloud);
    },
    []
  );

  const resolveConfirmation = useCallback(
    async (confirmationId: string, approved: boolean) => {
      await contextManager.resolveConfirmation(confirmationId, approved);
    },
    []
  );

  const triggerGlobalStop = useCallback(async () => {
    await contextManager.triggerGlobalStop();
  }, []);

  const updateSecuritySettings = useCallback(
    async (payload: {
      permissionOverrides?: Record<string, PermissionLevel>;
      allowedDirectories?: string[];
      autoOrganizeConfirmed?: boolean;
      trustedWhatsappAutoSend?: boolean;
      startWithWindows?: boolean;
      configuredBrowser?: 'chrome' | 'edge' | 'firefox';
    }) => {
      await contextManager.updateSecurityAndAgentSettings(payload);
    },
    []
  );

  const refreshBackendState = useCallback(async () => {
    await contextManager.refreshBackendState();
  }, []);

  return {
    ...snapshot,
    addAttachment,
    removeAttachment,
    clearAttachments,
    sendCommand,
    resolveConfirmation,
    triggerGlobalStop,
    updateSecuritySettings,
    refreshBackendState,
  };
}
