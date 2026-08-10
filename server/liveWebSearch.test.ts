import assert from "node:assert/strict";
import test from "node:test";
import { searchLiveWeb } from "./liveWebSearch.js";

function restoreApiKey(value: string | undefined) {
  if (value === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = value;
}

test("Tavily is the only live web search provider", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TAVILY_API_KEY;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  process.env.TAVILY_API_KEY = "tvly-test-key";
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      results: [
        {
          title: " New music releases ",
          url: "https://example.com/releases",
          content: " Albums released this week. ",
        },
        { title: "Invalid URL", url: "javascript:alert(1)", content: "Ignored" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await searchLiveWeb("new music releases");

    assert.equal(result.provider, "tavily");
    assert.equal(result.engine, "tavily");
    assert.deepEqual(result.sources, [{
      title: "New music releases",
      uri: "https://example.com/releases",
      snippet: "Albums released this week.",
    }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.tavily.com/search");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer tvly-test-key");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      query: "new music releases",
      max_results: 5,
      search_depth: "basic",
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiKey(originalApiKey);
  }
});

test("live web search requires a Tavily API key", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TAVILY_API_KEY;
  let fetchCalled = false;
  delete process.env.TAVILY_API_KEY;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    await assert.rejects(
      searchLiveWeb("new music releases"),
      (error: any) => error?.configurationError === true && /TAVILY_API_KEY/.test(error.message),
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiKey(originalApiKey);
  }
});

test("Tavily API failures preserve provider details", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = "tvly-test-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    detail: { error: "Search quota exceeded." },
  }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "30" },
  })) as typeof fetch;

  try {
    await assert.rejects(
      searchLiveWeb("new music releases"),
      (error: any) => (
        error?.message === "Search quota exceeded."
        && error?.status === 429
        && error?.retryAfterSeconds === 30
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreApiKey(originalApiKey);
  }
});
