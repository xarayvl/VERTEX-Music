type ClientErrorKind = 'window.error' | 'unhandledrejection' | 'console.error';

const MAX_CLIENT_MESSAGE_LENGTH = 2_000;
const MAX_CLIENT_STRING_LENGTH = 8_000;
const MAX_CLIENT_DETAIL_DEPTH = 4;
const MAX_CLIENT_ARRAY_ITEMS = 20;
const MAX_CLIENT_OBJECT_FIELDS = 30;
const SENSITIVE_KEY_PATTERN = /password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|access[_-]?key/i;

let installed = false;

function redactClientText(value: string): string {
  return value
    .slice(0, MAX_CLIENT_STRING_LENGTH)
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED]')
    .replace(/\bnvapi-[A-Za-z0-9._-]+\b/gi, '[REDACTED]')
    .replace(
      /\b(password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|access[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1=[REDACTED]',
    );
}

function constructorName(value: object): string {
  try {
    return value.constructor?.name || 'Object';
  } catch {
    return 'Object';
  }
}

function serializeClientErrorValueInternal(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > MAX_CLIENT_DETAIL_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') return redactClientText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean' || value === null) return value;
  if (value === undefined) return '[undefined]';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value !== 'object') return redactClientText(String(value));

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();

    if (value instanceof Error) {
      const error = value as Error & { cause?: unknown; code?: unknown };
      const output: Record<string, unknown> = {
        name: redactClientText(error.name || 'Error'),
        message: redactClientText(error.message || 'Unknown error'),
      };
      if (error.stack) output.stack = redactClientText(error.stack);
      if (error.code !== undefined) output.code = serializeClientErrorValueInternal(error.code, seen, depth + 1);
      if (error.cause !== undefined) output.cause = serializeClientErrorValueInternal(error.cause, seen, depth + 1);

      for (const key of Object.keys(error).slice(0, MAX_CLIENT_OBJECT_FIELDS)) {
        if (key in output) continue;
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          output[key] = '[REDACTED]';
          continue;
        }
        try {
          output[key] = serializeClientErrorValueInternal((error as unknown as Record<string, unknown>)[key], seen, depth + 1);
        } catch {
          output[key] = '[Unreadable property]';
        }
      }
      return output;
    }

    if (Array.isArray(value)) {
      const output = value
        .slice(0, MAX_CLIENT_ARRAY_ITEMS)
        .map((item) => serializeClientErrorValueInternal(item, seen, depth + 1));
      if (value.length > MAX_CLIENT_ARRAY_ITEMS) output.push(`[${value.length - MAX_CLIENT_ARRAY_ITEMS} more items]`);
      return output;
    }

    const output: Record<string, unknown> = {};
    const typeName = constructorName(value);
    if (typeName !== 'Object') output.type = typeName;

    const keys = Object.keys(value);
    for (const key of keys.slice(0, MAX_CLIENT_OBJECT_FIELDS)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[REDACTED]';
        continue;
      }
      try {
        output[key] = serializeClientErrorValueInternal((value as Record<string, unknown>)[key], seen, depth + 1);
      } catch {
        output[key] = '[Unreadable property]';
      }
    }

    // Browser error types such as DOMException and MediaError expose their
    // useful fields as non-enumerable properties, so preserve those too.
    for (const key of ['name', 'message', 'code'] as const) {
      if (key in output || !(key in value)) continue;
      try {
        output[key] = serializeClientErrorValueInternal((value as Record<string, unknown>)[key], seen, depth + 1);
      } catch {
        output[key] = '[Unreadable property]';
      }
    }

    if (keys.length > MAX_CLIENT_OBJECT_FIELDS) {
      output.truncatedFields = keys.length - MAX_CLIENT_OBJECT_FIELDS;
    }
    return output;
  } finally {
    seen.delete(value);
  }
}

export function serializeClientErrorValue(value: unknown): unknown {
  return serializeClientErrorValueInternal(value, new WeakSet<object>(), 0);
}

export function formatClientErrorMessage(values: unknown[]): string {
  const message = values.map((value) => {
    const serialized = serializeClientErrorValue(value);
    if (typeof serialized === 'string') return serialized;
    try {
      return JSON.stringify(serialized);
    } catch {
      return 'Unserializable client error';
    }
  }).join(' · ').trim();
  return message.slice(0, MAX_CLIENT_MESSAGE_LENGTH);
}

function reportClientError(
  kind: ClientErrorKind,
  message: string,
  details?: Record<string, unknown>,
  line?: number,
  column?: number,
): void {
  // Every caller has already passed its values through the structured,
  // redacting serializer. Avoid processing the resulting JSON a second time,
  // which could consume quote characters around a redacted Bearer value.
  const cleanMessage = message.trim().slice(0, MAX_CLIENT_MESSAGE_LENGTH);
  if (!cleanMessage) return;
  void fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      message: cleanMessage,
      details,
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
    const serializedArguments = args.map(serializeClientErrorValue);
    reportClientError('console.error', formatClientErrorMessage(args), { arguments: serializedArguments });
  };

  window.addEventListener('error', (event) => {
    const errorValue = event.error ?? event.message;
    reportClientError(
      'window.error',
      formatClientErrorMessage([event.message || errorValue]),
      {
        error: serializeClientErrorValue(errorValue),
        filename: redactClientText(event.filename || window.location.href),
      },
      event.lineno,
      event.colno,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(
      'unhandledrejection',
      formatClientErrorMessage([event.reason]),
      { reason: serializeClientErrorValue(event.reason) },
    );
  });
}
