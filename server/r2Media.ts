const R2_PROXY_PREFIX = '/api/r2-file/';
const LEGACY_R2_PRIVATE_PREFIX = '/api/r2-private/';
const LEGACY_MEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'jpg', 'png', 'webp']);
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const LEGACY_UPLOAD_FILE_PATTERN = new RegExp(`^(audio|image)_(${UUID_PATTERN})\\.([a-z0-9]+)$`, 'i');

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

function legacyPrivateStorageKey(value: string): string | null {
  if (!value.startsWith(LEGACY_R2_PRIVATE_PREFIX) || /%(?:2e|2f|5c)/i.test(value)) return null;
  const rawKey = value.slice(LEGACY_R2_PRIVATE_PREFIX.length);
  if (rawKey.includes('?') || rawKey.includes('#')) return null;
  const key = normalizeStorageKey(rawKey);
  if (!key) return null;

  const segments = key.split('/');
  if (segments.length !== 3 || segments[0] !== 'private' || !/^[a-zA-Z0-9_-]+$/.test(segments[1])) return null;
  const fileMatch = segments[2].match(LEGACY_UPLOAD_FILE_PATTERN);
  if (!fileMatch || !LEGACY_MEDIA_EXTENSIONS.has(fileMatch[3].toLowerCase())) return null;
  const kind = fileMatch[1].toLowerCase();
  const extension = fileMatch[3].toLowerCase();
  const isImageExtension = extension === 'jpg' || extension === 'png' || extension === 'webp';
  if ((kind === 'image') !== isImageExtension) return null;
  return key;
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

export function getManagedStorageKey(mediaUrl: string, legacyPublicBaseUrl: string | null = null): string | null {
  try {
    // URL normalizers collapse encoded dot segments before exposing pathname.
    // Reject them (and encoded separators) while the original text is intact.
    if (/%(?:2e|2f|5c)/i.test(mediaUrl)) return null;
    let rawKey = '';
    if (mediaUrl.startsWith(R2_PROXY_PREFIX)) {
      rawKey = mediaUrl.slice(R2_PROXY_PREFIX.length);
      if (rawKey.includes('?') || rawKey.includes('#')) return null;
    } else if (mediaUrl.startsWith(LEGACY_R2_PRIVATE_PREFIX)) {
      return legacyPrivateStorageKey(mediaUrl);
    } else if (legacyPublicBaseUrl) {
      const media = new URL(mediaUrl);
      const configured = new URL(legacyPublicBaseUrl);
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

/** Every managed read goes through the SDK-backed proxy and one R2 bucket. */
export function mediaUrlForKey(key: string): string {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) throw new Error('Invalid R2 object key.');
  return `${R2_PROXY_PREFIX}${encodedStorageKey(normalizedKey)}`;
}

/** Convert every legacy managed URL to the one-bucket proxy representation. */
export function canonicalizeManagedMediaUrl(value: string, legacyPublicBaseUrl: string | null = null): string {
  try {
    const privateKey = legacyPrivateStorageKey(value);
    if (privateKey) return mediaUrlForKey(privateKey);

    const configuredKey = getManagedStorageKey(value, legacyPublicBaseUrl);
    if (configuredKey) return mediaUrlForKey(configuredKey);

    if (/%(?:2e|2f|5c)/i.test(value)) return value;
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !isR2DevelopmentHostname(parsed.hostname)) return value;
    const key = normalizeStorageKey(parsed.pathname.replace(/^\/+/, ''));
    return key ? mediaUrlForKey(key) : value;
  } catch {
    return value;
  }
}
