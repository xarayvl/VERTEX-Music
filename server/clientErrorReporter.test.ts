import assert from "node:assert/strict";
import test from "node:test";
import { formatClientErrorMessage, serializeClientErrorValue } from "../src/errorReporter.js";

test("client error serialization preserves useful object fields without leaking sensitive values", () => {
  const serialized = serializeClientErrorValue({
    code: 4,
    codeName: "MEDIA_ERR_SRC_NOT_SUPPORTED (4)",
    src: "https://vertex.example/api/r2-file/audio.ogg",
    readyState: 0,
    token: "must-not-appear",
  });

  assert.deepEqual(serialized, {
    code: 4,
    codeName: "MEDIA_ERR_SRC_NOT_SUPPORTED (4)",
    src: "https://vertex.example/api/r2-file/audio.ogg",
    readyState: 0,
    token: "[REDACTED]",
  });

  const message = formatClientErrorMessage(["Audio playback failed", serialized]);
  assert.match(message, /"code":4/);
  assert.match(message, /MEDIA_ERR_SRC_NOT_SUPPORTED/);
  assert.doesNotMatch(message, /\[Object\]/);
  assert.doesNotMatch(message, /must-not-appear/);
});

test("client error serialization retains Error diagnostics and handles circular values", () => {
  const error = new Error("Decode failed");
  Object.assign(error, { code: 3, authorization: "Bearer secret-value" });
  const circular: Record<string, unknown> = { error };
  circular.self = circular;

  const serialized = serializeClientErrorValue(circular) as Record<string, unknown>;
  assert.equal(serialized.self, "[Circular]");
  assert.deepEqual(
    Object.fromEntries(Object.entries(serialized.error as Record<string, unknown>).filter(([key]) => key !== "stack")),
    {
      name: "Error",
      message: "Decode failed",
      code: 3,
      authorization: "[REDACTED]",
    },
  );
});
