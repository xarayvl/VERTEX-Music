/**
 * Guards every place a user-typed or user-uploaded string is assigned to a
 * DOM `src`/`href`-style attribute (e.g. `<img src>`).
 *
 * Without this check, a free-text "cover URL" / "avatar URL" / "banner URL"
 * field lets a user type things like `javascript:alert(1)` or
 * `data:text/html,<script>...</script>` instead of an image link. The
 * browser then reinterprets that attacker-controlled *text* as executable
 * markup/script when the attribute is rendered — this is exactly what
 * CodeQL's "DOM text reinterpreted as HTML" (js/xss-through-dom) query
 * flags.
 *
 * `getSafeImageUrl` only allows:
 *  - absolute http(s) URLs, and
 *  - base64 JPEG, PNG, and WebP URIs produced by our FileReader upload flow.
 *
 * Anything else — including `javascript:`, `vbscript:`, `data:text/*`,
 * relative paths that resolve unexpectedly, or malformed input — falls back
 * to the provided placeholder instead of ever reaching the DOM.
 */
export function getSafeImageUrl(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;

  // Keep this allowlist aligned with the server-side magic-byte validator.
  if (trimmed.toLowerCase().startsWith('data:')) {
    return /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/]+=*$/i.test(trimmed)
      ? trimmed
      : fallback;
  }

  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : undefined);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}
