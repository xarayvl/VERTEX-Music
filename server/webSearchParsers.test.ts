import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBraveSearchResponse,
  parseDuckDuckGoResults,
} from "./webSearchParsers.js";

test("Brave results survive CAPTCHA wording in the localization bundle", () => {
  const html = `
    <script>window.translations = { captcha: "Switch to traditional CAPTCHA" };</script>
    <div class="snippet result" data-type="web">
      <a class="result-header l1" href="https://example.com/new-music">
        <div class="search-snippet-title">New &amp; notable music</div>
      </a>
      <div class="line-clamp-dynamic">Albums released this week.</div>
    </div>
  `;

  assert.deepEqual(parseBraveSearchResponse(html), [{
    title: "New & notable music",
    uri: "https://example.com/new-music",
    snippet: "Albums released this week.",
  }]);
});

test("Brave structural challenge pages are rejected", () => {
  assert.throws(
    () => parseBraveSearchResponse('<form class="challenge-form"><div id="captcha"></div></form>'),
    /verification challenge/i,
  );
});

test("DuckDuckGo redirect links resolve to their source URL", () => {
  const target = encodeURIComponent("https://example.com/story?id=42");
  const html = `
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=${target}">Story title</a>
      <a class="result__snippet">Story summary</a>
    </div>
  `;

  assert.deepEqual(parseDuckDuckGoResults(html), [{
    title: "Story title",
    uri: "https://example.com/story?id=42",
    snippet: "Story summary",
  }]);
});
