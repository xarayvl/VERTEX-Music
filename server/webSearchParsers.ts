export type WebSearchSource = {
  title: string;
  uri: string;
  snippet: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function decodeSearchMarkup(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };

  return value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const codePoint = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    })
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity);
}

function markupToText(value: string): string {
  return decodeSearchMarkup(
    value
      .replace(/^<!\[CDATA\[|\]\]>$/g, "")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function resolveDuckDuckGoResultUrl(rawHref: string): string | null {
  const decodedHref = decodeSearchMarkup(rawHref).trim();
  if (!decodedHref) return null;

  try {
    const redirectUrl = new URL(
      decodedHref.startsWith("//") ? `https:${decodedHref}` : decodedHref,
      "https://duckduckgo.com",
    );
    const targetUrl = redirectUrl.searchParams.get("uddg")?.trim() || redirectUrl.toString();
    if (!isHttpUrl(targetUrl)) return null;
    const parsedTarget = new URL(targetUrl);
    if (!redirectUrl.searchParams.has("uddg") && /(^|\.)duckduckgo\.com$/i.test(parsedTarget.hostname)) return null;
    return parsedTarget.toString();
  } catch {
    return null;
  }
}

export function parseDuckDuckGoResults(html: string): WebSearchSource[] {
  const resultLinkPattern = /<a\b([^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const linkMatches = Array.from(html.matchAll(resultLinkPattern));
  const seen = new Set<string>();

  return linkMatches.flatMap((match, index) => {
    const attributes = match[1] || "";
    const hrefMatch = attributes.match(/\bhref=["']([^"']+)["']/i);
    const uri = hrefMatch ? resolveDuckDuckGoResultUrl(hrefMatch[1]) : null;
    const title = markupToText(match[2] || "");
    if (!uri || !title || seen.has(uri)) return [];

    const resultEnd = index + 1 < linkMatches.length
      ? linkMatches[index + 1].index
      : Math.min(html.length, (match.index ?? 0) + 8_000);
    const followingHtml = html.slice((match.index ?? 0) + match[0].length, resultEnd);
    const snippetMatch = followingHtml.match(
      /<(?:a|div)\b[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i,
    );
    const snippet = snippetMatch ? markupToText(snippetMatch[1]) : "";

    seen.add(uri);
    return [{ title: title.slice(0, 300), uri, snippet: snippet.slice(0, 1_000) }];
  }).slice(0, 5);
}

export function parseDuckDuckGoLiteResults(html: string): WebSearchSource[] {
  const resultLinkPattern = /<a\b([^>]*\bclass=["'][^"']*\bresult-link\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const linkMatches = Array.from(html.matchAll(resultLinkPattern));
  const seen = new Set<string>();

  return linkMatches.flatMap((match, index) => {
    const hrefMatch = (match[1] || "").match(/\bhref=["']([^"']+)["']/i);
    const uri = hrefMatch ? resolveDuckDuckGoResultUrl(hrefMatch[1]) : null;
    const title = markupToText(match[2] || "");
    if (!uri || !title || seen.has(uri)) return [];

    const resultEnd = index + 1 < linkMatches.length ? linkMatches[index + 1].index : html.length;
    const followingHtml = html.slice((match.index ?? 0) + match[0].length, resultEnd);
    const snippetMatch = followingHtml.match(
      /<td\b[^>]*\bclass=["'][^"']*\bresult-snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
    );
    const snippet = snippetMatch ? markupToText(snippetMatch[1]) : "";

    seen.add(uri);
    return [{ title: title.slice(0, 300), uri, snippet: snippet.slice(0, 1_000) }];
  }).slice(0, 5);
}

function parseBraveSearchResults(html: string): WebSearchSource[] {
  const resultPattern = /<div\b(?=[^>]*\bclass=["'][^"']*\bsnippet\b[^"']*["'])(?=[^>]*\bdata-type=["']web["'])[^>]*>/gi;
  const resultMatches = Array.from(html.matchAll(resultPattern));
  const seen = new Set<string>();

  return resultMatches.flatMap((match, index) => {
    const resultEnd = index + 1 < resultMatches.length ? resultMatches[index + 1].index : html.length;
    const resultHtml = html.slice(match.index ?? 0, resultEnd);
    const linkMatch = resultHtml.match(
      /<a\b(?=[^>]*\bclass=["'][^"']*\bl1\b[^"']*["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i,
    );
    const uri = linkMatch ? decodeSearchMarkup(linkMatch[1]).trim() : "";
    const titleMatch = resultHtml.match(
      /<div\b[^>]*\bclass=["'][^"']*\bsearch-snippet-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const snippetMatch = resultHtml.match(
      /<div\b[^>]*\bclass=["'][^"']*\bline-clamp-dynamic\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    const title = titleMatch ? markupToText(titleMatch[1]) : "";
    if (!isHttpUrl(uri) || !title || seen.has(uri)) return [];

    seen.add(uri);
    return [{
      title: title.slice(0, 300),
      uri: new URL(uri).toString(),
      snippet: snippetMatch ? markupToText(snippetMatch[1]).slice(0, 1_000) : "",
    }];
  }).slice(0, 5);
}

export function parseBraveSearchResponse(html: string): WebSearchSource[] {
  // Valid result pages include generic CAPTCHA wording in Brave's localization
  // bundle, so actual result blocks must win over text-only challenge hints.
  const results = parseBraveSearchResults(html);
  if (results.length > 0) return results;
  if (/\bclass=["'][^"']*\bchallenge-form\b|\bid=["'](?:captcha|challenge)["']|\bcf-chl-/i.test(html)) {
    throw new Error("Brave Search returned a verification challenge.");
  }
  return [];
}
