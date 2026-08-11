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
 *  - `data:image/...;base64,` URIs produced by our own FileReader upload
 *    flow — any real image subtype (png, jpeg, gif, webp, avif, bmp, tiff,
 *    x-icon, heic, ...) EXCEPT `svg+xml`, since inline SVG can carry
 *    <script>/event-handler payloads even though it's technically an image.
 *
 * Anything else — including `javascript:`, `vbscript:`, `data:text/*`,
 * relative paths that resolve unexpectedly, or malformed input — falls back
 * to the provided placeholder instead of ever reaching the DOM.
 */
export function getSafeImageUrl(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;

  // Uploaded files: allow any base64 image data URI our own upload handlers
  // can produce (they already reject non-"image/*" files before reading),
  // except SVG — inline SVG can carry <script>/event-handler payloads.
  if (trimmed.toLowerCase().startsWith('data:')) {
    const match = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/]+=*)$/i.exec(trimmed);
    return match && !/svg/i.test(match[1]) ? trimmed : fallback;
  }

  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : undefined);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}
