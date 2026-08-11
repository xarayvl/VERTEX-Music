import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('NVIDIA diagnostics never derive or retain an API key fingerprint', () => {
  assert.doesNotMatch(serverSource, /keyFingerprint/);
  assert.doesNotMatch(serverSource, /apiKey\.slice\s*\(/);
});

test('server errors are not copied directly into client error fields', () => {
  assert.doesNotMatch(serverSource, /error:\s*error(?:\?\.|\.)message/);
  assert.match(serverSource, /X-Correlation-ID/);
  assert.match(serverSource, /TRACK_CREATE_FAILED/);
});
