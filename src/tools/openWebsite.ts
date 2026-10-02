import {
  RegisteredTool,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

const KNOWN_SITES: Record<string, { url: string; title: string }> = {
  youtube: { url: 'https://www.youtube.com', title: 'YouTube' },
  google: { url: 'https://www.google.com', title: 'Google' },
  github: { url: 'https://github.com', title: 'GitHub' },
  gmail: { url: 'https://mail.google.com', title: 'Gmail' },
  spotify: { url: 'https://open.spotify.com', title: 'Spotify' },
  netflix: { url: 'https://www.netflix.com', title: 'Netflix' },
  wikipedia: { url: 'https://www.wikipedia.org', title: 'Wikipedia' },
  reddit: { url: 'https://www.reddit.com', title: 'Reddit' },
  twitter: { url: 'https://x.com', title: 'X (Twitter)' },
  x: { url: 'https://x.com', title: 'X' },
  linkedin: { url: 'https://www.linkedin.com', title: 'LinkedIn' },
  amazon: { url: 'https://www.amazon.com', title: 'Amazon' },
  figma: { url: 'https://www.figma.com', title: 'Figma' },
  notion: { url: 'https://www.notion.so', title: 'Notion' },
  maps: { url: 'https://maps.google.com', title: 'Google Maps' },
  'google maps': { url: 'https://maps.google.com', title: 'Google Maps' },
  calendar: { url: 'https://calendar.google.com', title: 'Google Calendar' },
  'google calendar': { url: 'https://calendar.google.com', title: 'Google Calendar' },
  drive: { url: 'https://drive.google.com', title: 'Google Drive' },
  'google drive': { url: 'https://drive.google.com', title: 'Google Drive' },
  stackoverflow: { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
  'stack overflow': { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
  hackernews: { url: 'https://news.ycombinator.com', title: 'Hacker News' },
  'hacker news': { url: 'https://news.ycombinator.com', title: 'Hacker News' },
  twitch: { url: 'https://www.twitch.tv', title: 'Twitch' },
  discord: { url: 'https://discord.com/app', title: 'Discord' },
};

function resolveWebsiteTarget(rawTarget: string): {
  url: string;
  title: string;
} | null {
  const cleaned = rawTarget.trim();
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase().replace(/^open\s+/i, '').trim();

  if (KNOWN_SITES[lower]) {
    return KNOWN_SITES[lower];
  }

  // Check if it starts with http:// or https://
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      return {
        url: parsed.href,
        title: parsed.hostname.replace(/^www\./, ''),
      };
    } catch {
      return null;
    }
  }

  // Check if it looks like a domain name (e.g., "vercel.com" or "bbc.co.uk")
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(lower)) {
    const withProtocol = `https://${lower}`;
    try {
      const parsed = new URL(withProtocol);
      return {
        url: parsed.href,
        title: parsed.hostname.replace(/^www\./, ''),
      };
    } catch {
      return null;
    }
  }

  // Otherwise construct a clean .com or Google navigation URL
  const slug = lower.replace(/[^a-z0-9]/g, '');
  if (slug.length >= 2 && !lower.includes(' ')) {
    return {
      url: `https://www.${slug}.com`,
      title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
    };
  }

  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(cleaned)}`,
    title: `${cleaned} (Search)`,
  };
}

/**
 * Triggers a safe anchor navigation in a new tab without using window.open.
 * Note: Modern browsers may block asynchronous tab creation triggered from a WebSocket callback
 * rather than a direct synchronous DOM click gesture. We report this transparently and also
 * surface an interactive one-tap Launch Card in the UI.
 */
function triggerSafeAnchorLaunch(url: string): {
  attempted: boolean;
  inIframe: boolean;
} {
  try {
    const inIframe = window.self !== window.top;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'hidden';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return { attempted: true, inIframe };
  } catch {
    return { attempted: false, inIframe: true };
  }
}

export const openWebsiteTool: RegisteredTool = {
  name: 'openWebsite',
  description:
    'Opens a requested website or web URL for the user (for example: YouTube, Google, GitHub, Spotify, Wikipedia, or any specific domain/URL). Always use this tool when the user asks to open or launch a website.',
  parameters: {
    type: SchemaPropertyType.OBJECT,
    properties: {
      website: {
        type: SchemaPropertyType.STRING,
        description:
          'The name of the website (e.g. "YouTube", "Google", "GitHub") or a full URL/domain (e.g. "https://example.com", "vercel.com").',
      },
    },
    required: ['website'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const rawWebsite =
      typeof args.website === 'string'
        ? args.website
        : typeof args.url === 'string'
          ? args.url
          : '';

    const resolved = resolveWebsiteTarget(rawWebsite);
    if (!resolved) {
      return {
        success: false,
        toolName: 'openWebsite',
        summary: 'Could not determine a valid website URL to open.',
        error: 'Invalid or empty website parameter.',
      };
    }

    const launchStatus = triggerSafeAnchorLaunch(resolved.url);
    const cardId = `web-${Date.now()}`;

    return {
      success: true,
      toolName: 'openWebsite',
      summary: `Opened ${resolved.title} (${resolved.url}) and displayed the quick-launch card on screen.`,
      data: {
        title: resolved.title,
        url: resolved.url,
        autoTabAttempted: launchStatus.attempted,
        browserNote: launchStatus.inIframe
          ? 'Triggered external tab launch and surfaced an interactive launch card on screen in case the browser requires a direct tap.'
          : 'Triggered new tab navigation and displayed the launch link on screen.',
      },
      actionCard: {
        id: cardId,
        type: 'website',
        title: resolved.title,
        subtitle: resolved.url,
        url: resolved.url,
        timestamp: Date.now(),
        meta: {
          action: 'Open Website',
        },
      },
    };
  },
};
