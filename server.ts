import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
  type FunctionDeclaration,
  type FunctionResponse,
} from '@google/genai';
import {
  airaOrchestrator,
  type AttachmentPayload,
} from './server/airaOrchestrator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const FALLBACK_LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
];

function getServerApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'your_gemini_api_key_here') {
    return undefined;
  }
  return key.trim();
}

interface ClientSetupPayload {
  type: 'setup';
  model?: string;
  voiceName?: string;
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
}

interface ClientAudioPayload {
  type: 'audio';
  data: string;
}

interface ClientToolResponsePayload {
  type: 'toolResponse';
  functionResponses: FunctionResponse[];
}

interface ClientTextTurnPayload {
  type: 'clientContent';
  text: string;
  turnComplete?: boolean;
}

interface ClientAudioEndPayload {
  type: 'audioStreamEnd';
}

type ClientWsMessage =
  | ClientSetupPayload
  | ClientAudioPayload
  | ClientToolResponsePayload
  | ClientTextTurnPayload
  | ClientAudioEndPayload;

function safeSend(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const statusHandler: express.RequestHandler = async (_req, res) => {
    const apiKey = getServerApiKey();
    await airaOrchestrator.checkNativeWindowsAgent();
    res.json({
      ok: true,
      version: '3.0.0',
      agent: 'AIRA — Multimodal Windows + Browser AI Agent',
      apiConfigured: Boolean(apiKey),
      configured: Boolean(apiKey),
      primaryModel: PRIMARY_LIVE_MODEL,
      fallbackModels: FALLBACK_LIVE_MODELS,
      audioSpec: {
        inputSampleRate: 16000,
        outputSampleRate: 24000,
        encoding: 'PCM16_LE',
        channels: 1,
      },
      ...airaOrchestrator.getStateSnapshot(),
    });
  };

  // 1. Health & Full Agent Status Snapshot
  app.get('/api/status', statusHandler);
  app.get('/api/config-status', statusHandler);
  app.get('/api/aira/state', statusHandler);

  // 2. Unified Multimodal Command + Attachment + Voice Context Endpoint
  app.post('/api/aira/command', async (req, res) => {
    try {
      const command = typeof req.body?.command === 'string' ? req.body.command : '';
      const attachments = Array.isArray(req.body?.attachments)
        ? (req.body.attachments as AttachmentPayload[])
        : [];
      const result = await airaOrchestrator.processMultimodalCommand(
        command,
        attachments,
        getServerApiKey()
      );
      res.json({
        ok: true,
        ...result,
        snapshot: airaOrchestrator.getStateSnapshot(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to process command',
      });
    }
  });

  // 3. Direct Authorized Tool Execution (used by both Voice Gemini Live tool calls and UI actions)
  app.post('/api/aira/tool', async (req, res) => {
    try {
      const toolName = String(req.body?.tool || '');
      const args = (req.body?.args as Record<string, unknown>) || {};
      const bypass = Boolean(req.body?.bypassConfirmation);
      const outcome = await airaOrchestrator.executeTool(toolName, args, bypass);
      res.json({
        ok: true,
        outcome,
        snapshot: airaOrchestrator.getStateSnapshot(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Tool execution error',
      });
    }
  });

  // 4. Sync Active Attachments with ContextManager
  app.post('/api/aira/context/attachments', (req, res) => {
    const attachments = Array.isArray(req.body?.attachments)
      ? (req.body.attachments as AttachmentPayload[])
      : [];
    airaOrchestrator.setAttachments(attachments);
    res.json({
      ok: true,
      snapshot: airaOrchestrator.getStateSnapshot(),
    });
  });

  // 5. Inspect Safe Directory or Read File ("This PC" & Folder Attachment)
  app.get('/api/aira/fs/inspect', (req, res) => {
    try {
      const dir = typeof req.query.dir === 'string' ? req.query.dir : 'Desktop';
      const overview = airaOrchestrator.inspectDirectory(dir);
      res.json({
        ok: true,
        overview,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Could not inspect directory',
      });
    }
  });

  app.get('/api/aira/fs/read', (req, res) => {
    try {
      const filePath = typeof req.query.path === 'string' ? req.query.path : '';
      const file = airaOrchestrator.readAuthorizedFile(filePath);
      res.json({
        ok: true,
        file,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Could not read file',
      });
    }
  });

  // 6. Browser Webpage Inspection (+ -> Browser Content)
  app.post('/api/aira/browser/inspect', async (req, res) => {
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url : 'https://www.google.com';
      const inspection = await airaOrchestrator.inspectWebpageUrl(url);
      res.json({
        ok: true,
        inspection,
        snapshot: airaOrchestrator.getStateSnapshot(),
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Could not inspect webpage',
      });
    }
  });

  // 7. Confirmation Resolution ([Approve] / [Cancel])
  app.post('/api/aira/confirm', async (req, res) => {
    try {
      const confirmationId = String(req.body?.confirmationId || '');
      const approved = Boolean(req.body?.approved);
      const outcome = await airaOrchestrator.resolveConfirmation(confirmationId, approved);
      res.json({
        ok: true,
        outcome,
        snapshot: airaOrchestrator.getStateSnapshot(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Confirmation error',
      });
    }
  });

  // 8. Global STOP / Cancel Active Operations
  app.post('/api/aira/stop', (_req, res) => {
    const result = airaOrchestrator.stopAllActiveTasks();
    res.json({
      ok: true,
      ...result,
      snapshot: airaOrchestrator.getStateSnapshot(),
    });
  });

  // 9. Update Permissions & Safe Directories
  app.post('/api/aira/settings', (req, res) => {
    airaOrchestrator.updateSettings(req.body || {});
    res.json({
      ok: true,
      snapshot: airaOrchestrator.getStateSnapshot(),
    });
  });

  // 10. Coding Agent & Image-to-Code Endpoints
  app.get('/api/aira/coding/files', (_req, res) => {
    res.json({
      ok: true,
      files: airaOrchestrator.getProjectWorkspaceFiles(),
    });
  });

  app.get('/api/aira/coding/read', (req, res) => {
    try {
      const filePath = typeof req.query.path === 'string' ? req.query.path : 'src/App.tsx';
      const content = airaOrchestrator.readWorkspaceFile(filePath);
      res.json({ ok: true, path: filePath, content });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Could not read workspace file',
      });
    }
  });

  app.post('/api/aira/coding/verify', async (_req, res) => {
    const testResult = await airaOrchestrator.runWorkspaceTests();
    res.json({ ok: true, ...testResult });
  });

  // 11. Download Native Windows Python Companion Agent
  app.get('/api/aira/download-windows-agent', (_req, res) => {
    const agentPath = path.join(__dirname, 'desktop-agent', 'aira_windows_agent.py');
    if (fs.existsSync(agentPath)) {
      res.setHeader('Content-Type', 'text/x-python');
      res.setHeader('Content-Disposition', 'attachment; filename="aira_windows_agent.py"');
      res.send(fs.readFileSync(agentPath, 'utf-8'));
    } else {
      res.status(404).send('# Agent file not found');
    }
  });

  // 12. Web search helper for voice tools
  app.post('/api/search', async (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const engine = typeof req.body?.engine === 'string' ? req.body.engine : 'google';
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }
    const outcome = await airaOrchestrator.executeTool('search_web', { query, engine }, true);
    res.json({
      success: true,
      query,
      engine,
      searchUrl: outcome.urlToOpen || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      summarySnippet: outcome.summary,
    });
  });

  const httpServer = http.createServer(app);

  // Create WebSocket server for Gemini Live bidirectional audio streaming
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(
        request.url || '/',
        `http://${request.headers.host || 'localhost'}`
      );
      if (url.pathname === '/ws/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Session | null = null;
    let isClosing = false;

    const cleanupSession = () => {
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close errors
        }
        liveSession = null;
      }
    };

    const connectToGeminiLive = async (
      setupMsg: ClientSetupPayload,
      candidateModels: string[]
    ) => {
      const apiKey = getServerApiKey();
      if (!apiKey) {
        safeSend(clientWs, {
          type: 'error',
          code: 'API_KEY_MISSING',
          message:
            'Gemini API key is missing for Live Voice. You can still use the Command Box, + Attachments, File/Desktop Organization, and Browser Agent!',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const voiceName = setupMsg.voiceName || 'Kore';
      const systemInstruction =
        setupMsg.systemInstruction ||
        'You are AIRA, an elite multimodal Windows + Browser AI voice agent.';
      const functionDeclarations = setupMsg.tools || [];

      let lastError: unknown = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelToTry = candidateModels[i];
        let setupCompleted = false;

        try {
          safeSend(clientWs, {
            type: 'debugEvent',
            event: 'connecting_upstream',
            detail: `Connecting to Gemini Live model: ${modelToTry} (Voice: ${voiceName})`,
          });

          const session = await ai.live.connect({
            model: modelToTry,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              tools:
                functionDeclarations.length > 0
                  ? [{ functionDeclarations }]
                  : undefined,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
            callbacks: {
              onopen: () => {
                airaOrchestrator.logActivity('Voice', `Gemini Live connected (${modelToTry})`, 'SUCCESS');
                safeSend(clientWs, {
                  type: 'debugEvent',
                  event: 'upstream_socket_open',
                  detail: `Upstream WebSocket opened for ${modelToTry}`,
                });
              },
              onmessage: (message: LiveServerMessage) => {
                if (isClosing) return;

                if (message.setupComplete) {
                  setupCompleted = true;
                  safeSend(clientWs, {
                    type: 'setupComplete',
                    model: modelToTry,
                    sessionId: message.setupComplete.sessionId || null,
                  });
                }

                if (message.serverContent) {
                  const sc = message.serverContent;

                  if (sc.interrupted) {
                    safeSend(clientWs, { type: 'interrupted' });
                  }

                  const parts = sc.modelTurn?.parts;
                  if (parts && Array.isArray(parts)) {
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        safeSend(clientWs, {
                          type: 'audio',
                          data: part.inlineData.data,
                          mimeType:
                            part.inlineData.mimeType || 'audio/pcm;rate=24000',
                        });
                      }
                      if (part.text) {
                        safeSend(clientWs, {
                          type: 'debugText',
                          text: part.text,
                        });
                      }
                    }
                  }

                  if (sc.inputTranscription?.text) {
                    safeSend(clientWs, {
                      type: 'inputTranscription',
                      text: sc.inputTranscription.text,
                      finished: Boolean(sc.inputTranscription.finished),
                    });
                  }

                  if (sc.outputTranscription?.text) {
                    safeSend(clientWs, {
                      type: 'outputTranscription',
                      text: sc.outputTranscription.text,
                      finished: Boolean(sc.outputTranscription.finished),
                    });
                  }

                  if (sc.turnComplete) {
                    safeSend(clientWs, { type: 'turnComplete' });
                  }
                }

                if (
                  message.toolCall?.functionCalls &&
                  message.toolCall.functionCalls.length > 0
                ) {
                  safeSend(clientWs, {
                    type: 'toolCall',
                    functionCalls: message.toolCall.functionCalls,
                  });
                }

                if (message.toolCallCancellation?.ids) {
                  safeSend(clientWs, {
                    type: 'toolCallCancellation',
                    ids: message.toolCallCancellation.ids,
                  });
                }
              },
              onerror: (err: unknown) => {
                if (isClosing) return;
                const errMsg =
                  err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message: unknown }).message)
                      : 'Upstream Gemini Live connection error.';
                safeSend(clientWs, {
                  type: 'error',
                  code: 'UPSTREAM_ERROR',
                  message: errMsg,
                });
              },
              onclose: (closeEvent: { code?: number; reason?: string }) => {
                if (isClosing) return;
                const reason = closeEvent?.reason || '';
                const code = closeEvent?.code || 1000;

                if (!setupCompleted && i < candidateModels.length - 1) {
                  safeSend(clientWs, {
                    type: 'debugEvent',
                    event: 'model_fallback',
                    detail: `Model ${modelToTry} closed during setup (${code} ${reason}). Trying fallback model...`,
                  });
                  return;
                }

                safeSend(clientWs, {
                  type: 'sessionClosed',
                  code,
                  reason:
                    reason ||
                    (code === 1000
                      ? 'Session ended normally.'
                      : `Connection closed (code ${code}).`),
                });
              },
            },
          });

          liveSession = session;
          return;
        } catch (err: unknown) {
          lastError = err;
          const errStr = err instanceof Error ? err.message : String(err);
          safeSend(clientWs, {
            type: 'debugEvent',
            event: 'connect_attempt_failed',
            detail: `Failed connecting to ${modelToTry}: ${errStr}`,
          });
        }
      }

      const finalMessage =
        lastError instanceof Error
          ? lastError.message
          : 'Unable to establish connection with Gemini Live API.';
      safeSend(clientWs, {
        type: 'error',
        code: 'CONNECTION_FAILED',
        message: finalMessage,
      });
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as ClientWsMessage;

        if (msg.type === 'setup') {
          const requestedModel = msg.model || PRIMARY_LIVE_MODEL;
          const candidates = [
            requestedModel,
            ...FALLBACK_LIVE_MODELS.filter((m) => m !== requestedModel),
          ];
          await connectToGeminiLive(msg, candidates);
          return;
        }

        if (!liveSession) {
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'audioStreamEnd') {
          liveSession.sendRealtimeInput({
            audioStreamEnd: true,
          });
        } else if (
          msg.type === 'toolResponse' &&
          Array.isArray(msg.functionResponses)
        ) {
          liveSession.sendToolResponse({
            functionResponses: msg.functionResponses,
          });
        } else if (msg.type === 'clientContent' && msg.text) {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: msg.turnComplete ?? true,
          });
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : 'Failed to process message.';
        safeSend(clientWs, {
          type: 'debugEvent',
          event: 'message_handling_error',
          detail: errMsg,
        });
      }
    });

    clientWs.on('close', () => {
      cleanupSession();
    });

    clientWs.on('error', () => {
      cleanupSession();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AIRA Multimodal Windows + Browser AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
