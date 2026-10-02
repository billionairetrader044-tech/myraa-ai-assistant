import React, { useEffect, useState } from 'react';
import { AttachmentManager } from '../core/AttachmentManager';
import { AttachmentPayload } from '../types/aira';
import { X, Code2, Play, Upload, CheckCircle2, Sparkles } from 'lucide-react';

interface CodingAgentModalProps {
  isOpen: boolean;
  onSendCodingRequest: (prompt: string, attachment?: AttachmentPayload) => Promise<void>;
  onClose: () => void;
}

export const CodingAgentModal: React.FC<CodingAgentModalProps> = ({
  isOpen,
  onSendCodingRequest,
  onClose,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('src/App.tsx');
  const [fileContent, setFileContent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>(
    'Analyze this file and suggest architecture or UI improvements.'
  );
  const [verifyOutput, setVerifyOutput] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [uiScreenshot, setUiScreenshot] = useState<AttachmentPayload | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/aira/coding/files')
      .then((r) => r.json())
      .then((d: { ok: boolean; files?: string[] }) => {
        if (d.ok && d.files) setFiles(d.files);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedFile) return;
    fetch(`/api/aira/coding/read?path=${encodeURIComponent(selectedFile)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; content?: string }) => {
        if (d.ok && typeof d.content === 'string') {
          setFileContent(d.content);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedFile]);

  if (!isOpen) return null;

  const handleRunVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/aira/coding/verify', { method: 'POST' });
      const data = (await res.json()) as { passed: boolean; output: string };
      setVerifyOutput(
        `${data.passed ? '✓ BUILD VERIFICATION PASSED' : '✕ VERIFICATION ISSUES'}:\n${data.output}`
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const att = await AttachmentManager.fromBrowserFile(file, 'image');
    setUiScreenshot(att);
    setPrompt('Build a clean React + Tailwind CSS component matching this UI screenshot.');
  };

  const handleAnalyzeOrBuild = async () => {
    const fileAttachment: AttachmentPayload = uiScreenshot || {
      id: `code-${Date.now()}`,
      kind: 'file',
      name: selectedFile,
      path: selectedFile,
      sizeBytes: fileContent.length,
      textContent: fileContent,
    };
    await onSendCodingRequest(prompt, fileAttachment);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AIRA Coding Agent & Image-to-Code Workspace"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-[#0A0F1D] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100">
                Coding Agent & Image-to-Code Workspace
              </h2>
              <p className="text-xs text-slate-400">
                Authorized Project Analysis · UI Screenshot-to-React · TypeScript Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project File Selector */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Authorized Workspace File
              </label>
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200"
              >
                {files.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Image-to-Code Upload */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Image-to-Code (UI Screenshot)
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-dashed border-cyan-400/40 text-cyan-300 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>
                  {uiScreenshot ? uiScreenshot.name : 'Upload UI Screenshot to Build'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleScreenshotUpload(e)}
                />
              </label>
            </div>
          </div>

          {/* Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono text-slate-400">
                {selectedFile} ({fileContent.length} bytes)
              </span>
              <button
                type="button"
                disabled={verifying}
                onClick={() => void handleRunVerify()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-semibold cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>{verifying ? 'Running tsc...' : 'Run TypeScript Check'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-xl bg-slate-950 border border-white/10 font-mono text-[11px] text-slate-300 max-h-44 overflow-auto">
              {fileContent.slice(0, 3000)}
            </pre>
          </div>

          {verifyOutput && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-400/40 font-mono text-[11px] text-emerald-200 whitespace-pre-wrap">
              <CheckCircle2 className="w-4 h-4 inline mr-1.5 text-emerald-400" />
              {verifyOutput}
            </div>
          )}

          {/* Task Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Coding Agent Task / Image-to-Code Instruction
            </label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-slate-100 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleAnalyzeOrBuild()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Run Coding Agent Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
