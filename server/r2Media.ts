const R2_PROXY_PREFIX = '/api/r2-file/';

function normalizeStorageKey(value: string): string | null {
  try {
    const key = decodeURIComponent(value).replace(/\\/g, '/');
    if (
      !key ||
      key.startsWith('/') ||
      key.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) return null;
    return key;
  } catch {
    return null;
  }
}

function encodedStorageKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function isR2DevelopmentHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'r2.dev' || normalized.endsWith('.r2.dev');
}

export function normalizeR2PublicBaseUrl(configured: string | undefined): string | null {
  const value = configured?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('invalid R2 public origin');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('R2_PUBLIC_DOMAIN must be a valid HTTPS media origin.');
  }
}

/**
 * Cloudflare's temporary r2.dev URL is useful for bucket setup, but it is not
 * a dependable production media origin: public development access may be
 * disabled and its CORS policy may not permit Web Audio. Custom domains can be
 * served directly; r2.dev objects stay behind the authenticated app proxy.
 */
export function canServeR2MediaDirectly(publicBaseUrl: string | null): boolean {
  if (!publicBaseUrl) return false;
  return !isR2DevelopmentHostname(new URL(publicBaseUrl).hostname);
}

export function getManagedStorageKey(mediaUrl: string, publicBaseUrl: string | null): string | null {
  try {
    // URL normalizers collapse encoded dot segments before exposing pathname.
    // Reject them (and encoded separators) while the original text is intact.
    if (/%(?:2e|2f|5c)/i.test(mediaUrl)) return null;
    let rawKey = '';
    if (mediaUrl.startsWith(R2_PROXY_PREFIX)) {
      rawKey = mediaUrl.slice(R2_PROXY_PREFIX.length);
      if (rawKey.includes('?') || rawKey.includes('#')) return null;
    } else if (publicBaseUrl) {
      const media = new URL(mediaUrl);
      const configured = new URL(publicBaseUrl);
      if (media.origin !== configured.origin || media.search || media.hash) return null;
      const configuredPath = configured.pathname.replace(/^\/+|\/+$/g, '');
      const mediaPath = media.pathname.replace(/^\/+/, '');
      if (configuredPath && !mediaPath.startsWith(`${configuredPath}/`)) return null;
      rawKey = configuredPath ? mediaPath.slice(configuredPath.length + 1) : mediaPath;
    }
    return normalizeStorageKey(rawKey);
  } catch {
    return null;
  }
}

export function mediaUrlForKey(key: string, publicBaseUrl: string | null): string {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) throw new Error('Invalid R2 object key.');
  const encodedKey = encodedStorageKey(normalizedKey);
  return canServeR2MediaDirectly(publicBaseUrl)
    ? `${publicBaseUrl}/${encodedKey}`
    : `${R2_PROXY_PREFIX}${encodedKey}`;
}

/** Convert URLs persisted by older releases back to the reliable proxy form. */
export function canonicalizeLegacyR2DevMediaUrl(value: string): string {
  try {
    if (/%(?:2e|2f|5c)/i.test(value)) return value;
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !isR2DevelopmentHostname(parsed.hostname)) return value;
    const key = normalizeStorageKey(parsed.pathname.replace(/^\/+/, ''));
    return key ? `${R2_PROXY_PREFIX}${encodedStorageKey(key)}` : value;
  } catch {
    return value;
  }
}
