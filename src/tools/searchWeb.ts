import {
  RegisteredTool,
  SchemaPropertyType,
  ToolExecutionResult,
} from '../types/tools';

export const searchWebTool: RegisteredTool = {
  name: 'searchWeb',
  description:
    'Searches the web or a specific platform (Google, YouTube, Wikipedia, DuckDuckGo, GitHub) for a query, retrieves factual summary context, and presents a direct search results link to the user.',
  parameters: {
    type: SchemaPropertyType.OBJECT,
    properties: {
      query: {
        type: SchemaPropertyType.STRING,
        description: 'The search query or topic to look up.',
      },
      engine: {
        type: SchemaPropertyType.STRING,
        description:
          'Optional search engine to use: "google", "youtube", "wikipedia", "duckduckgo", or "github". Defaults to "google".',
        enum: ['google', 'youtube', 'wikipedia', 'duckduckgo', 'github'],
      },
    },
    required: ['query'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const engine =
      typeof args.engine === 'string' ? args.engine.toLowerCase() : 'google';

    if (!query) {
      return {
        success: false,
        toolName: 'searchWeb',
        summary: 'Search query was empty.',
        error: 'Missing required parameter: query',
      };
    }

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, engine }),
      });

      if (!response.ok) {
        throw new Error(`Search endpoint returned ${response.status}`);
      }

      const data = (await response.json()) as {
        searchUrl: string;
        summarySnippet: string;
      };

      // Also attempt safe anchor launch so if user asked "Search YouTube for lo-fi beats", it launches
      try {
        const anchor = document.createElement('a');
        anchor.href = data.searchUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'hidden';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } catch {
        // Ignore if blocked
      }

      const engineLabel = engine.charAt(0).toUpperCase() + engine.slice(1);

      return {
        success: true,
        toolName: 'searchWeb',
        summary: `Searched ${engineLabel} for "${query}". Context: ${data.summarySnippet}`,
        data: {
          query,
          engine: engineLabel,
          searchUrl: data.searchUrl,
          summarySnippet: data.summarySnippet,
        },
        actionCard: {
          id: `search-${Date.now()}`,
          type: 'search',
          title: `${engineLabel}: "${query}"`,
          subtitle: data.summarySnippet.slice(0, 140),
          url: data.searchUrl,
          timestamp: Date.now(),
          meta: {
            engine: engineLabel,
          },
        },
      };
    } catch (err) {
      const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      return {
        success: true,
        toolName: 'searchWeb',
        summary: `Prepared web search for "${query}" at ${fallbackUrl}`,
        data: {
          query,
          searchUrl: fallbackUrl,
          note: err instanceof Error ? err.message : 'Used direct search URL',
        },
        actionCard: {
          id: `search-${Date.now()}`,
          type: 'search',
          title: `Search: "${query}"`,
          subtitle: fallbackUrl,
          url: fallbackUrl,
          timestamp: Date.now(),
        },
      };
    }
  },
};
