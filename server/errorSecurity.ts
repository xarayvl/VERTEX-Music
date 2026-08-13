import crypto from "node:crypto";

export type PublicErrorPayload = {
  error: string;
  code: string;
  correlationId: string;
  [key: string]: unknown;
};

const SECRET_ASSIGNMENT_PATTERN = /\b(api[_-]?key|access[_-]?key(?:[_-]?id)?|secret(?:[_-]?access)?[_-]?key|authorization|token)\b(\s*[:=]\s*)(["']?)[^\s,"'}\]]+\3/gi;

export function createCorrelationId(): string {
  return crypto.randomUUID();
}

export function buildPublicError(
  code: string,
  message: string,
  correlationId: string,
  extra: Record<string, unknown> = {},
): PublicErrorPayload {
  return {
    ...extra,
    error: message,
    code,
    correlationId,
  };
}

export function redactLogText(value: unknown, configuredSecrets: readonly (string | undefined)[] = []): string {
  let text = typeof value === "string" ? value : String(value ?? "Unknown error");

  text = text
    .replace(/\bBearer\s+[^\s,"'}\]]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/\bnvapi-[A-Za-z0-9_-]+\b/gi, "[REDACTED_NVIDIA_KEY]")
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, label: string, separator: string) => `${label}${separator}[REDACTED]`);

  for (const secret of configuredSecrets) {
    const cleanSecret = secret?.trim();
    if (cleanSecret && cleanSecret.length >= 4) text = text.split(cleanSecret).join("[REDACTED]");
  }

  return text.slice(0, 2_000);
}

export function safeErrorDetails(
  error: unknown,
  configuredSecrets: readonly (string | undefined)[] = [],
): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { message: redactLogText(error, configuredSecrets) };
  }

  const candidate = error as Record<string, unknown>;
  const details: Record<string, unknown> = {
    name: redactLogText(candidate.name || "Error", configuredSecrets),
    message: redactLogText(candidate.message || "Unknown error", configuredSecrets),
  };
  for (const key of ["code", "status", "statusCode", "requestId", "request_id"]) {
    const value = candidate[key];
    if (typeof value === "string" || typeof value === "number") {
      details[key] = typeof value === "string" ? redactLogText(value, configuredSecrets) : value;
    }
  }
  return details;
}
