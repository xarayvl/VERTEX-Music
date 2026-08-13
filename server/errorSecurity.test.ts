import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPublicError, createCorrelationId, redactLogText, safeErrorDetails } from "./errorSecurity.js";

test("public errors contain a stable code and opaque correlation id", () => {
  const firstId = createCorrelationId();
  const secondId = createCorrelationId();
  assert.match(firstId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(firstId, secondId);
  assert.deepEqual(buildPublicError("STORAGE_UPLOAD_FAILED", "Upload failed.", firstId, { success: false }), {
    success: false,
    error: "Upload failed.",
    code: "STORAGE_UPLOAD_FAILED",
    correlationId: firstId,
  });
});

test("log details redact configured, bearer, AWS, and NVIDIA credentials", () => {
  const secret = "nvidia-super-secret-value";
  const details = safeErrorDetails(
    new Error(`authorization=Bearer nvapi-visible-secret api_key=${secret} access=AKIAIOSFODNN7EXAMPLE`),
    [secret],
  );
  const serialized = JSON.stringify(details);

  assert(!serialized.includes(secret));
  assert(!serialized.includes("nvapi-visible-secret"));
  assert(!serialized.includes("AKIAIOSFODNN7EXAMPLE"));
  assert.match(serialized, /REDACTED/);
  assert.equal(redactLogText(`token: ${secret}`, [secret]), "token: [REDACTED]");
});

test("server handlers do not expose raw exception messages or secret fragments", () => {
  const serverSource = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "server.ts"),
    "utf8",
  );
  assert.doesNotMatch(serverSource, /error\s*:\s*error\?*\.message/);
  assert.doesNotMatch(serverSource, /apiKey\.slice\s*\(/);
  assert.doesNotMatch(serverSource, /keyFingerprint/);
});
