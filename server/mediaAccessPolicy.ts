export type MediaStorageScope = 'public' | 'private' | 'legacy';

export function classifyMediaStorageKey(key: string): MediaStorageScope {
  if (key.startsWith('public/')) return 'public';
  if (key.startsWith('private/')) return 'private';
  return 'legacy';
}

export function getPrivateMediaOwner(key: string): string | null {
  const match = key.match(/^private\/([a-zA-Z0-9_-]+)\/(?:audio|image)_[0-9a-f-]{36}\.[a-z0-9]+$/i);
  return match?.[1] || null;
}
