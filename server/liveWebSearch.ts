export type WebSearchSource = {
  title: string;
  uri: string;
  snippet: string;
};

export type LiveWebSearchResult = {
  sources: WebSearchSource[];
  provider: "tavily";
  engine: "tavily";
};

function withTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseTavilyResults(body: any): WebSearchSource[] {
  const results = Array.isArray(body?.results) ? body.results : [];
  const sources: WebSearchSource[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (sources.length >= 5) break;
    const title = typeof result?.title === "string" ? result.title.trim() : "";
    const rawUrl = typeof result?.url === "string" ? result.url.trim() : "";
    if (!title || !isHttpUrl(rawUrl)) continue;

    const uri = new URL(rawUrl).toString();
    if (seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      title: title.slice(0, 300),
      uri,
      snippet: typeof result?.content === "string" ? result.content.trim().slice(0, 1_000) : "",
    });
  }

  return sources;
}

async function searchTavily(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<WebSearchSource[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: query.trim().slice(0, 2_000),
      max_results: 5,
      search_depth: "basic",
    }),
    signal: withTimeoutSignal(signal, 6_000),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(
      body?.detail?.error || body?.error || `Tavily Search API request failed (${response.status}).`,
    );
    error.status = response.status;
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    if (retryAfter > 0) error.retryAfterSeconds = retryAfter;
    throw error;
  }

  return parseTavilyResults(body);
}

const LIVE_WEB_SEARCH_OVERALL_TIMEOUT_MS = 16_000;

export async function searchLiveWeb(
  query: string,
  signal?: AbortSignal,
  overallTimeoutMs = LIVE_WEB_SEARCH_OVERALL_TIMEOUT_MS,
): Promise<LiveWebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    const error: any = new Error("Tavily web search is not configured. Set TAVILY_API_KEY.");
    error.configurationError = true;
    throw error;
  }

  const sources = await searchTavily(query, apiKey, withTimeoutSignal(signal, overallTimeoutMs));
  return { sources, provider: "tavily", engine: "tavily" };
}
