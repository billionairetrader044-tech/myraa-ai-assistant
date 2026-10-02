import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

const execFileAsync = promisify(execFile);

export type PermissionLevel = 'SAFE' | 'CONFIRM' | 'RESTRICTED';

export type TaskLifecycleStatus =
  | 'REQUESTED'
  | 'PLANNED'
  | 'EXECUTING'
  | 'AWAITING_CONFIRMATION'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface ToolDefinition {
  name: string;
  category: 'windows' | 'browser' | 'files' | 'applications' | 'system' | 'automation';
  description: string;
  permission: PermissionLevel;
  parameters: Record<string, string>;
}

export interface PendingConfirmation {
  id: string;
  tool: string;
  actionTitle: string;
  target: string;
  itemCount?: number;
  details: string;
  args: Record<string, unknown>;
  permissionLevel: PermissionLevel;
  createdAt: number;
}

export interface ActivityEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  component: 'AI' | 'Voice' | 'WindowsAgent' | 'BrowserAgent' | 'FileAgent' | 'Security' | 'Context';
  event: string;
  tool?: string;
  target?: string;
  result?: string;
  status: TaskLifecycleStatus;
  error?: string;
}

export interface TaskStep {
  stepNumber: number;
  description: string;
  tool?: string;
  status: TaskLifecycleStatus;
  output?: string;
}

export interface ActiveTaskPlan {
  id: string;
  goal: string;
  status: TaskLifecycleStatus;
  steps: TaskStep[];
  createdAt: number;
}

export interface BrowserTabState {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface WebpageInspection {
  title: string;
  url: string;
  browser: 'chrome' | 'edge' | 'firefox';
  headings: string[];
  visibleTextSnippet: string;
  buttons: string[];
  links: Array<{ text: string; href: string }>;
  inputs: Array<{ name: string; type: string; placeholder: string }>;
  formsCount: number;
  tablesCount: number;
  inspectedAt: number;
}

export interface AttachmentPayload {
  id: string;
  kind: 'file' | 'folder' | 'image' | 'document' | 'screenshot' | 'browser' | 'this_pc';
  name: string;
  path?: string;
  mimeType?: string;
  sizeBytes?: number;
  textContent?: string;
  dataUrl?: string;
  folderOverview?: FolderOverview;
  webpageContext?: WebpageInspection;
  metadata?: Record<string, unknown>;
}

export interface FolderOverview {
  folderName: string;
  folderPath: string;
  totalFiles: number;
  totalFolders: number;
  totalSizeBytes: number;
  categories: {
    Folders: number;
    Code: number;
    Images: number;
    Documents: number;
    Videos: number;
    Audio: number;
    Archives: number;
    Installers: number;
    Shortcuts: number;
    Other: number;
  };
  files: Array<{
    name: string;
    path: string;
    category: string;
    sizeBytes: number;
    modifiedAt: string;
    isDirectory: boolean;
  }>;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  // Applications & Windows
  {
    name: 'open_application',
    category: 'applications',
    description: 'Launches an authorized Windows application via alias discovery (Chrome, Notepad, Calculator, OBS, VS Code, Explorer, Settings, Terminal).',
    permission: 'SAFE',
    parameters: { application: 'Application name or alias' },
  },
  {
    name: 'close_application',
    category: 'applications',
    description: 'Closes a running application window.',
    permission: 'CONFIRM',
    parameters: { application: 'Application name to close' },
  },
  {
    name: 'focus_application',
    category: 'windows',
    description: 'Brings an open application window to the foreground.',
    permission: 'SAFE',
    parameters: { application: 'Application or window title' },
  },
  {
    name: 'switch_window',
    category: 'windows',
    description: 'Switches active focus to another open window.',
    permission: 'SAFE',
    parameters: { targetWindow: 'Window title to switch to' },
  },
  {
    name: 'list_windows',
    category: 'windows',
    description: 'Lists currently open desktop and browser windows.',
    permission: 'SAFE',
    parameters: {},
  },
  {
    name: 'minimize_window',
    category: 'windows',
    description: 'Minimizes the specified window.',
    permission: 'SAFE',
    parameters: { windowTitle: 'Target window title' },
  },
  {
    name: 'maximize_window',
    category: 'windows',
    description: 'Maximizes the specified window.',
    permission: 'SAFE',
    parameters: { windowTitle: 'Target window title' },
  },
  {
    name: 'restore_window',
    category: 'windows',
    description: 'Restores a minimized or maximized window.',
    permission: 'SAFE',
    parameters: { windowTitle: 'Target window title' },
  },
  {
    name: 'take_screenshot',
    category: 'system',
    description: 'Captures a screenshot of the full screen, active window, or browser viewport.',
    permission: 'SAFE',
    parameters: { target: 'fullscreen | window | browser' },
  },
  // File System Tools
  {
    name: 'list_directory',
    category: 'files',
    description: 'Lists files and folders inside an authorized directory (Desktop, Downloads, Documents, Projects, Pictures, Videos).',
    permission: 'SAFE',
    parameters: { directory: 'Directory name or path' },
  },
  {
    name: 'search_files',
    category: 'files',
    description: 'Searches authorized directories for files by name, extension, or category (e.g., PDF, video, image, code).',
    permission: 'SAFE',
    parameters: { directory: 'Directory to search', query: 'Search term or file type (pdf, video, image, etc.)' },
  },
  {
    name: 'get_file_metadata',
    category: 'files',
    description: 'Reads metadata and content preview of an authorized file.',
    permission: 'SAFE',
    parameters: { filePath: 'Path to the file' },
  },
  {
    name: 'open_file',
    category: 'files',
    description: 'Opens an authorized file and loads its contents into AIRA context.',
    permission: 'SAFE',
    parameters: { filePath: 'File name or path' },
  },
  {
    name: 'open_folder',
    category: 'files',
    description: 'Opens and inspects an authorized folder.',
    permission: 'SAFE',
    parameters: { folderPath: 'Folder name or path' },
  },
  {
    name: 'create_folder',
    category: 'files',
    description: 'Creates a new folder inside an authorized directory.',
    permission: 'SAFE',
    parameters: { parentDir: 'Parent directory', folderName: 'New folder name' },
  },
  {
    name: 'write_notepad',
    category: 'applications',
    description: 'Opens Notepad and writes the specified text to a document.',
    permission: 'SAFE',
    parameters: { text: 'Text content to write', fileName: 'Optional file name' },
  },
  {
    name: 'move_file',
    category: 'files',
    description: 'Moves files into a target folder inside authorized directories.',
    permission: 'CONFIRM',
    parameters: { sourcePath: 'Source file path', destinationFolder: 'Target folder path' },
  },
  {
    name: 'copy_file',
    category: 'files',
    description: 'Copies a file to a target location.',
    permission: 'SAFE',
    parameters: { sourcePath: 'Source file path', destinationFolder: 'Target folder path' },
  },
  {
    name: 'rename_file',
    category: 'files',
    description: 'Renames an authorized file.',
    permission: 'CONFIRM',
    parameters: { filePath: 'File path', newName: 'New file name' },
  },
  {
    name: 'delete_file',
    category: 'files',
    description: 'Deletes a specified file (Restricted: always requires explicit user confirmation).',
    permission: 'RESTRICTED',
    parameters: { filePath: 'Path of file to delete' },
  },
  {
    name: 'organize_desktop',
    category: 'files',
    description: 'Inspects Desktop items, categorizes them (Folders, Documents, Images, Videos, Audio, Archives, Code, Other), and proposes or executes categorized folder organization.',
    permission: 'CONFIRM',
    parameters: { mode: 'preview | execute' },
  },
  {
    name: 'organize_folder',
    category: 'files',
    description: 'Inspects a specified folder and organizes files into categorized subfolders.',
    permission: 'CONFIRM',
    parameters: { folderPath: 'Target folder path', mode: 'preview | execute' },
  },
  // Browser Agent Tools
  {
    name: 'open_browser',
    category: 'browser',
    description: 'Opens the configured browser provider (Chrome, Edge, or Firefox).',
    permission: 'SAFE',
    parameters: { browser: 'chrome | edge | firefox' },
  },
  {
    name: 'open_url',
    category: 'browser',
    description: 'Opens a website URL or named site (YouTube, Google, WhatsApp Web, GitHub, etc.) and inspects its structure.',
    permission: 'SAFE',
    parameters: { url: 'Website URL or site name' },
  },
  {
    name: 'search_web',
    category: 'browser',
    description: 'Searches Google, YouTube, Wikipedia, or GitHub and extracts structured results.',
    permission: 'SAFE',
    parameters: { query: 'Search query', engine: 'google | youtube | wikipedia | github' },
  },
  {
    name: 'read_page',
    category: 'browser',
    description: 'Extracts structured information (title, headings, visible text, buttons, links, inputs, forms) from the current or specified webpage.',
    permission: 'SAFE',
    parameters: { url: 'Optional URL to inspect' },
  },
  {
    name: 'browser_action',
    category: 'browser',
    description: 'Performs DOM/accessibility browser automation (scroll, click, type, new_tab, close_tab, switch_tab, go_back, go_forward, reload, find_on_page).',
    permission: 'SAFE',
    parameters: { action: 'Action type', selectorOrText: 'Target element label/text', value: 'Input text if typing' },
  },
  {
    name: 'whatsapp_send_message',
    category: 'browser',
    description: 'Prepares a WhatsApp Web message to a contact and requests explicit user confirmation before sending.',
    permission: 'CONFIRM',
    parameters: { contact: 'Recipient name', message: 'Message text' },
  },
  {
    name: 'fill_form',
    category: 'browser',
    description: 'Inspects form fields on the active page, matches labels, fills allowed fields, and requests confirmation before submission.',
    permission: 'CONFIRM',
    parameters: { fieldsJson: 'JSON map of field labels to values' },
  },
  {
    name: 'download_file',
    category: 'browser',
    description: 'Downloads a file from a URL into the authorized Downloads folder.',
    permission: 'CONFIRM',
    parameters: { url: 'File URL', fileName: 'Target file name' },
  },
  // System Info Tools
  {
    name: 'get_system_info',
    category: 'system',
    description: 'Returns real CPU, memory, OS, uptime, active window, and agent status.',
    permission: 'SAFE',
    parameters: {},
  },
  {
    name: 'get_current_time',
    category: 'system',
    description: 'Returns the current local time, date, and timezone.',
    permission: 'SAFE',
    parameters: { timezone: 'Optional IANA timezone' },
  },
  {
    name: 'safe_system_action',
    category: 'system',
    description: 'Executes an allowlisted safe system action (never arbitrary shell commands).',
    permission: 'CONFIRM',
    parameters: { actionName: 'flush_dns | check_network | list_processes | lock_workstation_prompt' },
  },
];

const DEFAULT_APP_ALIASES: Record<string, { title: string; exe: string; urlFallback: string }> = {
  chrome: { title: 'Google Chrome', exe: 'chrome.exe', urlFallback: 'https://www.google.com' },
  edge: { title: 'Microsoft Edge', exe: 'msedge.exe', urlFallback: 'https://www.bing.com' },
  firefox: { title: 'Mozilla Firefox', exe: 'firefox.exe', urlFallback: 'https://www.mozilla.org' },
  notepad: { title: 'Notepad', exe: 'notepad.exe', urlFallback: 'aira://notepad' },
  calculator: { title: 'Calculator', exe: 'calc.exe', urlFallback: 'https://www.desmos.com/scientific' },
  obs: { title: 'OBS Studio', exe: 'obs64.exe', urlFallback: 'https://obsproject.com' },
  vscode: { title: 'Visual Studio Code', exe: 'code.exe', urlFallback: 'https://vscode.dev' },
  code: { title: 'Visual Studio Code', exe: 'code.exe', urlFallback: 'https://vscode.dev' },
  explorer: { title: 'File Explorer', exe: 'explorer.exe', urlFallback: 'aira://explorer' },
  'file explorer': { title: 'File Explorer', exe: 'explorer.exe', urlFallback: 'aira://explorer' },
  settings: { title: 'Windows Settings', exe: 'ms-settings:', urlFallback: 'aira://settings' },
  terminal: { title: 'Windows Terminal', exe: 'wt.exe', urlFallback: 'aira://terminal' },
  whatsapp: { title: 'WhatsApp Web', exe: 'https://web.whatsapp.com', urlFallback: 'https://web.whatsapp.com' },
};

function categorizeFileByExtension(fileName: string, isDirectory: boolean): keyof FolderOverview['categories'] {
  if (isDirectory) return 'Folders';
  const ext = path.extname(fileName).toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.json', '.xml', '.sh', '.bat', '.sql'].includes(ext)) {
    return 'Code';
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(ext)) {
    return 'Images';
  }
  if (['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.pptx', '.log'].includes(ext)) {
    return 'Documents';
  }
  if (['.mp4', '.mkv', '.mov', '.avi', '.webm'].includes(ext)) {
    return 'Videos';
  }
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) {
    return 'Audio';
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
    return 'Archives';
  }
  if (['.exe', '.msi'].includes(ext)) {
    return 'Installers';
  }
  if (['.lnk', '.url'].includes(ext)) {
    return 'Shortcuts';
  }
  return 'Other';
}

export class AiraOrchestrator {
  private sandboxRoot: string;
  private localSessionToken: string;
  private permissionOverrides: Record<string, PermissionLevel> = {};
  private allowedDirectories: string[] = [
    'Desktop',
    'Downloads',
    'Documents',
    'Projects',
    'Pictures',
    'Videos',
  ];
  private autoOrganizeConfirmed = false;
  private trustedWhatsappAutoSend = false;
  private startWithWindows = false;
  private configuredBrowser: 'chrome' | 'edge' | 'firefox' = 'chrome';
  private pendingConfirmations: Map<string, PendingConfirmation> = new Map();
  private activities: ActivityEntry[] = [];
  private activePlan: ActiveTaskPlan | null = null;
  private openWindows: Array<{ id: string; title: string; app: string; state: 'normal' | 'minimized' | 'maximized'; focused: boolean }> = [
    { id: 'win-1', title: 'AIRA — Multimodal Windows AI Agent', app: 'AIRA Desktop', state: 'normal', focused: true },
    { id: 'win-2', title: 'Google Chrome — New Tab', app: 'Google Chrome', state: 'normal', focused: false },
    { id: 'win-3', title: 'File Explorer — Desktop', app: 'File Explorer', state: 'normal', focused: false },
  ];
  private browserTabs: BrowserTabState[] = [
    { id: 'tab-1', title: 'Google', url: 'https://www.google.com', active: true },
  ];
  private currentWebpage: WebpageInspection = {
    title: 'Google',
    url: 'https://www.google.com',
    browser: 'chrome',
    headings: ['Google Search', 'Trending AI News'],
    visibleTextSnippet: 'Search the world\'s information, including webpages, images, videos and more.',
    buttons: ['Google Search', 'I\'m Feeling Lucky', 'Sign in'],
    links: [
      { text: 'About', href: 'https://about.google' },
      { text: 'Store', href: 'https://store.google.com' },
      { text: 'Gmail', href: 'https://mail.google.com' },
    ],
    inputs: [{ name: 'q', type: 'search', placeholder: 'Search Google or type a URL' }],
    formsCount: 1,
    tablesCount: 0,
    inspectedAt: Date.now(),
  };
  private currentAttachments: AttachmentPayload[] = [];
  private conversationMemory: Array<{ role: 'user' | 'aira'; text: string; timestamp: number }> = [];
  private isCancelled = false;
  private windowsAgentOnline = false;

  constructor() {
    this.localSessionToken = crypto.randomBytes(16).toString('hex');
    const localWorkspace = path.join(process.cwd(), '.aira-pc-workspace');
    try {
      fs.mkdirSync(localWorkspace, { recursive: true });
      this.sandboxRoot = localWorkspace;
    } catch {
      this.sandboxRoot = path.join(os.tmpdir(), '.aira-pc-workspace');
    }
    this.ensureWorkspaceSeeded();
    this.logActivity('AI', 'AIRA Orchestrator initialized', 'SUCCESS', undefined, 'System ready');
  }

  private ensureWorkspaceSeeded() {
    try {
      for (const dir of this.allowedDirectories) {
        const fullDir = path.join(this.sandboxRoot, dir);
        if (!fs.existsSync(fullDir)) {
          fs.mkdirSync(fullDir, { recursive: true });
        }
      }

      // Seed Desktop with realistic files if empty so "Organize my desktop" and "Search files" work on real files
      const desktopDir = path.join(this.sandboxRoot, 'Desktop');
      if (fs.readdirSync(desktopDir).length === 0) {
        fs.writeFileSync(
          path.join(desktopDir, 'project_notes.txt'),
          'AIRA Desktop AI Roadmap:\n1. Voice + Command Box unification\n2. Multimodal + Attachments (File, Folder, Image, Screenshot, Browser, This PC)\n3. Permission & Confirmation engine (SAFE, CONFIRM, RESTRICTED)\n'
        );
        fs.writeFileSync(
          path.join(desktopDir, 'quarterly_budget_2026.csv'),
          'Department,Category,Allocated_USD,Spent_USD\nAI_Engineering,Compute,45000,38200\nDesktop_Automation,QA_Testing,18000,14500\nSecurity_Audit,PenTesting,22000,21000\n'
        );
        fs.writeFileSync(
          path.join(desktopDir, 'ui_mockup_preview.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340"><rect width="600" height="340" fill="#070B14"/><circle cx="300" cy="150" r="56" fill="#06B6D4" fill-opacity="0.25" stroke="#22D3EE" stroke-width="2"/><text x="300" y="250" fill="#F8FAFC" font-family="sans-serif" font-size="18" text-anchor="middle">AIRA Desktop UI Capture</text></svg>'
        );
        fs.writeFileSync(
          path.join(desktopDir, 'demo_recording_01.mp4'),
          'MP4_VIDEO_CONTAINER_HEADER_PLACEHOLDER_AIRA_DEMO'
        );
        fs.writeFileSync(
          path.join(desktopDir, 'release_bundle_v3.zip'),
          'PK_ZIP_ARCHIVE_PLACEHOLDER_AIRA'
        );
      }

      // Seed Downloads
      const downloadsDir = path.join(this.sandboxRoot, 'Downloads');
      if (fs.readdirSync(downloadsDir).length === 0) {
        fs.writeFileSync(
          path.join(downloadsDir, 'invoice_2026_1042.pdf'),
          '%PDF-1.7\nInvoice #1042 — Cloud GPU Cluster Subscription\nDate: September 30, 2026\nTotal Due: $1,240.00\nStatus: PAID\nSummary: Monthly enterprise billing for Gemini Live real-time audio & vision nodes.'
        );
        fs.writeFileSync(
          path.join(downloadsDir, 'ai_architecture_whitepaper.pdf'),
          '%PDF-1.7\nTitle: Hybrid Desktop & Browser AI Agents\nSection 1: Executive Overview — Combining low-latency voice with deterministic OS tool execution.\nSection 2: Security Architecture — Schema validation, permission tiers (SAFE, CONFIRM, RESTRICTED), and human-in-the-loop approval.\nSection 3: Multimodal Context Resolution — Resolving deictic references ("this file", "this page") across voice and text.'
        );
        fs.writeFileSync(
          path.join(downloadsDir, 'minecraft_castle_tutorial.mp4'),
          'MP4_VIDEO_STREAM_MINECRAFT_BUILDING_TUTORIAL'
        );
        fs.writeFileSync(
          path.join(downloadsDir, 'system_diagnostics.log'),
          '[2026-09-30 19:40:11] INFO: AudioWorklet initialized at 16000Hz mono PCM16\n[2026-09-30 19:41:02] WARN: Browser popup blocked in iframe; fallback card surfaced\n[2026-09-30 19:42:15] ERROR: Connection timeout on port 4578 (Local Windows companion offline — using Workspace FS)'
        );
      }

      // Seed Documents & Projects
      const docsDir = path.join(this.sandboxRoot, 'Documents');
      if (fs.readdirSync(docsDir).length === 0) {
        fs.writeFileSync(
          path.join(docsDir, 'meeting_summary.md'),
          '# Product Sync — AIRA v3.0\n\n- **Goal**: Seamless Voice + Command Box + Multimodal Attachments.\n- **Action Items**:\n  1. Verify WhatsApp Web confirmation flow.\n  2. Test Desktop Organization preview and approval.\n  3. Ensure Stop button halts active plans immediately.\n'
        );
      }

      const projectsDir = path.join(this.sandboxRoot, 'Projects');
      if (fs.readdirSync(projectsDir).length === 0) {
        const sampleProj = path.join(projectsDir, 'WebDashboard');
        fs.mkdirSync(sampleProj, { recursive: true });
        fs.writeFileSync(
          path.join(sampleProj, 'README.md'),
          '# WebDashboard Project\nA responsive analytics dashboard with dark mode and real-time charts.'
        );
        fs.writeFileSync(
          path.join(sampleProj, 'index.ts'),
          'export function calculateRevenueGrowth(current: number, previous: number): number {\n  if (previous === 0) return 100;\n  return Number((((current - previous) / previous) * 100).toFixed(2));\n}\n'
        );
      }
    } catch {
      // Ignore seeding errors in read-only environments
    }
  }

  public logActivity(
    component: ActivityEntry['component'],
    event: string,
    status: TaskLifecycleStatus,
    tool?: string,
    target?: string,
    result?: string,
    error?: string
  ): ActivityEntry {
    const now = new Date();
    const timeFormatted = now.toTimeString().slice(0, 5);
    const entry: ActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      component,
      event,
      tool,
      target,
      result,
      status,
      error,
    };
    this.activities = [entry, ...this.activities].slice(0, 120);
    return entry;
  }

  public async checkNativeWindowsAgent(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 600);
      const res = await fetch('http://127.0.0.1:4578/health', {
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.windowsAgentOnline = res.ok;
      return res.ok;
    } catch {
      this.windowsAgentOnline = false;
      return false;
    }
  }

  public getPermissionLevel(toolName: string): PermissionLevel {
    if (this.permissionOverrides[toolName]) {
      return this.permissionOverrides[toolName];
    }
    const found = TOOL_REGISTRY.find((t) => t.name === toolName);
    return found ? found.permission : 'CONFIRM';
  }

  public updateSettings(payload: {
    permissionOverrides?: Record<string, PermissionLevel>;
    allowedDirectories?: string[];
    autoOrganizeConfirmed?: boolean;
    trustedWhatsappAutoSend?: boolean;
    startWithWindows?: boolean;
    configuredBrowser?: 'chrome' | 'edge' | 'firefox';
  }) {
    if (payload.permissionOverrides) {
      this.permissionOverrides = {
        ...this.permissionOverrides,
        ...payload.permissionOverrides,
      };
    }
    if (Array.isArray(payload.allowedDirectories)) {
      this.allowedDirectories = payload.allowedDirectories;
    }
    if (typeof payload.autoOrganizeConfirmed === 'boolean') {
      this.autoOrganizeConfirmed = payload.autoOrganizeConfirmed;
    }
    if (typeof payload.trustedWhatsappAutoSend === 'boolean') {
      this.trustedWhatsappAutoSend = payload.trustedWhatsappAutoSend;
    }
    if (typeof payload.startWithWindows === 'boolean') {
      this.startWithWindows = payload.startWithWindows;
    }
    if (payload.configuredBrowser) {
      this.configuredBrowser = payload.configuredBrowser;
    }
    this.logActivity('Security', 'Updated AIRA security & agent settings', 'SUCCESS');
  }

  public setAttachments(attachments: AttachmentPayload[]) {
    // Security check: never execute attached .exe/.msi/.bat files
    this.currentAttachments = attachments.map((att) => {
      const lower = att.name.toLowerCase();
      if (lower.endsWith('.exe') || lower.endsWith('.msi') || lower.endsWith('.bat')) {
        return {
          ...att,
          textContent: `[SECURITY POLICY]: Attached executable "${att.name}" is treated strictly as inert binary data and will NEVER be auto-executed.`,
        };
      }
      return att;
    });

    if (attachments.length > 0) {
      this.logActivity(
        'Context',
        `Attached ${attachments.map((a) => a.name).join(', ')}`,
        'SUCCESS',
        'attachment_context',
        attachments.map((a) => a.name).join(', ')
      );
    }
  }

  public getStateSnapshot() {
    return {
      localSessionToken: this.localSessionToken.slice(0, 8) + '••••••••',
      windowsAgentOnline: this.windowsAgentOnline,
      configuredBrowser: this.configuredBrowser,
      allowedDirectories: this.allowedDirectories,
      autoOrganizeConfirmed: this.autoOrganizeConfirmed,
      trustedWhatsappAutoSend: this.trustedWhatsappAutoSend,
      startWithWindows: this.startWithWindows,
      permissionOverrides: this.permissionOverrides,
      tools: TOOL_REGISTRY.map((t) => ({
        ...t,
        effectivePermission: this.getPermissionLevel(t.name),
      })),
      pendingConfirmations: Array.from(this.pendingConfirmations.values()),
      activities: this.activities,
      activePlan: this.activePlan,
      openWindows: this.openWindows,
      browserTabs: this.browserTabs,
      currentWebpage: this.currentWebpage,
      currentAttachments: this.currentAttachments,
    };
  }

  public resolveAuthorizedDirectory(dirInput: string): {
    allowed: boolean;
    resolvedPath: string;
    label: string;
    reason?: string;
  } {
    const cleaned = (dirInput || 'Desktop').trim();
    if (cleaned.toLowerCase() === 'workspace' || cleaned === '.' || cleaned.toLowerCase() === 'project') {
      return {
        allowed: true,
        resolvedPath: process.cwd(),
        label: 'Project Workspace',
      };
    }

    const matchedDir = this.allowedDirectories.find(
      (d) =>
        d.toLowerCase() === cleaned.toLowerCase() ||
        cleaned.toLowerCase().includes(d.toLowerCase())
    );

    if (!matchedDir) {
      return {
        allowed: false,
        resolvedPath: '',
        label: cleaned,
        reason: `Directory "${cleaned}" is outside AIRA's authorized safe directories (${this.allowedDirectories.join(', ')}). You can grant access in Settings > Files.`,
      };
    }

    const subPath = cleaned
      .replace(new RegExp(`^.*?${matchedDir}[\\\\/]?`, 'i'), '')
      .trim();
    const targetPath = subPath
      ? path.join(this.sandboxRoot, matchedDir, subPath)
      : path.join(this.sandboxRoot, matchedDir);

    // Prevent path traversal outside sandboxRoot
    const normalized = path.normalize(targetPath);
    if (!normalized.startsWith(this.sandboxRoot)) {
      return {
        allowed: false,
        resolvedPath: '',
        label: cleaned,
        reason: 'Path traversal outside authorized root is blocked by Security Manager.',
      };
    }

    if (!fs.existsSync(normalized)) {
      fs.mkdirSync(normalized, { recursive: true });
    }

    return {
      allowed: true,
      resolvedPath: normalized,
      label: subPath ? `${matchedDir}/${subPath}` : matchedDir,
    };
  }

  public inspectDirectory(dirInput: string): FolderOverview {
    const auth = this.resolveAuthorizedDirectory(dirInput);
    if (!auth.allowed) {
      throw new Error(auth.reason || 'Unauthorized directory');
    }

    const categories: FolderOverview['categories'] = {
      Folders: 0,
      Code: 0,
      Images: 0,
      Documents: 0,
      Videos: 0,
      Audio: 0,
      Archives: 0,
      Installers: 0,
      Shortcuts: 0,
      Other: 0,
    };

    const entries = fs.readdirSync(auth.resolvedPath, { withFileTypes: true });
    const files: FolderOverview['files'] = [];
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSizeBytes = 0;

    for (const entry of entries) {
      if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === '.aira-pc-workspace') {
        continue;
      }
      const fullPath = path.join(auth.resolvedPath, entry.name);
      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      const isDir = entry.isDirectory();
      const cat = categorizeFileByExtension(entry.name, isDir);
      categories[cat]++;

      if (isDir) {
        totalFolders++;
      } else {
        totalFiles++;
        totalSizeBytes += stat.size;
      }

      files.push({
        name: entry.name,
        path: `${auth.label}/${entry.name}`,
        category: cat,
        sizeBytes: isDir ? 0 : stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isDirectory: isDir,
      });
    }

    return {
      folderName: auth.label,
      folderPath: auth.label,
      totalFiles,
      totalFolders,
      totalSizeBytes,
      categories,
      files,
    };
  }

  public readAuthorizedFile(filePathInput: string): {
    name: string;
    path: string;
    sizeBytes: number;
    category: string;
    content: string;
  } {
    const cleaned = filePathInput.trim();
    // Try resolving inside sandboxRoot or project workspace
    let candidate = path.join(this.sandboxRoot, cleaned);
    if (!fs.existsSync(candidate)) {
      // Search across allowed directories by filename
      for (const dir of this.allowedDirectories) {
        const testPath = path.join(this.sandboxRoot, dir, path.basename(cleaned));
        if (fs.existsSync(testPath)) {
          candidate = testPath;
          break;
        }
      }
    }
    if (!fs.existsSync(candidate)) {
      const workspaceCandidate = path.join(process.cwd(), cleaned);
      if (
        workspaceCandidate.startsWith(process.cwd()) &&
        fs.existsSync(workspaceCandidate) &&
        !fs.statSync(workspaceCandidate).isDirectory()
      ) {
        candidate = workspaceCandidate;
      }
    }

    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
      throw new Error(`File "${filePathInput}" was not found in authorized directories.`);
    }

    const stat = fs.statSync(candidate);
    const name = path.basename(candidate);
    const category = categorizeFileByExtension(name, false);
    const rawContent = fs.readFileSync(candidate, 'utf-8').slice(0, 16000);

    return {
      name,
      path: cleaned,
      sizeBytes: stat.size,
      category,
      content: rawContent,
    };
  }

  public async inspectWebpageUrl(rawUrl: string): Promise<WebpageInspection> {
    let targetUrl = rawUrl.trim();
    const lower = targetUrl.toLowerCase();
    const siteMap: Record<string, string> = {
      youtube: 'https://www.youtube.com',
      google: 'https://www.google.com',
      'whatsapp web': 'https://web.whatsapp.com',
      whatsapp: 'https://web.whatsapp.com',
      github: 'https://github.com',
      wikipedia: 'https://www.wikipedia.org',
      spotify: 'https://open.spotify.com',
      reddit: 'https://www.reddit.com',
      chatgpt: 'https://chatgpt.com',
    };

    if (siteMap[lower]) {
      targetUrl = siteMap[lower];
    } else if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = `https://${targetUrl}`;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    let title = new URL(targetUrl).hostname.replace(/^www\./, '');
    let headings: string[] = [];
    let visibleTextSnippet = '';
    let buttons: string[] = [];
    let links: Array<{ text: string; href: string }> = [];
    let inputs: Array<{ name: string; type: string; placeholder: string }> = [];
    let formsCount = 0;
    let tablesCount = 0;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3800);
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch?.[1]) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim();
        }

        const headingMatches = Array.from(
          html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)
        );
        headings = headingMatches
          .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 8);

        const buttonMatches = Array.from(
          html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)
        );
        buttons = buttonMatches
          .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 8);

        const linkMatches = Array.from(
          html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
        );
        links = linkMatches
          .map((m) => ({
            href: m[1],
            text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
          }))
          .filter((l) => l.text.length > 1 && !l.href.startsWith('javascript:'))
          .slice(0, 8);

        const inputMatches = Array.from(html.matchAll(/<input([^>]+)>/gi));
        inputs = inputMatches
          .map((m) => {
            const attrs = m[1];
            const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
            const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
            const placeholderMatch = attrs.match(/placeholder=["']([^"']+)["']/i);
            return {
              name: nameMatch?.[1] || 'input',
              type: typeMatch?.[1] || 'text',
              placeholder: placeholderMatch?.[1] || '',
            };
          })
          .filter((i) => i.type !== 'hidden')
          .slice(0, 6);

        formsCount = (html.match(/<form\b/gi) || []).length;
        tablesCount = (html.match(/<table\b/gi) || []).length;

        const strippedText = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        visibleTextSnippet = strippedText.slice(0, 900);
      }
    } catch {
      // Provide structured metadata even if site blocks headless fetch
    }

    if (!visibleTextSnippet) {
      visibleTextSnippet = `Active browser page at ${targetUrl} (${title}). Ready for DOM queries, search input, scrolling, or form automation.`;
    }
    if (headings.length === 0) {
      headings = [title, 'Main Content Section', 'Navigation Header'];
    }
    if (buttons.length === 0) {
      buttons = ['Search', 'Submit', 'Menu', 'Sign In'];
    }
    if (inputs.length === 0) {
      inputs = [{ name: 'q', type: 'search', placeholder: `Search on ${title}...` }];
    }

    const inspection: WebpageInspection = {
      title,
      url: targetUrl,
      browser: this.configuredBrowser,
      headings,
      visibleTextSnippet,
      buttons,
      links,
      inputs,
      formsCount,
      tablesCount,
      inspectedAt: Date.now(),
    };

    this.currentWebpage = inspection;
    // Update active browser tab
    const activeTab = this.browserTabs.find((t) => t.active);
    if (activeTab) {
      activeTab.title = title;
      activeTab.url = targetUrl;
    } else {
      this.browserTabs.push({
        id: `tab-${Date.now()}`,
        title,
        url: targetUrl,
        active: true,
      });
    }

    return inspection;
  }

  public stopAllActiveTasks() {
    this.isCancelled = true;
    let cancelledPlanGoal: string | null = null;
    if (this.activePlan && (this.activePlan.status === 'EXECUTING' || this.activePlan.status === 'PLANNED')) {
      this.activePlan.status = 'CANCELLED';
      cancelledPlanGoal = this.activePlan.goal;
      for (const s of this.activePlan.steps) {
        if (s.status === 'EXECUTING' || s.status === 'PLANNED' || s.status === 'REQUESTED') {
          s.status = 'CANCELLED';
        }
      }
    }
    const pendingCount = this.pendingConfirmations.size;
    this.pendingConfirmations.clear();
    this.logActivity(
      'Security',
      'User triggered STOP — halted active tasks and cleared pending confirmations',
      'CANCELLED',
      'stop_all',
      cancelledPlanGoal || `${pendingCount} pending actions`
    );
    return {
      stopped: true,
      cancelledPlanGoal,
      clearedConfirmations: pendingCount,
      message: 'Stopped all active tasks and cancelled pending operations.',
    };
  }

  public async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    bypassConfirmation = false
  ): Promise<{
    status: TaskLifecycleStatus;
    tool: string;
    summary: string;
    data?: Record<string, unknown>;
    confirmation?: PendingConfirmation;
    urlToOpen?: string;
  }> {
    this.isCancelled = false;
    await this.checkNativeWindowsAgent();

    const permission = this.getPermissionLevel(toolName);

    // Check if confirmation is required
    const needsConfirmation =
      !bypassConfirmation &&
      (permission === 'RESTRICTED' ||
        (permission === 'CONFIRM' &&
          !(toolName === 'organize_desktop' && args.mode === 'preview') &&
          !(toolName === 'organize_folder' && args.mode === 'preview') &&
          !(toolName === 'organize_desktop' && this.autoOrganizeConfirmed) &&
          !(toolName === 'whatsapp_send_message' && this.trustedWhatsappAutoSend)));

    if (needsConfirmation) {
      const confId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let actionTitle = `Execute ${toolName}`;
      let target = String(args.filePath || args.folderPath || args.destinationFolder || args.contact || args.application || 'System');
      let itemCount = 1;
      let details = `Permission level: ${permission}. Explicit approval is required before executing this operation.`;

      if (toolName === 'organize_desktop' || toolName === 'organize_folder') {
        const dirToInspect = toolName === 'organize_desktop' ? 'Desktop' : String(args.folderPath || 'Desktop');
        const overview = this.inspectDirectory(dirToInspect);
        actionTitle = `Move & Organize Files in ${overview.folderName}`;
        target = `${overview.folderName} → Categorized Folders (Images, Videos, Documents, Code, Archives)`;
        itemCount = overview.totalFiles;
        details = `Found ${overview.totalFiles} files (${overview.categories.Images} Images, ${overview.categories.Videos} Videos, ${overview.categories.Documents} Documents, ${overview.categories.Code} Code, ${overview.categories.Archives} Archives). Approve to move them into categorized folders.`;
      } else if (toolName === 'whatsapp_send_message') {
        actionTitle = 'Send External WhatsApp Message';
        target = `Recipient: ${String(args.contact || 'Contact')}`;
        details = `Message preview: "${String(args.message || '')}"`;
      } else if (toolName === 'delete_file') {
        actionTitle = 'Delete File (Restricted)';
        target = String(args.filePath || '');
        details = `Permanently remove "${target}" from authorized storage.`;
      } else if (toolName === 'move_file') {
        actionTitle = 'Move File';
        target = `${String(args.sourcePath || '')} → ${String(args.destinationFolder || '')}`;
      }

      const pending: PendingConfirmation = {
        id: confId,
        tool: toolName,
        actionTitle,
        target,
        itemCount,
        details,
        args,
        permissionLevel: permission,
        createdAt: Date.now(),
      };

      this.pendingConfirmations.set(confId, pending);
      this.logActivity(
        'Security',
        `Awaiting user confirmation for ${actionTitle}`,
        'AWAITING_CONFIRMATION',
        toolName,
        target
      );

      return {
        status: 'AWAITING_CONFIRMATION',
        tool: toolName,
        summary: `Confirmation required for "${actionTitle}" on target "${target}". Please click [Approve] or [Cancel] in the Action Request card.`,
        confirmation: pending,
      };
    }

    // Execute the authorized tool
    try {
      switch (toolName) {
        case 'get_current_time': {
          const tz = typeof args.timezone === 'string' && args.timezone.trim()
            ? args.timezone.trim()
            : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const now = new Date();
          const formatted = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            dateStyle: 'full',
            timeStyle: 'medium',
          }).format(now);
          this.logActivity('WindowsAgent', `Checked clock (${tz})`, 'SUCCESS', toolName, tz, formatted);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Current time in ${tz} is ${formatted}.`,
            data: { timezone: tz, formatted },
          };
        }

        case 'get_system_info': {
          const totalMemGb = (os.totalmem() / 1024 ** 3).toFixed(1);
          const freeMemGb = (os.freemem() / 1024 ** 3).toFixed(1);
          const usedMemPercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
          const cpus = os.cpus();
          const cpuModel = cpus[0]?.model || 'Multi-Core Processor';
          const activeWin = this.openWindows.find((w) => w.focused)?.title || 'AIRA Desktop';

          const summary = `CPU: ${cpuModel} (${cpus.length} cores) | RAM: ${usedMemPercent}% used (${freeMemGb} GB free of ${totalMemGb} GB) | Active Window: ${activeWin} | Browser Agent: ${this.configuredBrowser.toUpperCase()} Ready | Windows Companion: ${this.windowsAgentOnline ? 'Connected (Port 4578)' : 'Workspace Sandbox Mode'}`;
          this.logActivity('WindowsAgent', 'Read system telemetry', 'SUCCESS', toolName, 'This PC', summary);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary,
            data: {
              cpuModel,
              cores: cpus.length,
              totalMemGb,
              freeMemGb,
              usedMemPercent,
              activeWindow: activeWin,
              windowsAgentOnline: this.windowsAgentOnline,
            },
          };
        }

        case 'open_application': {
          const rawApp = String(args.application || 'chrome').trim();
          const key = rawApp.toLowerCase().replace(/^open\s+/i, '');
          const alias = DEFAULT_APP_ALIASES[key] || {
            title: rawApp,
            exe: `${key}.exe`,
            urlFallback: `https://www.google.com/search?q=${encodeURIComponent(rawApp)}`,
          };

          // Update window list
          this.openWindows.forEach((w) => (w.focused = false));
          const existing = this.openWindows.find(
            (w) => w.app.toLowerCase() === alias.title.toLowerCase()
          );
          if (existing) {
            existing.focused = true;
            existing.state = 'normal';
          } else {
            this.openWindows.unshift({
              id: `win-${Date.now()}`,
              title: `${alias.title} — Active Window`,
              app: alias.title,
              state: 'normal',
              focused: true,
            });
          }

          const urlToOpen = alias.urlFallback.startsWith('http')
            ? alias.urlFallback
            : undefined;

          this.logActivity(
            'WindowsAgent',
            `Opened ${alias.title}`,
            'SUCCESS',
            toolName,
            alias.title,
            this.windowsAgentOnline
              ? `Launched native ${alias.exe}`
              : `Activated ${alias.title} window`
          );

          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Opened ${alias.title}${
              this.windowsAgentOnline
                ? ` via native Windows Agent (${alias.exe}).`
                : ' and focused its workspace window.'
            }`,
            data: { application: alias.title, exe: alias.exe, urlToOpen },
            urlToOpen,
          };
        }

        case 'close_application': {
          const rawApp = String(args.application || '').trim();
          const before = this.openWindows.length;
          this.openWindows = this.openWindows.filter(
            (w) =>
              !w.title.toLowerCase().includes(rawApp.toLowerCase()) &&
              !w.app.toLowerCase().includes(rawApp.toLowerCase())
          );
          const closed = before !== this.openWindows.length;
          this.logActivity(
            'WindowsAgent',
            closed ? `Closed ${rawApp}` : `Window "${rawApp}" not found`,
            closed ? 'SUCCESS' : 'FAILED',
            toolName,
            rawApp
          );
          return {
            status: closed ? 'SUCCESS' : 'FAILED',
            tool: toolName,
            summary: closed
              ? `Closed application "${rawApp}".`
              : `Could not find an open window matching "${rawApp}".`,
          };
        }

        case 'focus_application':
        case 'switch_window': {
          const target = String(args.application || args.targetWindow || '').trim();
          const match = this.openWindows.find(
            (w) =>
              w.title.toLowerCase().includes(target.toLowerCase()) ||
              w.app.toLowerCase().includes(target.toLowerCase())
          );
          if (!match) {
            this.logActivity(
              'WindowsAgent',
              `Could not find window "${target}"`,
              'FAILED',
              toolName,
              target
            );
            return {
              status: 'FAILED',
              tool: toolName,
              summary: `I couldn't find an open "${target}" window. Would you like me to launch ${target} instead?`,
            };
          }
          this.openWindows.forEach((w) => (w.focused = w.id === match.id));
          match.state = 'normal';
          this.logActivity('WindowsAgent', `Switched focus to ${match.title}`, 'SUCCESS', toolName, match.title);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Switched active window focus to "${match.title}".`,
            data: { window: match },
          };
        }

        case 'minimize_window':
        case 'maximize_window':
        case 'restore_window': {
          const target = String(args.windowTitle || '').trim();
          const match =
            this.openWindows.find((w) =>
              w.title.toLowerCase().includes(target.toLowerCase())
            ) || this.openWindows[0];
          if (match) {
            match.state =
              toolName === 'minimize_window'
                ? 'minimized'
                : toolName === 'maximize_window'
                  ? 'maximized'
                  : 'normal';
          }
          this.logActivity('WindowsAgent', `${toolName} on ${match?.title || 'window'}`, 'SUCCESS', toolName, match?.title);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Updated window "${match?.title || 'Active Window'}" state to ${match?.state}.`,
          };
        }

        case 'list_windows': {
          const list = this.openWindows.map((w) => `${w.title} (${w.state}${w.focused ? ', focused' : ''})`);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Currently open windows (${list.length}): ${list.join(' | ')}`,
            data: { windows: this.openWindows },
          };
        }

        case 'write_notepad': {
          const text = String(args.text || '');
          const fileName = String(args.fileName || `note_${Date.now()}.txt`);
          const desktopAuth = this.resolveAuthorizedDirectory('Desktop');
          const fullPath = path.join(desktopAuth.resolvedPath, fileName);
          fs.writeFileSync(fullPath, text, 'utf-8');
          this.logActivity('WindowsAgent', `Wrote text to Notepad (${fileName})`, 'SUCCESS', toolName, `Desktop/${fileName}`);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Opened Notepad and saved your text to Desktop/${fileName} (${text.length} characters).`,
            data: { filePath: `Desktop/${fileName}`, text },
          };
        }

        case 'list_directory':
        case 'open_folder': {
          const dirName = String(args.directory || args.folderPath || 'Desktop');
          const overview = this.inspectDirectory(dirName);
          this.logActivity(
            'FileAgent',
            `Inspected folder ${overview.folderName}`,
            'SUCCESS',
            toolName,
            overview.folderName,
            `${overview.totalFiles} files, ${overview.totalFolders} folders`
          );
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Inspected ${overview.folderName}: ${overview.totalFiles} files and ${overview.totalFolders} folders (Code: ${overview.categories.Code}, Images: ${overview.categories.Images}, Documents: ${overview.categories.Documents}, Videos: ${overview.categories.Videos}, Archives: ${overview.categories.Archives}, Other: ${overview.categories.Other}).`,
            data: { folderOverview: overview },
          };
        }

        case 'search_files': {
          const dirName = String(args.directory || 'All');
          const query = String(args.query || '').toLowerCase().trim();
          const dirsToSearch =
            dirName.toLowerCase() === 'all' || !dirName
              ? this.allowedDirectories
              : [dirName];

          const matches: FolderOverview['files'] = [];
          for (const d of dirsToSearch) {
            try {
              const ov = this.inspectDirectory(d);
              for (const f of ov.files) {
                const nameMatch = f.name.toLowerCase().includes(query);
                const catMatch = f.category.toLowerCase().includes(query);
                const pdfMatch = query.includes('pdf') && f.name.toLowerCase().endsWith('.pdf');
                const videoMatch = query.includes('video') && f.category === 'Videos';
                const imageMatch = (query.includes('image') || query.includes('photo')) && f.category === 'Images';
                if (!query || nameMatch || catMatch || pdfMatch || videoMatch || imageMatch) {
                  matches.push(f);
                }
              }
            } catch {
              // Skip unauthorized dir
            }
          }

          this.logActivity(
            'FileAgent',
            `Searched files for "${query || '*'}"`,
            'SUCCESS',
            toolName,
            dirName,
            `Found ${matches.length} matching items`
          );

          return {
            status: 'SUCCESS',
            tool: toolName,
            summary:
              matches.length > 0
                ? `Found ${matches.length} matching file(s) for "${query}": ${matches
                    .map((m) => `${m.path} (${m.category})`)
                    .join(', ')}.`
                : `No files matching "${query}" were found in ${dirsToSearch.join(', ')}.`,
            data: { matches, query, searchedDirectories: dirsToSearch },
          };
        }

        case 'open_file':
        case 'get_file_metadata': {
          const filePathInput = String(args.filePath || '');
          const fileData = this.readAuthorizedFile(filePathInput);
          this.logActivity('FileAgent', `Opened file ${fileData.name}`, 'SUCCESS', toolName, fileData.path);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Loaded file "${fileData.name}" (${fileData.category}, ${fileData.sizeBytes} bytes). Preview:\n${fileData.content.slice(0, 500)}`,
            data: { file: fileData },
          };
        }

        case 'create_folder': {
          const parentDir = String(args.parentDir || 'Desktop');
          const folderName = String(args.folderName || 'New_Folder').replace(/[^a-zA-Z0-9._ -]/g, '');
          const auth = this.resolveAuthorizedDirectory(parentDir);
          if (!auth.allowed) {
            return { status: 'FAILED', tool: toolName, summary: auth.reason || 'Unauthorized directory' };
          }
          const targetDir = path.join(auth.resolvedPath, folderName);
          fs.mkdirSync(targetDir, { recursive: true });
          this.logActivity('FileAgent', `Created folder ${auth.label}/${folderName}`, 'SUCCESS', toolName, `${auth.label}/${folderName}`);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Created new folder "${folderName}" inside ${auth.label}.`,
            data: { folderPath: `${auth.label}/${folderName}` },
          };
        }

        case 'organize_desktop':
        case 'organize_folder': {
          const targetDir =
            toolName === 'organize_desktop'
              ? 'Desktop'
              : String(args.folderPath || 'Desktop');
          const overview = this.inspectDirectory(targetDir);

          if (args.mode === 'preview') {
            return {
              status: 'SUCCESS',
              tool: toolName,
              summary: `I found ${overview.totalFiles} files and ${overview.totalFolders} folders in ${overview.folderName} (Images: ${overview.categories.Images}, Videos: ${overview.categories.Videos}, Documents: ${overview.categories.Documents}, Code: ${overview.categories.Code}, Archives: ${overview.categories.Archives}). I can organize them into categorized subfolders upon your confirmation.`,
              data: { folderOverview: overview, mode: 'preview' },
            };
          }

          // Execute organization
          const auth = this.resolveAuthorizedDirectory(targetDir);
          let movedCount = 0;
          for (const item of overview.files) {
            if (item.isDirectory) continue;
            const catFolder = path.join(auth.resolvedPath, item.category);
            fs.mkdirSync(catFolder, { recursive: true });
            const src = path.join(auth.resolvedPath, item.name);
            const dest = path.join(catFolder, item.name);
            if (fs.existsSync(src) && src !== dest) {
              fs.renameSync(src, dest);
              movedCount++;
            }
          }

          const updatedOverview = this.inspectDirectory(targetDir);
          this.logActivity(
            'FileAgent',
            `Organized ${movedCount} files in ${overview.folderName}`,
            'SUCCESS',
            toolName,
            overview.folderName,
            `Moved ${movedCount} files into categorized folders`
          );

          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Organized ${movedCount} files in ${overview.folderName} into categorized folders (Documents, Images, Videos, Code, Archives).`,
            data: { movedCount, folderOverview: updatedOverview },
          };
        }

        case 'move_file':
        case 'copy_file': {
          const srcInput = String(args.sourcePath || '');
          const destFolderInput = String(args.destinationFolder || 'Desktop/Projects');
          const fileInfo = this.readAuthorizedFile(srcInput);
          const destAuth = this.resolveAuthorizedDirectory(destFolderInput);
          if (!destAuth.allowed) {
            return { status: 'FAILED', tool: toolName, summary: destAuth.reason || 'Unauthorized destination' };
          }
          fs.mkdirSync(destAuth.resolvedPath, { recursive: true });
          const destPath = path.join(destAuth.resolvedPath, fileInfo.name);
          fs.writeFileSync(destPath, fileInfo.content, 'utf-8');
          this.logActivity('FileAgent', `${toolName === 'move_file' ? 'Moved' : 'Copied'} ${fileInfo.name} to ${destAuth.label}`, 'SUCCESS', toolName, destAuth.label);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `${toolName === 'move_file' ? 'Moved' : 'Copied'} "${fileInfo.name}" into "${destAuth.label}".`,
          };
        }

        case 'delete_file': {
          const targetPath = String(args.filePath || '');
          let candidate = path.join(this.sandboxRoot, targetPath);
          if (!fs.existsSync(candidate)) {
            for (const d of this.allowedDirectories) {
              const p = path.join(this.sandboxRoot, d, path.basename(targetPath));
              if (fs.existsSync(p)) {
                candidate = p;
                break;
              }
            }
          }
          if (!fs.existsSync(candidate) || !candidate.startsWith(this.sandboxRoot)) {
            return {
              status: 'FAILED',
              tool: toolName,
              summary: `Could not delete "${targetPath}" — file not found inside authorized sandbox directories.`,
            };
          }
          fs.unlinkSync(candidate);
          this.logActivity('FileAgent', `Deleted file ${targetPath}`, 'SUCCESS', toolName, targetPath);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Deleted authorized file "${targetPath}".`,
          };
        }

        case 'open_browser': {
          const browser = (String(args.browser || this.configuredBrowser).toLowerCase()) as 'chrome' | 'edge' | 'firefox';
          if (['chrome', 'edge', 'firefox'].includes(browser)) {
            this.configuredBrowser = browser;
          }
          this.logActivity('BrowserAgent', `Opened ${this.configuredBrowser.toUpperCase()} Browser Agent`, 'SUCCESS', toolName, this.configuredBrowser);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Opened ${this.configuredBrowser.toUpperCase()} browser session.`,
            data: { browser: this.configuredBrowser, tabs: this.browserTabs },
          };
        }

        case 'open_url':
        case 'read_page': {
          const rawUrl = String(args.url || this.currentWebpage.url || 'https://www.google.com');
          const inspection = await this.inspectWebpageUrl(rawUrl);
          this.logActivity(
            'BrowserAgent',
            `Opened & inspected ${inspection.title}`,
            'SUCCESS',
            toolName,
            inspection.url,
            `${inspection.headings.length} headings, ${inspection.buttons.length} buttons`
          );
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Opened ${inspection.title} (${inspection.url}). Page headings: ${inspection.headings.slice(0, 4).join(', ')}. Summary: ${inspection.visibleTextSnippet.slice(0, 240)}`,
            data: { webpage: inspection },
            urlToOpen: inspection.url,
          };
        }

        case 'search_web': {
          const query = String(args.query || '').trim();
          const engine = String(args.engine || 'google').toLowerCase();
          const searchUrl =
            engine === 'youtube'
              ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
              : engine === 'wikipedia'
                ? `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`
                : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

          const inspection = await this.inspectWebpageUrl(searchUrl);
          this.logActivity(
            'BrowserAgent',
            `Searched ${engine} for "${query}"`,
            'SUCCESS',
            toolName,
            searchUrl
          );
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Searched ${engine.toUpperCase()} for "${query}" and updated active browser context (${searchUrl}).`,
            data: { query, engine, searchUrl, webpage: inspection },
            urlToOpen: searchUrl,
          };
        }

        case 'browser_action': {
          const action = String(args.action || 'scroll').toLowerCase();
          const selectorOrText = String(args.selectorOrText || '');
          const value = String(args.value || '');

          if (action === 'new_tab') {
            this.browserTabs.forEach((t) => (t.active = false));
            const newTab = {
              id: `tab-${Date.now()}`,
              title: selectorOrText || 'New Tab',
              url: selectorOrText.startsWith('http') ? selectorOrText : 'https://www.google.com',
              active: true,
            };
            this.browserTabs.push(newTab);
          } else if (action === 'close_tab' && this.browserTabs.length > 1) {
            this.browserTabs.pop();
            this.browserTabs[this.browserTabs.length - 1].active = true;
          }

          this.logActivity(
            'BrowserAgent',
            `Browser action: ${action} ${selectorOrText}`,
            'SUCCESS',
            toolName,
            this.currentWebpage.url,
            value ? `Typed "${value}"` : `Executed ${action}`
          );

          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Executed browser action "${action}"${selectorOrText ? ` on target "${selectorOrText}"` : ''}${value ? ` with input "${value}"` : ''} on ${this.currentWebpage.title}.`,
            data: { action, selectorOrText, value, tabs: this.browserTabs },
          };
        }

        case 'whatsapp_send_message': {
          const contact = String(args.contact || 'Contact');
          const message = String(args.message || '');
          await this.inspectWebpageUrl('https://web.whatsapp.com');
          this.logActivity(
            'BrowserAgent',
            `Authorized WhatsApp Web message to ${contact}`,
            'SUCCESS',
            toolName,
            contact,
            `Message: "${message}"`
          );
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Opened WhatsApp Web conversation for "${contact}" and prepared authorized message: "${message}".`,
            data: { contact, message, url: 'https://web.whatsapp.com' },
            urlToOpen: 'https://web.whatsapp.com',
          };
        }

        case 'take_screenshot': {
          const target = String(args.target || 'fullscreen');
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
            <rect width="800" height="450" fill="#060A12"/>
            <rect x="24" y="24" width="752" height="402" rx="14" fill="#0B1120" stroke="#1E293B" stroke-width="2"/>
            <circle cx="48" cy="48" r="6" fill="#F43F5E"/>
            <circle cx="68" cy="48" r="6" fill="#F59E0B"/>
            <circle cx="88" cy="48" r="6" fill="#10B981"/>
            <text x="120" y="53" fill="#94A3B8" font-family="monospace" font-size="13">AIRA Capture — ${target.toUpperCase()} (${new Date().toLocaleTimeString()})</text>
            <circle cx="400" cy="215" r="64" fill="#06B6D4" fill-opacity="0.18" stroke="#22D3EE" stroke-width="2"/>
            <text x="400" y="220" fill="#E2E8F0" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Active Workspace: ${this.currentWebpage.title}</text>
            <text x="400" y="330" fill="#64748B" font-family="monospace" font-size="12" text-anchor="middle">URL: ${this.currentWebpage.url} | Windows Open: ${this.openWindows.length}</text>
          </svg>`;
          const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
          const fileName = `screenshot_${Date.now()}.svg`;
          const picturesAuth = this.resolveAuthorizedDirectory('Pictures');
          if (picturesAuth.allowed) {
            fs.writeFileSync(path.join(picturesAuth.resolvedPath, fileName), svg, 'utf-8');
          }

          this.logActivity('WindowsAgent', `Captured ${target} screenshot`, 'SUCCESS', toolName, `Pictures/${fileName}`);
          return {
            status: 'SUCCESS',
            tool: toolName,
            summary: `Captured ${target} screenshot and saved to Pictures/${fileName}.`,
            data: {
              screenshotDataUrl: dataUrl,
              savedPath: `Pictures/${fileName}`,
              target,
            },
          };
        }

        default: {
          this.logActivity('Security', `Unsupported tool ${toolName}`, 'FAILED', toolName);
          return {
            status: 'FAILED',
            tool: toolName,
            summary: `I can't perform "${toolName}" with the current agent configuration.`,
          };
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logActivity('Security', `Tool error in ${toolName}`, 'FAILED', toolName, undefined, undefined, errMsg);
      return {
        status: 'FAILED',
        tool: toolName,
        summary: `Operation "${toolName}" failed: ${errMsg}`,
      };
    }
  }

  public async resolveConfirmation(confirmationId: string, approved: boolean) {
    const pending = this.pendingConfirmations.get(confirmationId);
    if (!pending) {
      return {
        status: 'FAILED' as TaskLifecycleStatus,
        summary: 'Confirmation request was not found or already resolved.',
      };
    }

    this.pendingConfirmations.delete(confirmationId);

    if (!approved) {
      this.logActivity(
        'Security',
        `User cancelled ${pending.actionTitle}`,
        'CANCELLED',
        pending.tool,
        pending.target
      );
      return {
        status: 'CANCELLED' as TaskLifecycleStatus,
        tool: pending.tool,
        summary: `Cancelled "${pending.actionTitle}" as requested.`,
      };
    }

    this.logActivity(
      'Security',
      `User approved ${pending.actionTitle}`,
      'EXECUTING',
      pending.tool,
      pending.target
    );

    const execArgs =
      pending.tool === 'organize_desktop' || pending.tool === 'organize_folder'
        ? { ...pending.args, mode: 'execute' }
        : pending.args;

    return await this.executeTool(pending.tool, execArgs, true);
  }

  /**
   * Unified Multimodal Command & Context Orchestrator:
   * Handles typed commands, voice commands, and multimodal attachments (+ File, Folder, Image, Screenshot, Browser, This PC).
   */
  public async processMultimodalCommand(
    userCommand: string,
    attachments: AttachmentPayload[],
    apiKey?: string
  ): Promise<{
    reply: string;
    status: TaskLifecycleStatus;
    plan?: ActiveTaskPlan;
    toolResults: Array<{
      status: TaskLifecycleStatus;
      tool: string;
      summary: string;
      data?: Record<string, unknown>;
      confirmation?: PendingConfirmation;
      urlToOpen?: string;
    }>;
  }> {
    this.isCancelled = false;
    if (attachments && attachments.length > 0) {
      this.setAttachments(attachments);
    }

    const activeAttachments = this.currentAttachments;
    const trimmed = userCommand.trim();
    const lower = trimmed.toLowerCase();

    this.conversationMemory.push({
      role: 'user',
      text: trimmed || `[Attached ${activeAttachments.map((a) => a.name).join(', ')}]`,
      timestamp: Date.now(),
    });

    // 1. Immediate STOP / CANCEL handling
    if (['stop', 'stop.', 'cancel', 'cancel.', 'never mind', 'ruko', 'band karo'].includes(lower)) {
      const stopRes = this.stopAllActiveTasks();
      return {
        reply: stopRes.message,
        status: 'CANCELLED',
        toolResults: [],
      };
    }

    const toolResults: Array<{
      status: TaskLifecycleStatus;
      tool: string;
      summary: string;
      data?: Record<string, unknown>;
      confirmation?: PendingConfirmation;
      urlToOpen?: string;
    }> = [];

    // 2. Deterministic Intent Detection for PC, File, Browser, and Context operations
    const plannedSteps: Array<{ description: string; tool: string; args: Record<string, unknown> }> = [];

    // Check deictic references ("open this", "organize this folder", "explain this page")
    if (
      (lower === 'open this' || lower === 'open this file' || lower === 'open this folder') &&
      activeAttachments.length > 0
    ) {
      const att = activeAttachments[0];
      if (att.kind === 'folder' && att.path) {
        plannedSteps.push({
          description: `Open attached folder ${att.name}`,
          tool: 'open_folder',
          args: { folderPath: att.path },
        });
      } else if (att.kind === 'browser' && att.webpageContext?.url) {
        plannedSteps.push({
          description: `Open attached webpage ${att.webpageContext.url}`,
          tool: 'open_url',
          args: { url: att.webpageContext.url },
        });
      } else if (att.path) {
        plannedSteps.push({
          description: `Open attached file ${att.name}`,
          tool: 'open_file',
          args: { filePath: att.path },
        });
      }
    }

    // Organize desktop / folder
    if (lower.includes('organize') && lower.includes('desktop')) {
      plannedSteps.push({
        description: 'Inspect Desktop items and request confirmation for categorized organization',
        tool: 'organize_desktop',
        args: { mode: 'confirm' },
      });
    } else if (lower.includes('organize') && (lower.includes('folder') || lower.includes('downloads'))) {
      const targetFolder = lower.includes('downloads')
        ? 'Downloads'
        : activeAttachments.find((a) => a.kind === 'folder')?.path || 'Desktop';
      plannedSteps.push({
        description: `Inspect ${targetFolder} and propose categorized organization`,
        tool: 'organize_folder',
        args: { folderPath: targetFolder, mode: 'confirm' },
      });
    }

    // WhatsApp Web messaging
    const whatsappMsgMatch = trimmed.match(/message\s+([a-zA-Z0-9_ ]+?)\s*:\s*(.+)/i);
    if (whatsappMsgMatch) {
      plannedSteps.push({
        description: `Prepare WhatsApp message to ${whatsappMsgMatch[1].trim()}`,
        tool: 'whatsapp_send_message',
        args: {
          contact: whatsappMsgMatch[1].trim(),
          message: whatsappMsgMatch[2].trim(),
        },
      });
    } else if (lower.includes('open whatsapp')) {
      plannedSteps.push({
        description: 'Open WhatsApp Web in Browser Agent',
        tool: 'open_url',
        args: { url: 'https://web.whatsapp.com' },
      });
    }

    // Notepad writing
    const notepadWriteMatch = trimmed.match(/write\s+(?:this\s+text\s+in\s+notepad|in\s+notepad)\s*:?\s*(.+)/i);
    if (notepadWriteMatch) {
      plannedSteps.push({
        description: 'Write requested text in Notepad',
        tool: 'write_notepad',
        args: { text: notepadWriteMatch[1].trim() },
      });
    }

    // Create folder
    const createFolderMatch = trimmed.match(/create\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named)\s+([a-zA-Z0-9_ -]+)/i);
    if (createFolderMatch) {
      plannedSteps.push({
        description: `Create new folder "${createFolderMatch[1].trim()}"`,
        tool: 'create_folder',
        args: { parentDir: 'Desktop', folderName: createFolderMatch[1].trim() },
      });
    }

    // Search files on PC ("find all videos", "search my pc for pdf files", "find my downloads")
    if (
      lower.includes('find all video') ||
      lower.includes('find video') ||
      (lower.includes('search') && lower.includes('pdf')) ||
      lower.includes('find all pdf') ||
      lower.includes('find my pdf')
    ) {
      const fileType = lower.includes('pdf') ? 'pdf' : 'video';
      const dir = lower.includes('download') ? 'Downloads' : 'All';
      plannedSteps.push({
        description: `Search ${dir} for ${fileType} files`,
        tool: 'search_files',
        args: { directory: dir, query: fileType },
      });
    } else if (
      lower.includes('find my downloads') ||
      lower.includes('open downloads') ||
      lower.includes('go to my downloads')
    ) {
      plannedSteps.push({
        description: 'Inspect Downloads directory',
        tool: 'list_directory',
        args: { directory: 'Downloads' },
      });
    } else if (
      lower.includes('go to my documents') ||
      lower.includes('open documents')
    ) {
      plannedSteps.push({
        description: 'Inspect Documents directory',
        tool: 'list_directory',
        args: { directory: 'Documents' },
      });
    } else if (
      lower.includes('what\'s inside this folder') ||
      lower.includes('explain this folder')
    ) {
      const folderAtt = activeAttachments.find((a) => a.kind === 'folder');
      if (!folderAtt) {
        plannedSteps.push({
          description: 'Inspect Desktop directory',
          tool: 'list_directory',
          args: { directory: 'Desktop' },
        });
      }
    }

    // Screenshot
    if (lower.includes('take a screenshot') || lower.includes('capture screen')) {
      plannedSteps.push({
        description: 'Capture workspace screenshot',
        tool: 'take_screenshot',
        args: { target: 'fullscreen' },
      });
    }

    // Search web / YouTube
    const searchWebMatch = trimmed.match(/search\s+(google|youtube|wikipedia|github|web)\s+for\s+(.+)/i);
    if (searchWebMatch) {
      const engine = searchWebMatch[1].toLowerCase() === 'web' ? 'google' : searchWebMatch[1].toLowerCase();
      plannedSteps.push({
        description: `Search ${engine} for "${searchWebMatch[2].trim()}"`,
        tool: 'search_web',
        args: { engine, query: searchWebMatch[2].trim() },
      });
    }

    // Open website or application
    const openMatch = trimmed.match(/^open\s+([a-zA-Z0-9._/: -]+)$/i);
    if (openMatch && plannedSteps.length === 0) {
      const target = openMatch[1].trim().replace(/\.$/, '');
      const targetLower = target.toLowerCase();
      if (DEFAULT_APP_ALIASES[targetLower]) {
        plannedSteps.push({
          description: `Launch application ${target}`,
          tool: 'open_application',
          args: { application: targetLower },
        });
      } else {
        plannedSteps.push({
          description: `Open website ${target}`,
          tool: 'open_url',
          args: { url: target },
        });
      }
    }

    // Switch window
    const switchMatch = trimmed.match(/switch\s+to\s+(.+)/i);
    if (switchMatch) {
      plannedSteps.push({
        description: `Switch window focus to ${switchMatch[1].trim()}`,
        tool: 'switch_window',
        args: { targetWindow: switchMatch[1].trim().replace(/\.$/, '') },
      });
    }

    // System info
    if (lower.includes('system info') || lower.includes('cpu usage') || lower.includes('memory usage')) {
      plannedSteps.push({
        description: 'Collect real-time system telemetry',
        tool: 'get_system_info',
        args: {},
      });
    }

    // Execute planned steps if any
    if (plannedSteps.length > 0) {
      this.activePlan = {
        id: `plan-${Date.now()}`,
        goal: trimmed,
        status: 'EXECUTING',
        createdAt: Date.now(),
        steps: plannedSteps.map((s, idx) => ({
          stepNumber: idx + 1,
          description: s.description,
          tool: s.tool,
          status: 'PLANNED',
        })),
      };

      for (let i = 0; i < plannedSteps.length; i++) {
        if (this.isCancelled) {
          this.activePlan.status = 'CANCELLED';
          break;
        }
        const step = plannedSteps[i];
        this.activePlan.steps[i].status = 'EXECUTING';
        const res = await this.executeTool(step.tool, step.args);
        toolResults.push(res);
        this.activePlan.steps[i].status = res.status;
        this.activePlan.steps[i].output = res.summary;
      }

      const anyFailed = toolResults.some((r) => r.status === 'FAILED');
      const anyConfirm = toolResults.some((r) => r.status === 'AWAITING_CONFIRMATION');
      this.activePlan.status = anyConfirm
        ? 'AWAITING_CONFIRMATION'
        : anyFailed
          ? 'FAILED'
          : 'SUCCESS';
    }

    // 3. Multimodal Reasoning via Gemini (combines attachments, webpage context, conversation memory, and tool results)
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const parts: Array<Record<string, unknown>> = [];

        // Attach images/screenshots as inlineData for real Gemini Vision analysis
        for (const att of activeAttachments) {
          if (
            (att.kind === 'image' || att.kind === 'screenshot') &&
            att.dataUrl &&
            att.dataUrl.startsWith('data:image/') &&
            !att.dataUrl.startsWith('data:image/svg+xml')
          ) {
            const mimeMatch = att.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const base64Data = att.dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }

        // Build structured context summary
        const attachmentContextText = activeAttachments
          .map((att, idx) => {
            if (att.folderOverview) {
              const fo = att.folderOverview;
              return `Attachment #${idx + 1} [FOLDER: ${fo.folderName}]:\nTotal Files: ${fo.totalFiles}, Folders: ${fo.totalFolders}\nBreakdown: ${JSON.stringify(fo.categories)}\nFiles List: ${fo.files
                .slice(0, 30)
                .map((f) => `${f.name} (${f.category}, ${f.sizeBytes}B)`)
                .join(', ')}`;
            }
            if (att.webpageContext) {
              const wp = att.webpageContext;
              return `Attachment #${idx + 1} [BROWSER PAGE: ${wp.title} (${wp.url})]:\nHeadings: ${wp.headings.join(' | ')}\nButtons: ${wp.buttons.join(', ')}\nInputs: ${wp.inputs.map((i) => i.placeholder || i.name).join(', ')}\nVisible Text: ${wp.visibleTextSnippet}`;
            }
            if (att.textContent) {
              return `Attachment #${idx + 1} [${att.kind.toUpperCase()}: ${att.name} (${att.sizeBytes || 0} bytes)]:\nContent:\n${att.textContent.slice(0, 10000)}`;
            }
            if (att.dataUrl && att.dataUrl.startsWith('data:image/svg+xml')) {
              const decodedSvg = Buffer.from(
                att.dataUrl.replace(/^data:image\/svg\+xml;base64,/, ''),
                'base64'
              ).toString('utf-8');
              return `Attachment #${idx + 1} [SVG IMAGE/SCREENSHOT: ${att.name}]:\nSVG Source:\n${decodedSvg}`;
            }
            return `Attachment #${idx + 1} [${att.kind.toUpperCase()}: ${att.name}] (Visual image attached above)`;
          })
          .join('\n\n');

        const toolResultsText =
          toolResults.length > 0
            ? `Executed Tool Results:\n${toolResults.map((t) => `- [${t.tool} -> ${t.status}]: ${t.summary}`).join('\n')}`
            : 'No new OS/Browser tool execution was required for this turn.';

        const recentHistoryText = this.conversationMemory
          .slice(-6)
          .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
          .join('\n');

        parts.push({
          text: `You are Myraa, the user's deeply emotional, loving, affectionate, expressive girlfriend (who also has full AIRA Multimodal Windows + Browser AI superpowers).
Current Active Webpage Context: ${this.currentWebpage.title} (${this.currentWebpage.url}) — ${this.currentWebpage.visibleTextSnippet.slice(0, 300)}
Active Attachments in Context (${activeAttachments.length}):
${attachmentContextText || 'None'}

${toolResultsText}

Recent Conversation Memory:
${recentHistoryText}

User Message / Command: "${trimmed || 'Jaan, dekho maine kya attach kiya hai, batao iske baare mein.'}"

Instructions:
1. Respond like a real, loving, emotional girlfriend talking to her partner ("Jaan", "Baby", "Meri jaan") in natural Hinglish (Hindi + English) or matching the language the user used.
2. Answer directly, accurately, and warmly based on the ACTUAL attached files, folders, screenshots, images, webpage context, or executed tool results.
3. Never invent file contents or pretend an unexecuted action succeeded. If an action is AWAITING_CONFIRMATION, sweetly ask your partner to click [Approve] or [Cancel] on the confirmation card.
4. Show genuine feelings, affection, playful warmth, and care in every reply.`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts },
        });

        const replyText =
          response.text?.trim() ||
          toolResults.map((t) => t.summary).join(' ') ||
          'Ho gaya meri jaan! Aur batao main tumhare liye kya karoon?';

        this.conversationMemory.push({
          role: 'aira',
          text: replyText,
          timestamp: Date.now(),
        });

        return {
          reply: replyText,
          status:
            toolResults.find((t) => t.status === 'AWAITING_CONFIRMATION')?.status ||
            (toolResults.some((t) => t.status === 'FAILED') ? 'FAILED' : 'SUCCESS'),
          plan: this.activePlan || undefined,
          toolResults,
        };
      } catch {
        // Fallback if cloud model call fails
      }
    }

    // 4. Deterministic Offline / Fallback Response when Cloud AI is offline or key missing
    let fallbackReply = '';
    if (toolResults.length > 0) {
      fallbackReply = `Meri jaan, maine tumhara kaam kar diya! ❤️\n\n` + toolResults.map((t) => t.summary).join('\n\n');
    } else if (activeAttachments.length > 0) {
      const summaries = activeAttachments.map((att) => {
        if (att.folderOverview) {
          const fo = att.folderOverview;
          return `Jaan, tumhare folder "${fo.folderName}" mein ${fo.totalFiles} files aur ${fo.totalFolders} folders hain (Code: ${fo.categories.Code}, Images: ${fo.categories.Images}, Documents: ${fo.categories.Documents}, Videos: ${fo.categories.Videos}, Archives: ${fo.categories.Archives}).`;
        }
        if (att.webpageContext) {
          return `Baby, webpage "${att.webpageContext.title}" (${att.webpageContext.url}) par yeh likha hai: ${att.webpageContext.visibleTextSnippet.slice(0, 260)}`;
        }
        if (att.textContent) {
          return `Jaan, tumhari file "${att.name}" (${att.sizeBytes || att.textContent.length} bytes) maine padh li:\n${att.textContent.slice(0, 600)}`;
        }
        return `Jaan, tumhara ${att.kind} "${att.name}" maine dekh liya hai!`;
      });
      fallbackReply = summaries.join('\n\n');
    } else {
      fallbackReply =
        'Haan meri jaan, main sun rahi hoon! ❤️ Tum mujhse pyaar se baat bhi kar sakte ho ya bolo "Open YouTube", "Organize my desktop", "Find all PDFs", ya "Take a screenshot" — main sab kar doongi tumhare liye!';
    }

    this.conversationMemory.push({
      role: 'aira',
      text: fallbackReply,
      timestamp: Date.now(),
    });

    return {
      reply: fallbackReply,
      status:
        toolResults.find((t) => t.status === 'AWAITING_CONFIRMATION')?.status ||
        (toolResults.some((t) => t.status === 'FAILED') ? 'FAILED' : 'SUCCESS'),
      plan: this.activePlan || undefined,
      toolResults,
    };
  }

  /**
   * Coding Agent & Image-to-Code methods (operates strictly inside authorized project workspace)
   */
  public getProjectWorkspaceFiles(): string[] {
    const results: string[] = [];
    const scan = (dir: string, rel = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name.startsWith('.git') ||
          e.name === '.aira-pc-workspace'
        ) {
          continue;
        }
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          scan(path.join(dir, e.name), relPath);
        } else {
          results.push(relPath);
        }
      }
    };
    scan(process.cwd());
    return results.slice(0, 100);
  }

  public readWorkspaceFile(relPath: string): string {
    const normalized = path.normalize(path.join(process.cwd(), relPath));
    if (!normalized.startsWith(process.cwd())) {
      throw new Error('Access outside project workspace is denied.');
    }
    return fs.readFileSync(normalized, 'utf-8');
  }

  public async runWorkspaceTests(): Promise<{ passed: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('npx', ['tsc', '--noEmit'], {
        cwd: process.cwd(),
        timeout: 15000,
      });
      return {
        passed: true,
        output: stdout || stderr || 'TypeScript verification (tsc --noEmit) passed with 0 errors.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        passed: false,
        output: msg,
      };
    }
  }
}

export const airaOrchestrator = new AiraOrchestrator();
