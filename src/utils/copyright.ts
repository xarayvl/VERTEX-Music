const COPYRIGHT_PREFIX_PATTERN = /^\s*(?:©|\(c\))[ \t]*/i;

export function stripCopyrightPrefix(value: string): string {
  const prefixMatch = value.match(COPYRIGHT_PREFIX_PATTERN);
  if (!prefixMatch) return value;
  return value.slice(prefixMatch[0].length).replace(/^\d{4}\b[ \t]*/, '');
}

export function formatCopyright(value: string, releaseYear = new Date().getFullYear()): string {
  const safeYear = Number.isInteger(releaseYear) ? releaseYear : new Date().getFullYear();
  const body = stripCopyrightPrefix(value).trim();
  return `© ${safeYear}${body ? ` ${body}` : ''}`;
}
