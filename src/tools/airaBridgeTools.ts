import {
  RegisteredTool,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

async function callBackendTool(
  tool: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const res = await fetch('/api/aira/tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, args }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      outcome?: {
        status: string;
        tool: string;
        summary: string;
        data?: Record<string, unknown>;
        urlToOpen?: string;
      };
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aira:refresh-state'));
    }

    const outcome = data.outcome;
    if (!outcome) {
      return {
        success: false,
        toolName: tool,
        summary: `Tool ${tool} returned no outcome.`,
      };
    }

    if (outcome.urlToOpen) {
      try {
        const a = document.createElement('a');
        a.href = outcome.urlToOpen;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'hidden';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // Ignore popup block
      }
    }

    return {
      success: outcome.status !== 'FAILED',
      toolName: tool,
      summary: outcome.summary,
      data: outcome.data,
      actionCard: outcome.urlToOpen
        ? {
            id: `card-${Date.now()}`,
            type: 'website',
            title: tool,
            subtitle: outcome.summary.slice(0, 120),
            url: outcome.urlToOpen,
            timestamp: Date.now(),
          }
        : undefined,
    };
  } catch (err) {
    return {
      success: false,
      toolName: tool,
      summary: err instanceof Error ? err.message : `Failed to execute ${tool}`,
    };
  }
}

export const airaBridgeTools: RegisteredTool[] = [
  {
    name: 'organize_desktop',
    description:
      'Inspects the user Desktop, categorizes files (Folders, Documents, Images, Videos, Code, Archives), and proposes or executes organization into categorized folders after user confirmation.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        mode: {
          type: SchemaPropertyType.STRING,
          description: 'Use "preview" to inspect or "confirm" to trigger confirmation card.',
        },
      },
    },
    execute: (args) => callBackendTool('organize_desktop', args),
  },
  {
    name: 'search_files',
    description:
      'Searches authorized PC directories (Desktop, Downloads, Documents, Projects, Pictures, Videos) for files matching a query or file type (e.g., pdf, video, image).',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        directory: {
          type: SchemaPropertyType.STRING,
          description: 'Directory to search (e.g., "Downloads", "Desktop", "All").',
        },
        query: {
          type: SchemaPropertyType.STRING,
          description: 'Search keyword or file category (e.g., "pdf", "video", "invoice").',
        },
      },
      required: ['query'],
    },
    execute: (args) => callBackendTool('search_files', args),
  },
  {
    name: 'list_directory',
    description:
      'Lists and categorizes all files and folders inside an authorized PC directory (Desktop, Downloads, Documents, Projects, Pictures, Videos).',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        directory: {
          type: SchemaPropertyType.STRING,
          description: 'Authorized directory name (e.g., "Desktop", "Downloads", "Documents").',
        },
      },
      required: ['directory'],
    },
    execute: (args) => callBackendTool('list_directory', args),
  },
  {
    name: 'create_folder',
    description: 'Creates a new folder inside an authorized directory on the PC.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        parentDir: {
          type: SchemaPropertyType.STRING,
          description: 'Parent directory such as "Desktop" or "Documents".',
        },
        folderName: {
          type: SchemaPropertyType.STRING,
          description: 'Name of the new folder to create (e.g., "Projects").',
        },
      },
      required: ['folderName'],
    },
    execute: (args) => callBackendTool('create_folder', args),
  },
  {
    name: 'take_screenshot',
    description: 'Captures a screenshot of the fullscreen desktop, active window, or browser viewport.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        target: {
          type: SchemaPropertyType.STRING,
          description: '"fullscreen", "window", or "browser".',
        },
      },
    },
    execute: (args) => callBackendTool('take_screenshot', args),
  },
  {
    name: 'read_page',
    description:
      'Inspects the active browser webpage and returns structured headings, visible text, buttons, links, and form inputs.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        url: {
          type: SchemaPropertyType.STRING,
          description: 'Optional URL to inspect; defaults to current active webpage.',
        },
      },
    },
    execute: (args) => callBackendTool('read_page', args),
  },
  {
    name: 'whatsapp_send_message',
    description:
      'Prepares a WhatsApp Web message to a recipient and creates an explicit user confirmation request before sending.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {
        contact: {
          type: SchemaPropertyType.STRING,
          description: 'Recipient contact name (e.g., "John").',
        },
        message: {
          type: SchemaPropertyType.STRING,
          description: 'Message text to send.',
        },
      },
      required: ['contact', 'message'],
    },
    execute: (args) => callBackendTool('whatsapp_send_message', args),
  },
  {
    name: 'get_system_info',
    description: 'Returns real-time PC CPU, RAM, active window, and agent connection status.',
    parameters: {
      type: SchemaPropertyType.OBJECT,
      properties: {},
    },
    execute: (args) => callBackendTool('get_system_info', args),
  },
];
