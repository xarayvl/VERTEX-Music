import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { configureErrorLogSecrets, readAdminErrorLog, recordAdminError } from "./errorLog.js";

test("admin error log persists bounded, redacted operational records", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vertex-error-log-test-"));
  const previousFile = process.env.VERTEX_ERROR_LOG_FILE;
  const logFile = path.join(tempDir, "errors.jsonl");
  process.env.VERTEX_ERROR_LOG_FILE = logFile;
  configureErrorLogSecrets(() => ["configured-test-secret"]);
  t.after(async () => {
    if (previousFile === undefined) delete process.env.VERTEX_ERROR_LOG_FILE;
    else process.env.VERTEX_ERROR_LOG_FILE = previousFile;
    configureErrorLogSecrets(() => []);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const record = recordAdminError({
    origin: "server",
    source: "Test provider",
    message: "failed token=configured-test-secret",
    code: "TEST_FAILURE",
    status: 502,
    correlationId: "test-correlation-id",
    method: "POST",
    path: "/api/test",
    userId: "usr_test",
    details: {
      password: "must-never-appear",
      authorization: "Bearer must-never-appear",
      nested: { safe: "visible" },
    },
  });
  assert.equal(record.message, "failed token=[REDACTED]");
  assert.deepEqual(record.details, {
    password: "[REDACTED]",
    authorization: "[REDACTED]",
    nested: { safe: "visible" },
  });

  const deadline = Date.now() + 2_000;
  let stored = "";
  while (Date.now() < deadline) {
    stored = await fs.readFile(logFile, "utf8").catch(() => "");
    if (stored.includes(record.id)) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert(stored.includes(record.id));
  assert(!stored.includes("configured-test-secret"));
  assert(!stored.includes("must-never-appear"));

  const listed = await readAdminErrorLog(10);
  assert(listed.some((entry) => entry.id === record.id && entry.correlationId === "test-correlation-id"));
});
