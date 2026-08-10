import {
  parseBraveSearchResponse,
  parseDuckDuckGoLiteResults,
  parseDuckDuckGoResults,
  type WebSearchSource,
} from "./webSearchParsers.js";

export type LiveWebSearchResult = {
  sources: WebSearchSource[];
  provider: "duckduckgo" | "web";
  engine: "duckduckgo" | "brave";
};

function withTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
}

async function fetchDuckDuckGoHtml(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  timeoutMs = 5_000,
): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; VERTEXMusic/1.0)",
      ...init.headers,
    },
    redirect: "follow",
    signal: withTimeoutSignal(signal, timeoutMs),
  });
  const html = await response.text();
  if (!response.ok) {
    const error: any = new Error(`DuckDuckGo Search request failed (${response.status}).`);
    error.status = response.status;
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    if (retryAfter > 0) error.retryAfterSeconds = retryAfter;
    throw error;
  }
  if (html.length > 2_000_000) throw new Error("DuckDuckGo Search returned an unexpectedly large response.");
  if (/unfortunately, bots use duckduckgo too|anomaly-modal/i.test(html)) {
    const error: any = new Error("DuckDuckGo Search rate limit reached.");
    error.status = 429;
    error.retryAfterSeconds = 30;
    throw error;
  }
  return html;
}

export async function searchDuckDuckGo(query: string, signal?: AbortSignal): Promise<WebSearchSource[]> {
  const trimmedQuery = query.trim().slice(0, 2_000);
  const searchParams = new URLSearchParams({ q: trimmedQuery, kl: "wt-wt", kp: "1" });
  let firstError: unknown;
  let receivedSearchPage = false;

  try {
    const htmlUrl = new URL("https://html.duckduckgo.com/html/");
    htmlUrl.search = searchParams.toString();
    const html = await fetchDuckDuckGoHtml(htmlUrl.toString(), { method: "GET" }, signal);
    receivedSearchPage = true;
    const results = parseDuckDuckGoResults(html);
    if (results.length > 0) return results;
  } catch (error) {
    if (signal?.aborted) throw error;
    firstError = error;
  }

  try {
    const liteUrl = new URL("https://lite.duckduckgo.com/lite/");
    liteUrl.search = searchParams.toString();
    const liteHtml = await fetchDuckDuckGoHtml(liteUrl.toString(), { method: "GET" }, signal);
    receivedSearchPage = true;
    const results = parseDuckDuckGoLiteResults(liteHtml);
    if (results.length > 0) return results;
  } catch (error) {
    if (signal?.aborted) throw error;
    firstError ||= error;
  }

  // Some deployments accept the classic POST route while rate-limiting the
  // equivalent GET routes, so keep it as a final DuckDuckGo-native fallback.
  try {
    const html = await fetchDuckDuckGoHtml("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: searchParams,
    }, signal, 5_000);
    receivedSearchPage = true;
    const results = parseDuckDuckGoResults(html);
    if (results.length > 0) return results;
  } catch (error) {
    if (signal?.aborted) throw error;
    firstError ||= error;
  }

  if (receivedSearchPage) return [];
  throw firstError || new Error("DuckDuckGo Search is unavailable.");
}

export async function searchBrave(query: string, signal?: AbortSignal): Promise<WebSearchSource[]> {
  const searchUrl = new URL("https://search.brave.com/search");
  searchUrl.search = new URLSearchParams({ q: query.trim().slice(0, 2_000), source: "web" }).toString();
  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
    redirect: "follow",
    signal: withTimeoutSignal(signal, 5_000),
  });
  const html = await response.text();
  if (!response.ok) {
    const error: any = new Error(`Brave Search request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (html.length > 2_000_000) throw new Error("Brave Search returned an unexpectedly large response.");
  return parseBraveSearchResponse(html);
}

// Hard ceiling on the whole provider chain. Each individual fetch already
// carries its own timeout, but if a hosting network silently stalls
// connections instead of rejecting them quickly, those per-step timeouts can
// still stack up to a very long perceived hang (previously ~49s worst case
// across 4 sequential attempts). This bounds the total wait regardless of
// how many attempts run or how a single step behaves.
const LIVE_WEB_SEARCH_OVERALL_TIMEOUT_MS = 16_000;

export async function searchLiveWeb(
  query: string,
  signal?: AbortSignal,
  overallTimeoutMs = LIVE_WEB_SEARCH_OVERALL_TIMEOUT_MS,
): Promise<LiveWebSearchResult> {
  const overallSignal = withTimeoutSignal(signal, overallTimeoutMs);
  const attempts: Array<{
    provider: LiveWebSearchResult["provider"];
    engine: LiveWebSearchResult["engine"];
    search: () => Promise<WebSearchSource[]>;
  }> = [
    { provider: "duckduckgo", engine: "duckduckgo", search: () => searchDuckDuckGo(query, overallSignal) },
    { provider: "web", engine: "brave", search: () => searchBrave(query, overallSignal) },
  ];

  let emptyResultAttempt: (typeof attempts)[number] | undefined;
  const failures: Array<{ engine: string; status?: number; message: string }> = [];
  for (const attempt of attempts) {
    if (overallSignal.aborted) break;
    try {
      const sources = await attempt.search();
      if (sources.length > 0) return { sources, provider: attempt.provider, engine: attempt.engine };
      emptyResultAttempt ||= attempt;
    } catch (error: any) {
      if (signal?.aborted) throw error;
      failures.push({
        engine: attempt.engine,
        status: Number.isFinite(error?.status) ? Number(error.status) : undefined,
        message: typeof error?.message === "string" ? error.message : "Unknown search error",
      });
      if (overallSignal.aborted) break;
    }
  }

  if (emptyResultAttempt) {
    return { sources: [], provider: emptyResultAttempt.provider, engine: emptyResultAttempt.engine };
  }

  const error: any = new Error(
    `All live web search providers failed: ${failures.map((failure) => (
      `${failure.engine}${failure.status ? ` (${failure.status})` : ""}: ${failure.message}`
    )).join("; ") || "no provider returned a response"}`,
  );
  error.searchFailures = failures;
  throw error;
}
