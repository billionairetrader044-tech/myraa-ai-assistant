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
  effectivePermission: PermissionLevel;
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

export type AttachmentKind =
  | 'file'
  | 'folder'
  | 'image'
  | 'document'
  | 'screenshot'
  | 'browser'
  | 'this_pc';

export interface AttachmentPayload {
  id: string;
  kind: AttachmentKind;
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

export interface ConversationTurn {
  id: string;
  role: 'user' | 'aira';
  modality: 'voice' | 'text' | 'multimodal';
  text: string;
  attachments?: AttachmentPayload[];
  plan?: ActiveTaskPlan;
  status?: TaskLifecycleStatus;
  timestamp: number;
}

export interface AiraBackendSnapshot {
  localSessionToken: string;
  windowsAgentOnline: boolean;
  configuredBrowser: 'chrome' | 'edge' | 'firefox';
  allowedDirectories: string[];
  autoOrganizeConfirmed: boolean;
  trustedWhatsappAutoSend: boolean;
  startWithWindows: boolean;
  permissionOverrides: Record<string, PermissionLevel>;
  tools: ToolDefinition[];
  pendingConfirmations: PendingConfirmation[];
  activities: ActivityEntry[];
  activePlan: ActiveTaskPlan | null;
  openWindows: Array<{
    id: string;
    title: string;
    app: string;
    state: 'normal' | 'minimized' | 'maximized';
    focused: boolean;
  }>;
  browserTabs: BrowserTabState[];
  currentWebpage: WebpageInspection;
  currentAttachments: AttachmentPayload[];
}
