import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getUpstashClient } from "./db.js";
import { createCorrelationId, redactLogText, safeErrorDetails } from "./errorSecurity.js";

const ERROR_LOG_REDIS_KEY = "app:admin:error-log:v1";
const MAX_ERROR_RECORDS = 1_000;
const MAX_LOCAL_LOG_BYTES = 5 * 1024 * 1024;
const SENSITIVE_KEY_PATTERN = /password|passwd|secret|token|authorization|cookie|credential|api[_-]?key|access[_-]?key/i;
const INSTANCE_ID = `instance_${crypto.randomUUID()}`;

export type ErrorLogOrigin = "server" | "client";

export interface AdminErrorLogRecord {
  id: string;
  correlationId: string;
  timestamp: string;
  origin: ErrorLogOrigin;
  source: string;
  message: string;
  code: string | null;
  status: number | null;
  method: string | null;
  path: string | null;
  userId: string | null;
  instanceId: string;
  details: Record<string, unknown> | null;
}

export interface ErrorRequestContext {
  correlationId: string;
  method: string;
  path: string;
  userId: string | null;
  errorRecorded: boolean;
}

type RecordErrorInput = Partial<Omit<AdminErrorLogRecord, "id" | "timestamp" | "instanceId">> & {
  source: string;
  message: string;
};

const requestContext = new AsyncLocalStorage<ErrorRequestContext>();
const memoryRecords: AdminErrorLogRecord[] = [];
let secretProvider: () => readonly (string | undefined)[] = () => [];
let consoleCaptureInstalled = false;
let fileWriteChain: Promise<void> = Promise.resolve();
let redisWriteChain: Promise<void> = Promise.resolve();
let localWriteCount = 0;

function configuredSecrets(): readonly (string | undefined)[] {
  try {
    return secretProvider();
  } catch {
    return [];
  }
}

function errorLogFile(): string {
  const configured = process.env.VERTEX_ERROR_LOG_FILE?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data", "error-log.jsonl");
}

function boundedText(value: unknown, maxLength: number, fallback = ""): string {
  const clean = redactLogText(value, configuredSecrets()).trim();
  return (clean || fallback).slice(0, maxLength);
}

function boundedStatus(value: unknown): number | null {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[TRUNCATED]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return boundedText(value, 2_000);
  if (value instanceof Error) return safeErrorDetails(value, configuredSecrets());
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeLogValue(item, depth + 1));
  if (typeof value !== "object") return boundedText(value, 2_000);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    const safeKey = boundedText(key, 100, "field");
    output[safeKey] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeLogValue(item, depth + 1);
  }
  return output;
}

function isErrorLogRecord(value: unknown): value is AdminErrorLogRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdminErrorLogRecord>;
  return typeof candidate.id === "string"
    && typeof candidate.correlationId === "string"
    && typeof candidate.timestamp === "string"
    && !Number.isNaN(Date.parse(candidate.timestamp))
    && (candidate.origin === "server" || candidate.origin === "client")
    && typeof candidate.source === "string"
    && typeof candidate.message === "string"
    && typeof candidate.instanceId === "string";
}

function parseStoredRecord(value: unknown): AdminErrorLogRecord | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!isErrorLogRecord(parsed)) return null;
    return {
      id: boundedText(parsed.id, 200),
      correlationId: boundedText(parsed.correlationId, 200),
      timestamp: new Date(parsed.timestamp).toISOString(),
      origin: parsed.origin,
      source: boundedText(parsed.source, 200, "Application error"),
      message: boundedText(parsed.message, 2_000, "Unknown error"),
      code: parsed.code ? boundedText(parsed.code, 120) : null,
      status: boundedStatus(parsed.status),
      method: parsed.method ? boundedText(parsed.method, 16).toUpperCase() : null,
      path: parsed.path ? boundedText(parsed.path, 500) : null,
      userId: parsed.userId ? boundedText(parsed.userId, 200) : null,
      instanceId: boundedText(parsed.instanceId, 200),
      details: parsed.details && typeof parsed.details === "object"
        ? sanitizeLogValue(parsed.details) as Record<string, unknown>
        : null,
    };
  } catch {
    return null;
  }
}

async function trimLocalLogIfNeeded(file: string): Promise<void> {
  localWriteCount += 1;
  if (localWriteCount % 100 !== 0) return;
  const stats = await fs.promises.stat(file);
  if (stats.size <= MAX_LOCAL_LOG_BYTES) return;
  const content = await fs.promises.readFile(file, "utf8");
  const retained = content.split("\n").filter(Boolean).slice(-MAX_ERROR_RECORDS);
  await fs.promises.writeFile(file, retained.length ? `${retained.join("\n")}\n` : "", "utf8");
}

function persistRecord(record: AdminErrorLogRecord): void {
  const file = errorLogFile();
  fileWriteChain = fileWriteChain
    .catch(() => undefined)
    .then(async () => {
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      await fs.promises.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
      await trimLocalLogIfNeeded(file);
    })
    .catch(() => undefined);

  redisWriteChain = redisWriteChain
    .catch(() => undefined)
    .then(async () => {
      const redis = getUpstashClient();
      if (!redis) return;
      await redis.lpush(ERROR_LOG_REDIS_KEY, JSON.stringify(record));
      await redis.ltrim(ERROR_LOG_REDIS_KEY, 0, MAX_ERROR_RECORDS - 1);
    })
    .catch(() => undefined);
}

export function configureErrorLogSecrets(provider: () => readonly (string | undefined)[]): void {
  secretProvider = provider;
}

export function runWithErrorContext<T>(context: ErrorRequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function setErrorContextUserId(userId: string): void {
  const context = requestContext.getStore();
  if (context) context.userId = boundedText(userId, 200) || null;
}

export function recordAdminError(input: RecordErrorInput): AdminErrorLogRecord {
  const context = requestContext.getStore();
  if (context) context.errorRecorded = true;
  const correlationId = boundedText(input.correlationId || context?.correlationId || createCorrelationId(), 200);
  const details = input.details && typeof input.details === "object"
    ? sanitizeLogValue(input.details) as Record<string, unknown>
    : null;
  const record: AdminErrorLogRecord = {
    id: `error_${crypto.randomUUID()}`,
    correlationId,
    timestamp: new Date().toISOString(),
    origin: input.origin === "client" ? "client" : "server",
    source: boundedText(input.source, 200, "Application error"),
    message: boundedText(input.message, 2_000, "Unknown error"),
    code: input.code ? boundedText(input.code, 120) : null,
    status: boundedStatus(input.status),
    method: input.method ? boundedText(input.method, 16).toUpperCase() : context?.method || null,
    path: input.path ? boundedText(input.path, 500) : context?.path || null,
    userId: input.userId ? boundedText(input.userId, 200) : context?.userId || null,
    instanceId: INSTANCE_ID,
    details,
  };

  memoryRecords.unshift(record);
  if (memoryRecords.length > MAX_ERROR_RECORDS) memoryRecords.length = MAX_ERROR_RECORDS;
  persistRecord(record);
  return record;
}

function extractConsoleField(args: unknown[], key: string): unknown {
  for (const value of args) {
    if (value && typeof value === "object" && key in value) return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function consoleErrorMessage(args: unknown[]): string {
  for (const value of args) {
    if (value instanceof Error) return boundedText(value.message, 2_000, "Unknown error");
    if (value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string") {
      return boundedText((value as { message: string }).message, 2_000, "Unknown error");
    }
  }
  return boundedText(args.find((value) => typeof value === "string") || "Unknown error", 2_000, "Unknown error");
}

function consoleErrorSource(args: unknown[]): string {
  const candidate = boundedText(args.find((value) => typeof value === "string") || "Server error", 200, "Server error")
    .split("\n", 1)[0]
    .replace(/:\s*$/, "")
    .trim();
  return candidate.length <= 120 && !candidate.includes("DeprecationWarning")
    ? candidate
    : "Server console error";
}

export function installSecureConsoleErrorCapture(): void {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;
  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    const safeArgs = args.map((value) => sanitizeLogValue(value));
    originalConsoleError(...safeArgs);

    recordAdminError({
      origin: "server",
      source: consoleErrorSource(args),
      message: consoleErrorMessage(args),
      correlationId: typeof extractConsoleField(args, "correlationId") === "string"
        ? String(extractConsoleField(args, "correlationId"))
        : undefined,
      code: typeof extractConsoleField(args, "code") === "string"
        ? String(extractConsoleField(args, "code"))
        : null,
      status: boundedStatus(extractConsoleField(args, "status") ?? extractConsoleField(args, "statusCode")),
      details: { arguments: safeArgs.slice(1) },
    });
  };
}

export function installProcessErrorCapture(): void {
  const marker = Symbol.for("vertex.processErrorCaptureInstalled");
  const processWithMarker = process as typeof process & { [marker]?: boolean };
  if (processWithMarker[marker]) return;
  processWithMarker[marker] = true;

  process.on("uncaughtExceptionMonitor", (error, origin) => {
    console.error("Uncaught exception:", { origin }, error);
  });
}

export async function readAdminErrorLog(limit = 500): Promise<AdminErrorLogRecord[]> {
  const boundedLimit = Math.max(1, Math.min(MAX_ERROR_RECORDS, Math.floor(limit)));
  const collected: AdminErrorLogRecord[] = [...memoryRecords];

  try {
    const content = await fs.promises.readFile(errorLogFile(), "utf8");
    for (const line of content.split("\n").filter(Boolean).slice(-MAX_ERROR_RECORDS)) {
      const record = parseStoredRecord(line);
      if (record) collected.push(record);
    }
  } catch {
    // The local log is an optional persistence fallback and may not exist yet.
  }

  try {
    const redis = getUpstashClient();
    if (redis) {
      const remoteRecords = await redis.lrange<unknown>(ERROR_LOG_REDIS_KEY, 0, MAX_ERROR_RECORDS - 1);
      for (const value of remoteRecords) {
        const record = parseStoredRecord(value);
        if (record) collected.push(record);
      }
    }
  } catch {
    // Never make the admin dashboard unavailable because the log sink is down.
  }

  const unique = new Map<string, AdminErrorLogRecord>();
  for (const record of collected) if (!unique.has(record.id)) unique.set(record.id, record);
  return [...unique.values()]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, boundedLimit);
}
