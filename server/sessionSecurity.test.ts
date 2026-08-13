import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpaqueSessionToken,
  digestSessionToken,
  isValidOpaqueSessionToken,
  readCookie,
  remainingSessionTtlMs,
  type StoredSessionRecord,
} from "./sessionSecurity.js";

test("opaque session secrets are random and represented in storage only by SHA-256 digests", () => {
  const first = createOpaqueSessionToken();
  const second = createOpaqueSessionToken();

  assert.equal(isValidOpaqueSessionToken(first), true);
  assert.equal(isValidOpaqueSessionToken(second), true);
  assert.notEqual(first, second);
  assert.match(digestSessionToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(digestSessionToken(first), first);
  assert.notEqual(digestSessionToken(first), digestSessionToken(second));
  assert.equal(isValidOpaqueSessionToken("sess_predictable"), false);
});

test("session lifetime is capped by both idle and absolute expiry", () => {
  const record: StoredSessionRecord = {
    userId: "usr_test",
    authVersion: 0,
    createdAt: 1_000,
    lastSeenAt: 2_000,
    idleExpiresAt: 7_000,
    absoluteExpiresAt: 10_000,
  };

  assert.equal(remainingSessionTtlMs(record, 4_000), 3_000);
  assert.equal(remainingSessionTtlMs(record, 7_000), 0);
  assert.equal(remainingSessionTtlMs({ ...record, idleExpiresAt: 20_000 }, 8_000), 2_000);
  assert.equal(remainingSessionTtlMs(record, 20_000), 0);
});

test("cookie parsing reads only the named cookie and rejects malformed encoding", () => {
  assert.equal(readCookie("theme=dark; __Host-vertex_session=sess_value; other=1", "__Host-vertex_session"), "sess_value");
  assert.equal(readCookie("vertex_session=sess_wrong", "__Host-vertex_session"), null);
  assert.equal(readCookie("__Host-vertex_session=%E0%A4%A", "__Host-vertex_session"), null);
});
