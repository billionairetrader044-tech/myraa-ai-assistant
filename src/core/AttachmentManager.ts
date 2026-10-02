import {
  AttachmentKind,
  AttachmentPayload,
  FolderOverview,
  WebpageInspection,
} from '../types/aira';

function classifyExtension(fileName: string): keyof FolderOverview['categories'] {
  const lower = fileName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const ext = dotIdx !== -1 ? lower.slice(dotIdx) : '';
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.json', '.xml', '.sh', '.sql'].includes(ext)) {
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

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export class AttachmentManager {
  /**
   * Processes a browser File object into an AIRA AttachmentPayload.
   * Never executes executables (.exe, .msi, .bat).
   */
  public static async fromBrowserFile(
    file: File,
    forcedKind?: AttachmentKind
  ): Promise<AttachmentPayload> {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lowerName = file.name.toLowerCase();
    const isImage =
      forcedKind === 'image' ||
      file.type.startsWith('image/') ||
      /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(lowerName);

    const isExecutable = /\.(exe|msi|bat|cmd|com|scr)$/i.test(lowerName);
    if (isExecutable) {
      return {
        id,
        kind: 'file',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        textContent: `[SECURITY POLICY]: Executable file "${file.name}" (${formatBytes(
          file.size
        )}) is attached strictly as non-executable data. AIRA never auto-executes binary files.`,
      };
    }

    if (isImage) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      return {
        id,
        kind: forcedKind || 'image',
        name: file.name,
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        dataUrl,
      };
    }

    // Read text/code/document content
    let textContent = '';
    try {
      textContent = (await file.text()).slice(0, 20000);
    } catch {
      textContent = `[Binary or non-UTF8 file: ${file.name}, ${formatBytes(file.size)}]`;
    }

    const kind: AttachmentKind =
      forcedKind ||
      (/\.(pdf|doc|docx|txt|md|csv)$/i.test(lowerName) ? 'document' : 'file');

    return {
      id,
      kind,
      name: file.name,
      mimeType: file.type || 'text/plain',
      sizeBytes: file.size,
      textContent,
    };
  }

  /**
   * Processes a multi-file Folder selection (webkitdirectory) into a FolderOverview attachment.
   */
  public static async fromBrowserFolderFiles(
    fileList: FileList
  ): Promise<AttachmentPayload> {
    const filesArray = Array.from(fileList);
    const firstRel = (filesArray[0] as File & { webkitRelativePath?: string })?.webkitRelativePath || '';
    const folderName = firstRel.split('/')[0] || 'Selected_Folder';

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

    const subFolders = new Set<string>();
    let totalSizeBytes = 0;

    const mappedFiles = filesArray.slice(0, 100).map((f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const parts = rel.split('/');
      if (parts.length > 2) {
        subFolders.add(parts[1]);
      }
      const cat = classifyExtension(f.name);
      categories[cat]++;
      totalSizeBytes += f.size;

      return {
        name: f.name,
        path: rel,
        category: cat,
        sizeBytes: f.size,
        modifiedAt: new Date(f.lastModified || Date.now()).toISOString(),
        isDirectory: false,
      };
    });

    categories.Folders = subFolders.size;

    const overview: FolderOverview = {
      folderName,
      folderPath: folderName,
      totalFiles: filesArray.length,
      totalFolders: subFolders.size,
      totalSizeBytes,
      categories,
      files: mappedFiles,
    };

    return {
      id: `folder-${Date.now()}`,
      kind: 'folder',
      name: folderName,
      path: folderName,
      sizeBytes: totalSizeBytes,
      folderOverview: overview,
    };
  }

  /**
   * Loads an authorized folder from This PC / Safe Directories on the server.
   */
  public static async fromAuthorizedServerFolder(
    dirName: string
  ): Promise<AttachmentPayload> {
    const res = await fetch(`/api/aira/fs/inspect?dir=${encodeURIComponent(dirName)}`);
    const data = (await res.json()) as { ok: boolean; overview?: FolderOverview; error?: string };
    if (!data.ok || !data.overview) {
      throw new Error(data.error || `Failed to inspect folder ${dirName}`);
    }

    return {
      id: `pc-folder-${Date.now()}`,
      kind: 'folder',
      name: data.overview.folderName,
      path: data.overview.folderPath,
      sizeBytes: data.overview.totalSizeBytes,
      folderOverview: data.overview,
    };
  }

  /**
   * Loads an authorized file from This PC / Safe Directories on the server.
   */
  public static async fromAuthorizedServerFile(
    filePath: string
  ): Promise<AttachmentPayload> {
    const res = await fetch(`/api/aira/fs/read?path=${encodeURIComponent(filePath)}`);
    const data = (await res.json()) as {
      ok: boolean;
      file?: {
        name: string;
        path: string;
        sizeBytes: number;
        category: string;
        content: string;
      };
      error?: string;
    };

    if (!data.ok || !data.file) {
      throw new Error(data.error || `Failed to read file ${filePath}`);
    }

    const isSvg = data.file.name.toLowerCase().endsWith('.svg');
    const dataUrl = isSvg
      ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data.file.content)))}`
      : undefined;

    return {
      id: `pc-file-${Date.now()}`,
      kind: isSvg ? 'image' : 'this_pc',
      name: data.file.name,
      path: data.file.path,
      sizeBytes: data.file.sizeBytes,
      textContent: data.file.content,
      dataUrl,
    };
  }

  /**
   * Captures a Screenshot (Fullscreen, Active Window, or Browser Viewport) via the Screenshot Agent.
   */
  public static async captureScreenshot(
    target: 'fullscreen' | 'window' | 'browser' = 'fullscreen'
  ): Promise<AttachmentPayload> {
    const res = await fetch('/api/aira/tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'take_screenshot',
        args: { target },
        bypassConfirmation: true,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      outcome?: {
        summary: string;
        data?: { screenshotDataUrl?: string; savedPath?: string };
      };
    };

    const dataUrl = data.outcome?.data?.screenshotDataUrl || '';
    const savedPath = data.outcome?.data?.savedPath || `Pictures/screenshot_${Date.now()}.svg`;

    return {
      id: `shot-${Date.now()}`,
      kind: 'screenshot',
      name: `${target}_capture.svg`,
      path: savedPath,
      dataUrl,
      textContent: `Captured ${target} screenshot saved at ${savedPath}.`,
    };
  }

  /**
   * Inspects a live webpage via the Browser Agent and creates a Browser Context attachment.
   */
  public static async fromBrowserUrl(url: string): Promise<AttachmentPayload> {
    const res = await fetch('/api/aira/browser/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      inspection?: WebpageInspection;
      error?: string;
    };

    if (!data.ok || !data.inspection) {
      throw new Error(data.error || 'Could not inspect browser page');
    }

    return {
      id: `web-ctx-${Date.now()}`,
      kind: 'browser',
      name: data.inspection.title || url,
      path: data.inspection.url,
      webpageContext: data.inspection,
    };
  }
}
