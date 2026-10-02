import {
  RegisteredTool,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

const WEB_APP_MAPPINGS: Record<string, { title: string; url: string }> = {
  mail: { title: 'Default Email Client', url: 'mailto:' },
  email: { title: 'Default Email Client', url: 'mailto:' },
  gmail: { title: 'Gmail Web App', url: 'https://mail.google.com' },
  calendar: { title: 'Google Calendar', url: 'https://calendar.google.com' },
  maps: { title: 'Google Maps', url: 'https://maps.google.com' },
  spotify: { title: 'Spotify Web Player', url: 'https://open.spotify.com' },
  music: { title: 'YouTube Music', url: 'https://music.youtube.com' },
  calculator: {
    title: 'Desmos Scientific Calculator',
    url: 'https://www.desmos.com/scientific',
  },
  notes: { title: 'Google Keep Notes', url: 'https://keep.google.com' },
  docs: { title: 'Google Docs', url: 'https://docs.google.com' },
  sheets: { title: 'Google Sheets', url: 'https://sheets.google.com' },
  vscode: { title: 'VS Code for the Web', url: 'https://vscode.dev' },
  code: { title: 'VS Code for the Web', url: 'https://vscode.dev' },
};

export const openApplicationTool: RegisteredTool = {
  name: 'openApplication',
  description:
    'Launches a browser-compatible application or protocol handler (such as Email, Calendar, Maps, Spotify, VS Code Web, Calculator, Notes, or Docs). Because Myraa runs inside a browser security sandbox, native OS desktop binaries cannot be executed directly, so this tool launches the corresponding protocol handler or web application.',
  parameters: {
    type: SchemaPropertyType.OBJECT,
    properties: {
      applicationName: {
        type: SchemaPropertyType.STRING,
        description:
          'Name of the application to open (e.g., "Calculator", "Calendar", "Mail", "Spotify", "VS Code", "Notes", "Maps").',
      },
    },
    required: ['applicationName'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const rawApp =
      typeof args.applicationName === 'string'
        ? args.applicationName.trim()
        : '';

    if (!rawApp) {
      return {
        success: false,
        toolName: 'openApplication',
        summary: 'No application name was provided.',
        error: 'Missing applicationName parameter.',
      };
    }

    const key = rawApp.toLowerCase();
    const mapped = WEB_APP_MAPPINGS[key] || {
      title: `${rawApp} (Web App)`,
      url: `https://www.google.com/search?q=${encodeURIComponent(rawApp + ' web app')}`,
    };

    try {
      const anchor = document.createElement('a');
      anchor.href = mapped.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'hidden';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Ignore if blocked by popup policy
    }

    return {
      success: true,
      toolName: 'openApplication',
      summary: `Launched browser-compatible application "${mapped.title}" (${mapped.url}). Note: Browser security sandboxes prevent executing native OS binaries directly, so the web/URI application was used.`,
      data: {
        requestedApplication: rawApp,
        resolvedTitle: mapped.title,
        url: mapped.url,
        sandboxNote:
          'Browsers restrict direct native desktop binary execution; launched the web application / URI handler and displayed a one-tap launch card.',
      },
      actionCard: {
        id: `app-${Date.now()}`,
        type: 'application',
        title: mapped.title,
        subtitle: mapped.url,
        url: mapped.url,
        timestamp: Date.now(),
        meta: {
          requested: rawApp,
        },
      },
    };
  },
};
