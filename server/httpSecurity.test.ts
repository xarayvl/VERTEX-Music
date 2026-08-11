import assert from "node:assert/strict";
import test from "node:test";
import { getProductionPublicOrigin, getSecurityHeaders } from "./httpSecurity.js";

test("production security headers enforce transport and browser isolation policies", () => {
  const headers = getSecurityHeaders(true);

  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.match(headers["Content-Security-Policy"], /upgrade-insecure-requests/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("development does not emit HSTS or a production CSP", () => {
  const headers = getSecurityHeaders(false);
  assert.equal(headers["Strict-Transport-Security"], undefined);
  assert.equal(headers["Content-Security-Policy"], undefined);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
});

test("production public origin must be an unambiguous HTTPS origin", () => {
  assert.equal(getProductionPublicOrigin("https://vertex.example"), "https://vertex.example");
  assert.throws(() => getProductionPublicOrigin(undefined), /required/);
  assert.throws(() => getProductionPublicOrigin("http://vertex.example"), /HTTPS origin/);
  assert.throws(() => getProductionPublicOrigin("https://vertex.example/app"), /HTTPS origin/);
  assert.throws(() => getProductionPublicOrigin("https://user:pass@vertex.example"), /HTTPS origin/);
});
