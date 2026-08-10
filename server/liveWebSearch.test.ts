import assert from "node:assert/strict";
import test from "node:test";
import { searchLiveWeb } from "./liveWebSearch.js";

const duckDuckGoResultHtml = `
  <div class="result">
    <a class="result__a" href="https://example.com/duck-result">Duck result</a>
    <a class="result__snippet">Primary provider result</a>
  </div>
`;

const braveResultHtml = `
  <div class="snippet result" data-type="web">
    <a class="result-header l1" href="https://example.com/brave-result">
      <div class="search-snippet-title">Brave fallback result</div>
    </a>
    <div class="line-clamp-dynamic">Fallback provider result</div>
  </div>
`;

test("DuckDuckGo is the primary provider and prevents a Brave request on success", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method || "GET" });
    return new Response(duckDuckGoResultHtml, { status: 200, headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  try {
    const result = await searchLiveWeb("new music releases");
    assert.equal(result.provider, "duckduckgo");
    assert.equal(result.engine, "duckduckgo");
    assert.equal(result.sources[0]?.title, "Duck result");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/html\.duckduckgo\.com\/html\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Brave runs only after every DuckDuckGo route is blocked", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method || "GET" });
    if (url.includes("duckduckgo.com")) {
      return new Response('<div class="anomaly-modal">Bots use DuckDuckGo too</div>', { status: 200 });
    }
    return new Response(braveResultHtml, { status: 200, headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;

  try {
    const result = await searchLiveWeb("new music releases");
    assert.equal(result.provider, "web");
    assert.equal(result.engine, "brave");
    assert.equal(result.sources[0]?.title, "Brave fallback result");
    assert.deepEqual(calls.map(({ method }) => method), ["GET", "GET", "POST", "GET"]);
    assert.match(calls[0].url, /html\.duckduckgo\.com/);
    assert.match(calls[1].url, /lite\.duckduckgo\.com/);
    assert.match(calls[2].url, /html\.duckduckgo\.com/);
    assert.match(calls[3].url, /search\.brave\.com/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
