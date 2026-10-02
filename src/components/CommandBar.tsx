import React, { useEffect, useRef, useState } from 'react';
import { AttachmentManager, formatBytes } from '../core/AttachmentManager';
import { AttachmentPayload } from '../types/aira';
import { AssistantState } from '../types/live';
import {
  Plus,
  Mic,
  MicOff,
  Send,
  Square,
  FileText,
  Folder,
  Image as ImageIcon,
  Camera,
  Globe,
  HardDrive,
  X,
  FileCode,
} from 'lucide-react';

interface CommandBarProps {
  state: AssistantState;
  isConnected: boolean;
  isProcessingCommand: boolean;
  customPrimaryColor?: string;
  attachments: AttachmentPayload[];
  onAddAttachment: (att: AttachmentPayload) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onSendCommand: (text: string, speakAloud: boolean) => Promise<void>;
  onToggleVoice: () => void;
  onStopAll: () => Promise<void>;
  onOpenThisPcModal: (initialTab: 'this_pc' | 'browser' | 'screenshot') => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  state,
  isConnected,
  isProcessingCommand,
  customPrimaryColor = '#f43f5e',
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  onSendCommand,
  onToggleVoice,
  onStopAll,
  onOpenThisPcModal,
}) => {
  const [inputText, setInputText] = useState('');
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [speakRepliesAloud, setSpeakRepliesAloud] = useState(false);

  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Close + menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(e.target as Node)
      ) {
        setIsPlusMenuOpen(false);
      }
    };
    if (isPlusMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPlusMenuOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && attachments.length === 0) return;
    const textToSend = inputText;
    setInputText('');
    await onSendCommand(textToSend, speakRepliesAloud);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    forcedKind?: 'file' | 'image' | 'document'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const att = await AttachmentManager.fromBrowserFile(files[i], forcedKind);
      await onAddAttachment(att);
    }
    e.target.value = '';
    setIsPlusMenuOpen(false);
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const att = await AttachmentManager.fromBrowserFolderFiles(files);
    await onAddAttachment(att);
    e.target.value = '';
    setIsPlusMenuOpen(false);
  };

  const isBusy =
    isProcessingCommand ||
    state === 'speaking' ||
    state === 'thinking' ||
    state === 'executing';

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Hidden native file inputs for + Menu */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFileChange(e, 'file')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFileChange(e, 'image')}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.xml,.doc,.docx,.log,.py,.ts,.tsx,.js,.html,.css"
        multiple
        className="hidden"
        onChange={(e) => void handleFileChange(e, 'document')}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is supported in modern browsers
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => void handleFolderChange(e)}
      />

      {/* Active Attachment Previews Bar (Section 16) */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-md">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-lg bg-slate-950/90 border border-white/10 text-xs"
            >
              {att.dataUrl ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-8 h-8 rounded object-cover border border-white/10 shrink-0"
                />
              ) : att.kind === 'folder' ? (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              ) : att.kind === 'browser' ? (
                <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              ) : att.kind === 'this_pc' ? (
                <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              )}

              <div className="min-w-0 max-w-[180px]">
                <div className="font-medium text-slate-100 truncate">
                  {att.name}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {att.folderOverview
                    ? `${att.folderOverview.totalFiles} files · ${att.folderOverview.totalFolders} folders`
                    : att.webpageContext
                      ? att.webpageContext.url
                      : formatBytes(att.sizeBytes)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onRemoveAttachment(att.id)}
                aria-label={`Remove ${att.name}`}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Command Box Container */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative flex items-center gap-2 p-2 rounded-2xl bg-[#0B101E]/95 border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.55)] focus-within:border-cyan-400/60 transition-colors"
      >
        {/* Prominent [ + ] Attachment Button & Popup Menu */}
        <div ref={plusMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsPlusMenuOpen((prev) => !prev)}
            aria-label="Add attachment or context to AIRA"
            title="Add File, Folder, Image, Screenshot, Browser Content, or This PC"
            className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer ${
              isPlusMenuOpen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-white/[0.06] text-slate-200 border-white/10 hover:bg-white/[0.12] hover:border-cyan-400/40'
            }`}
          >
            <Plus
              className={`w-5 h-5 transition-transform duration-200 ${
                isPlusMenuOpen ? 'rotate-45' : ''
              }`}
            />
          </button>

          {/* Smooth + Attachment Menu (Section 2 & 31) */}
          {isPlusMenuOpen && (
            <div className="absolute bottom-13 left-0 z-50 w-64 rounded-2xl bg-[#0A0F1D] border border-white/15 shadow-2xl p-2 space-y-1 backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/10">
                Add to AIRA Context
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold">File</div>
                  <div className="text-[10px] text-slate-400">
                    Code, JSON, CSV, XML, Logs
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold">Folder</div>
                  <div className="text-[10px] text-slate-400">
                    Upload & analyze folder tree
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />
                <div>
                  <div className="font-semibold">Image</div>
                  <div className="text-[10px] text-slate-400">
                    Photos, UI designs, diagrams
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold">Document</div>
                  <div className="text-[10px] text-slate-400">
                    PDF, TXT, DOCX, Markdown
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenThisPcModal('screenshot');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-semibold">Screenshot</div>
                  <div className="text-[10px] text-slate-400">
                    Capture screen, window, or page
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenThisPcModal('browser');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold">Browser Content</div>
                  <div className="text-[10px] text-slate-400">
                    Current webpage, URL, DOM text
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenThisPcModal('this_pc');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold">This PC</div>
                  <div className="text-[10px] text-slate-400">
                    Browse Desktop, Downloads, Docs
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Command Input Field */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            attachments.length > 0
              ? `Ask AIRA about ${attachments.map((a) => a.name).join(', ')} (e.g., "Explain this", "What is happening here?")...`
              : 'Type a command to AIRA (e.g., "Open Chrome", "Organize my desktop", "Find my PDFs")...'
          }
          className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />

        {/* Optional Speak Replies Toggle for Typed Commands */}
        <button
          type="button"
          onClick={() => setSpeakRepliesAloud((prev) => !prev)}
          title="Toggle spoken voice readout for typed commands"
          className={`hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
            speakRepliesAloud
              ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
              : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          TTS {speakRepliesAloud ? 'ON' : 'OFF'}
        </button>

        {/* [ 🎤 ] Microphone Toggle Button */}
        <button
          type="button"
          onClick={onToggleVoice}
          aria-label={isConnected ? 'Disconnect live microphone' : 'Start live microphone'}
          title={isConnected ? 'Live Voice Active (Click to disconnect)' : 'Start Gemini Live Voice'}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors cursor-pointer ${
            isConnected
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
              : 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.12]'
          }`}
        >
          {isConnected ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        {/* [ STOP ] Button when busy or speaking */}
        {isBusy && (
          <button
            type="button"
            onClick={() => void onStopAll()}
            aria-label="Stop active task or speech"
            className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-rose-500/25 border border-rose-500/60 text-rose-200 text-xs font-semibold hover:bg-rose-500/35 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>STOP</span>
          </button>
        )}

        {/* [ Send ] Button */}
        <button
          type="submit"
          disabled={isProcessingCommand || (!inputText.trim() && attachments.length === 0)}
          aria-label="Send message to Myraa"
          style={{ backgroundColor: customPrimaryColor }}
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl hover:opacity-90 disabled:opacity-40 text-white text-xs font-semibold transition-opacity cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
