import assert from "node:assert/strict";
import test from "node:test";
import { configureErrorLogSecrets, readAdminErrorLog, recordAdminError } from "./errorLog.js";

test("admin error log keeps bounded, redacted operational records without a filesystem sink", async (t) => {
  const previousRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";
  configureErrorLogSecrets(() => ["configured-test-secret"]);
  t.after(() => {
    if (previousRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousRedisUrl;
    if (previousRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousRedisToken;
    configureErrorLogSecrets(() => []);
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

  const listed = await readAdminErrorLog(10);
  const stored = listed.find((entry) => entry.id === record.id && entry.correlationId === "test-correlation-id");
  assert(stored);
  assert(!JSON.stringify(stored).includes("configured-test-secret"));
  assert(!JSON.stringify(stored).includes("must-never-appear"));
});
