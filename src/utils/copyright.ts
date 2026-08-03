const COPYRIGHT_PREFIX_PATTERN = /^(?:©|\(c\))\s*/i;

export function stripCopyrightPrefix(value: string): string {
  return value.trim().replace(COPYRIGHT_PREFIX_PATTERN, '').trimStart();
}

export function formatCopyright(value: string): string {
  const body = stripCopyrightPrefix(value);
  return body ? `© ${body}` : '©';
}
