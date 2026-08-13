type ClientErrorKind = 'window.error' | 'unhandledrejection' | 'console.error';

let installed = false;

function safeClientMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name || 'Error'}: ${value.message || 'Unknown error'}`.slice(0, 2_000);
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (value && typeof value === 'object') {
    const name = (value as { constructor?: { name?: string } }).constructor?.name;
    return `[${name || 'Object'}]`;
  }
  return 'Unknown client error';
}

function reportClientError(kind: ClientErrorKind, message: string, line?: number, column?: number): void {
  const cleanMessage = message.trim().slice(0, 2_000);
  if (!cleanMessage) return;
  void fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      message: cleanMessage,
      path: window.location.pathname,
      line: Number.isInteger(line) ? line : undefined,
      column: Number.isInteger(column) ? column : undefined,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function installClientErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    reportClientError('console.error', args.map(safeClientMessage).join(' · '));
  };

  window.addEventListener('error', (event) => {
    reportClientError(
      'window.error',
      event.message || safeClientMessage(event.error),
      event.lineno,
      event.colno,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError('unhandledrejection', safeClientMessage(event.reason));
  });
}
