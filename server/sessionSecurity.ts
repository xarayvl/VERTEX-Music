import crypto from "node:crypto";

export interface StoredSessionRecord {
  userId: string;
  authVersion: number;
  createdAt: number;
  lastSeenAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}

const SESSION_TOKEN_PATTERN = /^sess_[A-Za-z0-9_-]{43}$/;

export function createOpaqueSessionToken(): string {
  return `sess_${crypto.randomBytes(32).toString("base64url")}`;
}

export function isValidOpaqueSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

export function digestSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function remainingSessionTtlMs(record: StoredSessionRecord, now = Date.now()): number {
  return Math.max(0, Math.min(record.idleExpiresAt, record.absoluteExpiresAt) - now);
}

export function isStoredSessionRecord(value: unknown): value is StoredSessionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredSessionRecord>;
  return Boolean(
    typeof record.userId === "string" && record.userId.trim() &&
    Number.isInteger(record.authVersion) && record.authVersion! >= 0 &&
    Number.isFinite(record.createdAt) &&
    Number.isFinite(record.lastSeenAt) &&
    Number.isFinite(record.idleExpiresAt) &&
    Number.isFinite(record.absoluteExpiresAt) &&
    record.createdAt! <= record.lastSeenAt! &&
    record.lastSeenAt! <= record.idleExpiresAt! &&
    record.createdAt! < record.absoluteExpiresAt!
  );
}

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader || !name) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const rawValue = part.slice(separator + 1).trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }
  return null;
}
