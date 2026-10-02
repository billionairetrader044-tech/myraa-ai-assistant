import React, { useEffect, useState } from 'react';
import { AttachmentManager, formatBytes } from '../core/AttachmentManager';
import { AttachmentPayload, FolderOverview, WebpageInspection } from '../types/aira';
import {
  X,
  HardDrive,
  Folder,
  FileText,
  Globe,
  Camera,
  CheckCircle2,
  Search,
  RefreshCw,
} from 'lucide-react';

interface ThisPcModalProps {
  isOpen: boolean;
  initialTab: 'this_pc' | 'browser' | 'screenshot';
  allowedDirectories: string[];
  currentWebpage?: WebpageInspection;
  onAttach: (att: AttachmentPayload) => Promise<void>;
  onClose: () => void;
}

export const ThisPcModal: React.FC<ThisPcModalProps> = ({
  isOpen,
  initialTab,
  allowedDirectories,
  currentWebpage,
  onAttach,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'this_pc' | 'browser' | 'screenshot'>(initialTab);
  const [selectedDir, setSelectedDir] = useState<string>('Desktop');
  const [folderOverview, setFolderOverview] = useState<FolderOverview | null>(null);
  const [loadingDir, setLoadingDir] = useState(false);
  const [urlInput, setUrlInput] = useState(currentWebpage?.url || 'https://www.youtube.com');
  const [inspectedPage, setInspectedPage] = useState<WebpageInspection | null>(currentWebpage || null);
  const [inspectingUrl, setInspectingUrl] = useState(false);
  const [capturingShot, setCapturingShot] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadDirectory = async (dirName: string) => {
    setLoadingDir(true);
    try {
      const res = await fetch(`/api/aira/fs/inspect?dir=${encodeURIComponent(dirName)}`);
      const data = (await res.json()) as { ok: boolean; overview?: FolderOverview };
      if (data.ok && data.overview) {
        setFolderOverview(data.overview);
      }
    } finally {
      setLoadingDir(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'this_pc') {
      void loadDirectory(selectedDir);
    }
  }, [isOpen, activeTab, selectedDir]);

  if (!isOpen) return null;

  const handleAttachCurrentFolder = async () => {
    const att = await AttachmentManager.fromAuthorizedServerFolder(selectedDir);
    await onAttach(att);
    onClose();
  };

  const handleAttachServerFile = async (filePath: string) => {
    const att = await AttachmentManager.fromAuthorizedServerFile(filePath);
    await onAttach(att);
    onClose();
  };

  const handleInspectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setInspectingUrl(true);
    try {
      const att = await AttachmentManager.fromBrowserUrl(urlInput.trim());
      if (att.webpageContext) {
        setInspectedPage(att.webpageContext);
      }
    } finally {
      setInspectingUrl(false);
    }
  };

  const handleAttachWebpage = async () => {
    const targetUrl = inspectedPage?.url || urlInput || 'https://www.google.com';
    const att = await AttachmentManager.fromBrowserUrl(targetUrl);
    await onAttach(att);
    onClose();
  };

  const handleCaptureScreenshot = async (target: 'fullscreen' | 'window' | 'browser') => {
    setCapturingShot(true);
    try {
      const att = await AttachmentManager.captureScreenshot(target);
      await onAttach(att);
      onClose();
    } finally {
      setCapturingShot(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AIRA Multimodal Context Explorer"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#0A0F1D] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header & Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('this_pc')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'this_pc'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>This PC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('browser')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'browser'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Browser Content</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('screenshot')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'screenshot'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Screenshot</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'this_pc' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Left Sidebar: Safe Directories */}
              <div className="space-y-1.5 border-r border-white/10 pr-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Authorized Locations
                </div>
                {allowedDirectories.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setSelectedDir(dir)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                      selectedDir === dir
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{dir}</span>
                  </button>
                ))}
              </div>

              {/* Right Content: Folder Overview & Files */}
              <div className="sm:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      This PC / {selectedDir}
                    </h3>
                    {folderOverview && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        {folderOverview.totalFiles} files · {folderOverview.totalFolders} folders · {formatBytes(folderOverview.totalSizeBytes)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAttachCurrentFolder()}
                    className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    Attach Folder &ldquo;{selectedDir}&rdquo;
                  </button>
                </div>

                {loadingDir ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Inspecting {selectedDir}...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {folderOverview?.files.map((f) => (
                      <div
                        key={f.path}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/[0.07] text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {f.isDirectory ? (
                            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-slate-200 truncate">
                              {f.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {f.category} · {f.isDirectory ? 'Directory' : formatBytes(f.sizeBytes)}
                            </div>
                          </div>
                        </div>

                        {!f.isDirectory && (
                          <button
                            type="button"
                            onClick={() => void handleAttachServerFile(f.path)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-cyan-400 hover:text-slate-950 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                          >
                            Select File
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'browser' && (
            <div className="space-y-4">
              <form onSubmit={(e) => void handleInspectUrl(e)} className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter website URL or site name (e.g., https://www.wikipedia.org, youtube)..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={inspectingUrl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-100 cursor-pointer"
                >
                  {inspectingUrl ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Inspect Page</span>
                </button>
              </form>

              {inspectedPage && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-100">
                        {inspectedPage.title}
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono">
                        {inspectedPage.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAttachWebpage()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Attach Webpage to AIRA</span>
                    </button>
                  </div>

                  <div className="text-slate-300 leading-relaxed text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-white/[0.06]">
                    {inspectedPage.visibleTextSnippet.slice(0, 320)}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                    <span>Headings: {inspectedPage.headings.length}</span>
                    <span>·</span>
                    <span>Buttons: {inspectedPage.buttons.length}</span>
                    <span>·</span>
                    <span>Inputs: {inspectedPage.inputs.length}</span>
                    <span>·</span>
                    <span>Forms: {inspectedPage.formsCount}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'screenshot' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Choose which target AIRA should capture and attach to your active conversation context:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={capturingShot}
                  onClick={() => void handleCaptureScreenshot('fullscreen')}
                  className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-left space-y-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-cyan-400" />
                  <div className="text-xs font-semibold text-slate-100">
                    Full Screen
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Captures entire desktop display & saves to Pictures/
                  </div>
                </button>

                <button
                  type="button"
                  disabled={capturingShot}
                  onClick={() => void handleCaptureScreenshot('window')}
                  className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-left space-y-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-indigo-400" />
                  <div className="text-xs font-semibold text-slate-100">
                    Active Window
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Captures the currently focused application window
                  </div>
                </button>

                <button
                  type="button"
                  disabled={capturingShot}
                  onClick={() => void handleCaptureScreenshot('browser')}
                  className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-left space-y-1.5 transition-colors cursor-pointer"
                >
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <div className="text-xs font-semibold text-slate-100">
                    Browser Viewport
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Captures the current active webpage for UI / error analysis
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
