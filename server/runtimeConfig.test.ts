import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredPublicBaseUrl,
  getOptionalPrivateR2BucketName,
  getRuntimePort,
} from "./runtimeConfig.js";

test("missing private R2 bucket disables staging without reusing the public bucket", () => {
  assert.equal(getOptionalPrivateR2BucketName(undefined, "vertex-public"), null);
  assert.equal(getOptionalPrivateR2BucketName("  ", "vertex-public"), null);
});

test("configured private R2 bucket must remain distinct from the public bucket", () => {
  assert.equal(getOptionalPrivateR2BucketName(" vertex-private ", "vertex-public"), "vertex-private");
  assert.throws(
    () => getOptionalPrivateR2BucketName("vertex-public", "vertex-public"),
    /must be different/,
  );
});

test("runtime port honors hosting configuration and validates its range", () => {
  assert.equal(getRuntimePort(undefined), 3000);
  assert.equal(getRuntimePort("10000"), 10000);
  assert.throws(() => getRuntimePort("0"), /between 1 and 65535/);
  assert.throws(() => getRuntimePort("not-a-port"), /between 1 and 65535/);
});

test("Render external URL is a fallback, not an override", () => {
  assert.equal(
    getConfiguredPublicBaseUrl({
      RENDER: "true",
      RENDER_EXTERNAL_URL: "https://vertex.onrender.com",
    }),
    "https://vertex.onrender.com",
  );
  assert.equal(
    getConfiguredPublicBaseUrl({
      PUBLIC_BASE_URL: "https://music.example.com",
      RENDER: "true",
      RENDER_EXTERNAL_URL: "https://vertex.onrender.com",
    }),
    "https://music.example.com",
  );
  assert.equal(
    getConfiguredPublicBaseUrl({ RENDER_EXTERNAL_URL: "https://untrusted.example" }),
    undefined,
  );
});
